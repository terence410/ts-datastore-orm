import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../../src";
import {DatastoreOrmLockError} from "../../src/errors/DatastoreOrmLockError";
import {Lock, LockHelper} from "../../src/helpers/LockHelper";
import {PerformanceHelper} from "../../src/helpers/PerformanceHelper";
import {generateRandomString, timeout} from "../../src/utils";

@Entity({namespace: "testing", kind: "lockTest"})
export class LockTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total: number = 0;
}

describe("Lock Test", () => {
    it("truncate", async () => {
        await Lock.truncate();
    });

    it("update settings", async () => {
        LockHelper.setDefaultOptions({
            delay: 50,
            maxRetry: 1,
            expire: 5000,
            quickRelease: false,
            throwReleaseError: false,
        });
    });

    it("lock timeout", async () => {
        const key = "test";
        const expire = 1000;
        const lockHelper1 = new LockHelper(key, {expire});
        const lockHelper2 = new LockHelper(key, {expire});
        const [isNewLock1] = await lockHelper1.acquire();
        assert.isTrue(isNewLock1);

        // you cannot lock again
        try {
            await lockHelper2.acquire();
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof DatastoreOrmLockError);
            assert.match(err.message, /Failed to acquire the lock/);
        }

        await timeout(expire);
        const [isNewLock2] = await lockHelper2.acquire();
        assert.isFalse(isNewLock2);

        // successfully release
        const [isReleased] = await lockHelper1.release();
        assert.isFalse(isReleased);
    });

    it("lock release 1", async () => {
        const key = "test1";
        const lockHelper = new LockHelper(key);
        let [isNewLock] = await lockHelper.acquire();
        assert.isTrue(isNewLock);

        const [isReleased] = await lockHelper.release();
        assert.isTrue(isReleased);

        // can keep on using the lock
        [isNewLock] = await lockHelper.acquire();
        assert.isTrue(isNewLock);
    });

    it("lock release 2", async () => {
        const key = "test2";
        const expire = 1000;
        const lockHelper1 = new LockHelper(key, {expire});
        const lockHelper2 = new LockHelper(key, {expire});
        const [isNewLock1] = await lockHelper1.acquire();
        assert.isTrue(isNewLock1);

        await timeout(expire);
        const [isNewLock2] = await lockHelper2.acquire();
        assert.isFalse(isNewLock2);

        // we can no longer release it
        const [isReleased1] = await lockHelper1.release();
        assert.isFalse(isReleased1);

        // this can release it
        const [isReleased2a] = await lockHelper2.release();
        assert.isTrue(isReleased2a);
    });

    it("lock release 3", async () => {
        const key = "test3";
        const lockHelper1 = new LockHelper(key);
        const output = 5;
        const [result] = await LockHelper.execute(key, async (lock) => {
            return output;
        }, {quickRelease: false});
        assert.equal(result, output);

        // acquire a new lock
        const [isNewLock1] = await lockHelper1.acquire();
        assert.isTrue(isNewLock1);
    });

    it("massive locks with different keys", async () => {
        const callback = async () => {
            const randomKey = generateRandomString(8);
            return LockHelper.execute(randomKey, async (lock) => {
                return true;
            }, {quickRelease: true});
        };

        let total = 10;
        const batch = 10;
        for (let i = 0; i < batch; i++) {
            const pp = new PerformanceHelper().start();
            const promises = Array(total).fill(0).map(x => callback());
            const results = await Promise.all(promises);
            total++;
        }

        // wait for a while for quick release to be completed
        await timeout(500);
    });

    it("atomic check", async () => {
        const key = "test4";
        const [entity] = await LockTest.create().save();
        const options = {quickRelease: true, maxRetry: 10, delay: 300, expire: 5000};

        const callback = async () => {
            return LockHelper.execute(key, async (lock) => {
                const [newEntity] = await LockTest.find(entity.id);
                if (newEntity) {
                    newEntity.total++;
                    await newEntity.save();
                }
            }, options);
        };

        const total = 10;
        const promises = Array(total).fill(0).map(x => callback());
        const results = await Promise.all(promises);

        // validate the final value
        const [foundEntity] = await LockTest.find(entity.id);
        assert.isDefined(foundEntity);
        if (foundEntity) {
            assert.equal(foundEntity.total, total);
        }

        // wait for a while for quick release to be completed
        await timeout(500);
    });

    it("error: release without lock", async () => {
        const key = "test5";
        const lockHelper = new LockHelper(key);

        // you cannot release without lock
        try {
            await lockHelper.release();
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof DatastoreOrmLockError);
            assert.match(err.message, /You cannot release a lock without successfully being acquired./);
        }
    });

    it("error: throw error in execute", async () => {
        const key = "test6";
        const lockHelper = new LockHelper(key);
        const error1 = new Error();
        try {
            const [result] = await LockHelper.execute(key, async (lock) => {
                throw error1;
            }, {quickRelease: false});
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err, error1);
        }

        // we can acquire and release
        await lockHelper.acquire();
        await lockHelper.release();
    });

    it("error: throw error in acquire lock", async () => {
        const key = "test7";
        const lockHelper = new LockHelper(key, {expire: 5000});
        await lockHelper.acquire();

        try {
            const [result] = await LockHelper.execute(key, async (lock) => {
                //
            });
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof DatastoreOrmLockError);
            assert.match(err.message, /Failed to acquire the lock./);
        }
        // release the lock
        await lockHelper.release();
    });

    it("error: acquire lock repeatedly", async () => {
        const key = "test8";
        const lockHelper = new LockHelper(key);
        await lockHelper.acquire();

        try {
            await lockHelper.acquire();
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof DatastoreOrmLockError);
            assert.match(err.message, /You cannot acquire the lock repeatedly./);
        }

        await lockHelper.release();
    });
});
