import * as Datastore from "@google-cloud/datastore";
import {TsDatastoreOrmError} from "../errors/TsDatastoreOrmError";
import {Repository} from "../Repository";
import {TransactionManager} from "../transactions/TransactionManager";
import { ILockParams, ILockResult} from "../types";
import {createMd5, generateRandomString, timeout} from "../utils";
import {LockEntity} from "./LockEntity";

export class Lock<T extends typeof LockEntity> {
    public datastore: Datastore.Datastore;
    public classObject: T;
    public namespace: string | undefined;
    public kind: string;
    public expiresIn: number;
    public maxRetry: number;
    public retryDelay: number;
    public lockKey: string;
    public _id: string;
    public randomId: string;

    constructor(options: ILockParams<T>) {
        this.datastore = options.datastore;
        this.classObject = options.classObject;
        this.namespace = options.namespace;
        this.kind = options.kind;
        this.expiresIn = options.expiresIn;
        this.maxRetry = options.maxRetry;
        this.retryDelay = options.retryDelay;
        this.lockKey = options.lockKey;
        this.randomId = generateRandomString(16);
        this._id = createMd5(options.lockKey);
    }

    public async start<R extends any>(callback: () => Promise<R>): Promise<ILockResult<R>> {
        const acquireResult = await this.acquire();

        try {
            const result = await callback();
            return {value: result};

        } finally {
            // release the lock
            await this.release();
        }
    }

    public async acquire(): Promise<{totalRetry: number}> {
        let totalRetry = 0;
        let canLock = false;

        const transactionManager = new TransactionManager({
            datastore: this.datastore,
            maxRetry: 0,
            retryDelay: 0,
            readOnly: false,
        });

        const repository = new Repository({
            datastore: this.datastore,
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
        });

        do {
            try {
                const result = await transactionManager.start(async session => {
                    let lock = await repository.findOneWithSession(this._id, session);
                    const now = new Date();
                    if (!lock) {
                        lock = repository.create();
                        lock._id = this._id;
                        lock.lockKey = this.lockKey;
                        lock.randomId = this.randomId;
                        lock.expiredAt.setTime(now.getTime() + this.expiresIn);
                        repository.insertWithSession(lock, session);
                        return;

                    } else if (now.getTime() > lock.expiredAt.getTime()) {
                        // update it
                        lock.randomId = this.randomId;
                        lock.expiredAt.setTime(now.getTime() + this.expiresIn);
                        repository.updateWithSession(lock, session);
                        return;

                    }

                    await session.rollback();
                });

                // we successfully acquired the lock
                if (result.hasCommitted) {
                    canLock = true;
                    break;
                }
            } catch (err) {
                // ignore error, leave it for retry
            }

            if (!canLock) {
                if (this.retryDelay) {
                    await timeout(this.retryDelay);
                }
            }
        } while (totalRetry++ < this.maxRetry);

        if (!canLock) {
            throw new TsDatastoreOrmError(`(LockManager) Failed to acquire the lock with the lockKey "${this.lockKey}".`);
        }

        return {totalRetry};
    }

    // this shouldn't throw any error
    public async release(): Promise<void> {
        const transactionManager = new TransactionManager({
            datastore: this.datastore,
            maxRetry: 0,
            retryDelay: 0,
            readOnly: false,
        });

        const repository = new Repository({
            datastore: this.datastore,
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
        });

        try {
            const result = await transactionManager.start(async session => {
                const lock = await repository.findOneWithSession(this._id, session);
                if (lock && lock.randomId === this.randomId) {
                    repository.deleteWithSession(lock, session);
                }
            });
        } catch (err) {
            // ignore errors (any possible error will just cause lock failed according, so it's save to ignore errors)
        }
    }
}
