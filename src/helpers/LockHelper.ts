import {BaseEntity, Column, Entity, Transaction} from "..";
import {ILockOptions, ILockResponse, IRequestResponse} from "../types";
import {createMd5, generateRandomString, timeout} from "../utils";
import {PerformanceHelper} from "./PerformanceHelper";

let defaultOptions: ILockOptions = {expire: 1000, delay: 50, maxRetry: 0, quickRelease: true, throwReleaseError: false};

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
        defaultOptions = Object.assign(defaultOptions, lockOptions);
    }

    public static async execute<T extends any>(key: string, callback: (lockHelper: LockHelper) => Promise<T>,
                                               options: Partial<ILockOptions> = {}):
        Promise<[T, IRequestResponse]> {

        const performanceHelper = new PerformanceHelper().start();

        const lockHelper = new LockHelper(key);
        const [canLock] = await lockHelper.acquire(options);

        let result: any;
        if (canLock) {
            result = await callback(lockHelper);

            // release the lock
            if (lockHelper.canRelease) {
                if (lockHelper._quickRelease) {
                    lockHelper.release();
                } else {
                    await lockHelper.release();
                }
            }
        }

        return [result, performanceHelper.readResult()];
    }

    public canRelease: boolean = false;
    private _id: string;
    private _clientId: string;
    private _quickRelease: boolean = false;
    private _throwReleaseError: boolean = false;

    constructor(public readonly key: string) {
        this._clientId = generateRandomString(16);
        this._id = createMd5(key);
    }

    public async acquire(options: Partial<ILockOptions> = {}): Promise<[boolean, ILockResponse]> {
        if (this.canRelease) {
            throw new Error(`(LockHelper) You can not acquire lock repeatedly. key: ${this.key}`);
        }

        const maxRetry = options.maxRetry || defaultOptions.maxRetry;
        const delay = options.delay || defaultOptions.delay;
        const expire = options.expire || defaultOptions.expire;
        const performanceHelper = new PerformanceHelper().start();
        this._quickRelease = options.quickRelease !== undefined ? options.quickRelease : defaultOptions.quickRelease;
        this._throwReleaseError = options.throwReleaseError !== undefined ? options.throwReleaseError : defaultOptions.throwReleaseError;

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
                        lock.expiredAt.setTime(now.getTime() + expire);
                        transaction.save(lock);
                        return true;

                    } else if (now > lock.expiredAt) {
                        // update it
                        lock.clientId = this._clientId;
                        lock.expiredAt.setTime(now.getTime() + expire);
                        transaction.save(lock);
                        return false;

                    }

                    transaction.rollback();
                });

                // we successfully locked
                if (transactionResponse.hasCommit) {
                    canLock = true;
                    isNewLock = isNewLock1 as boolean;
                    break;
                }

            } catch (err) {
                // we ignore transaction error
            }

            if (!canLock) {
                await timeout(delay);
            }
        } while (retry++ < maxRetry);

        if (!canLock) {
            throw new Error(`(LockHelper) Failed to acquire lock for the key: ${this.key}.`);
        }

        this.canRelease = canLock;
        const lockResponse = {totalRetry: retry, executionTime: performanceHelper.read()};
        return [isNewLock, lockResponse];
    }

    public async release(): Promise<[boolean, IRequestResponse]> {
        if (!this.canRelease) {
            throw new Error(`(LockHelper) You can not release lock without successfully being acquired. key: ${this.key}`);
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

                    } else if (now > lock.expiredAt) {
                        isReleased1 = true;

                    } else {
                        isReleased1 = false;

                    }
                } else {
                    isReleased1 = true;
                }

                transaction.rollback();
                return isReleased1;
            });
        } catch (err) {
            // discard transaction error
            if (this._throwReleaseError) {
                throw err;
            }
        }

        return [isReleased, performanceHelper.readResult()];
    }
}
