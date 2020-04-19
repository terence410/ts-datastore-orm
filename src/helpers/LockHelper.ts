import {BaseEntity, Column, Entity, Transaction} from "..";
import {DatastoreOrmLockHelperError} from "../errors/DatastoreOrmLockHelperError";
import {ILockOptions, ILockResponse, IRequestResponse} from "../types";
import {createMd5, generateRandomString, timeout} from "../utils";
import {PerformanceHelper} from "./PerformanceHelper";

const defaultOptions: ILockOptions = {expire: 5000, delay: 50, maxRetry: 0, throwReleaseError: false};

@Entity({namespace: "datastoreorm", kind: "lock"})
export class Lock extends BaseEntity {
    @Column()
    public id: string = "";

    @Column()
    public clientId: string = "";

    @Column()
    public key: string = "";

    @Column()
    public expiredAt: Date = new Date();
}

export class LockHelper {
    public static setDefaultOptions(lockOptions: Partial<ILockOptions> = {}) {
        Object.assign(defaultOptions, lockOptions);
    }

    public static async truncate() {
        return await Lock.truncate();
    }

    public static async execute<T extends any>(key: string, callback: (lockHelper: LockHelper) => Promise<T>,
                                               options: Partial<ILockOptions> = {}):
        Promise<[T, ILockResponse]> {

        const performanceHelper = new PerformanceHelper().start();
        const lockHelper = new LockHelper(key, options);
        const [isNewLock, lockResponse] = await lockHelper.acquire();

        let result: any;
        try {
            result = await callback(lockHelper);
        } catch (err) {
            throw err;

        } finally {
            // release the lock
            if (lockHelper.canRelease) {
                await lockHelper.release();
            }
        }

        return [result, {totalRetry: lockResponse.totalRetry,  executionTime: performanceHelper.read()}];
    }

    public canRelease: boolean = false;
    public readonly options: ILockOptions;
    private readonly _id: string;
    private readonly _clientId: string;

    constructor(public readonly key: string, options: Partial<ILockOptions> = {}) {
        this._clientId = generateRandomString(16);
        this._id = createMd5(key);
        this.options = Object.assign({}, defaultOptions, options);
    }

    public async acquire(): Promise<[boolean, ILockResponse]> {
        if (this.canRelease) {
            throw new DatastoreOrmLockHelperError(`(LockHelper) You cannot acquire the lock repeatedly. key (${this.key})`);
        }

        const performanceHelper = new PerformanceHelper().start();
        let retry = 0;
        let canLock = false;
        let isNewLock = false;
        do {
            try {
                const [isNewLock1, transactionResponse] = await Transaction.execute(async transaction => {
                    let [lock] = await transaction.find(Lock, this._id);
                    const now = new Date();
                    if (!lock) {
                        lock = new Lock();
                        lock.id = this._id;
                        lock.key = this.key;
                        lock.clientId = this._clientId;
                        lock.expiredAt.setTime(now.getTime() + this.options.expire);
                        transaction.save(lock);
                        return true;

                    } else if (now > lock.expiredAt) {
                        // update it
                        lock.clientId = this._clientId;
                        lock.expiredAt.setTime(now.getTime() + this.options.expire);
                        transaction.save(lock);
                        return false;

                    }

                    // there is a lock not expired yet
                    // quick rollback
                    await transaction.rollback();
                });

                // we successfully acquired the lock
                if (transactionResponse.hasCommitted) {
                    canLock = true;
                    isNewLock = isNewLock1 as boolean;
                    break;
                }
            } catch (err) {
                // we ignore all error
            }

            if (!canLock) {
                await timeout(this.options.delay);
            }
        } while (retry++ < this.options.maxRetry);

        if (!canLock) {
            throw new DatastoreOrmLockHelperError(`(LockHelper) Failed to acquire the lock. key (${this.key}). retry: ${retry - 1}.`);
        }

        this.canRelease = canLock;
        const lockResponse = {totalRetry: retry, executionTime: performanceHelper.read()};
        return [isNewLock, lockResponse];
    }

    public async release(): Promise<[boolean, IRequestResponse]> {
        if (!this.canRelease) {
            throw new DatastoreOrmLockHelperError(`(LockHelper) You cannot release a lock without successfully being acquired. key (${this.key})`);
        }

        this.canRelease = false;
        const performanceHelper = new PerformanceHelper().start();
        let isReleased = false;

        try {
            [isReleased] = await Transaction.execute(async transaction => {
                const [lock] = await transaction.find(Lock, this._id);
                const now = new Date();
                let isReleased1 = false;

                if (lock) {
                    if (lock.clientId === this._clientId) {
                        transaction.delete(lock);
                        return true;

                    } else {
                        isReleased1 = now > lock.expiredAt;
                    }
                } else {
                    isReleased1 = true;
                }

                await transaction.rollback();
                return isReleased1;
            });
        } catch (err) {
            // discard transaction error
            if (this.options.throwReleaseError) {
                throw err;
            }
        }

        return [isReleased, performanceHelper.readResult()];
    }
}
