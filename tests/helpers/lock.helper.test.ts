import { assert, expect } from "chai";
import {Lock, LockHelper} from "../../src/helpers/LockHelper";
import {PerformanceHelper} from "../../src/helpers/PerformanceHelper";
import {generateRandomString, timeout} from "../../src/utils";

describe("Lock Helper Test: Truncate", () => {
    it("truncate", async () => {
        await Lock.truncate();
    });
});

describe("Helper Test: Increment", () => {
    it("update settings", async () => {
        LockHelper.setDefaultOptions({delay: 50, maxRetry: 1, expire: 1000, quickRelease: false});
    });

    it("lock timeout", async () => {
        const key = "test";
        const lockHelper1 = new LockHelper(key);
        const lockHelper2 = new LockHelper(key);
        const expire = 1000;
        const [isNewLock1] = await lockHelper1.acquire({expire});
        assert.isTrue(isNewLock1);

        // you cannot lock again
        try {
            await lockHelper2.acquire({expire});
            assert.isTrue(false);
        } catch (err) {
            //
        }

        await timeout(expire);
        const [isNewLock2] = await lockHelper2.acquire({expire});
        assert.isFalse(isNewLock2);

        // successfully release
        const [isReleased] = await lockHelper1.release();
        assert.isFalse(isReleased);
    });

    it("lock release 1", async () => {
        const key = "test1";
        const expire = 1000;
        const lockHelper = new LockHelper(key);
        let [isNewLock] = await lockHelper.acquire({expire});
        assert.isTrue(isNewLock);

        const [isReleased] = await lockHelper.release();
        assert.isTrue(isReleased);

        // can keep on using the lock
        [isNewLock] = await lockHelper.acquire({expire});
        assert.isTrue(isNewLock);
    });

    it("lock release 2", async () => {
        const key = "test2";
        const expire = 1000;
        const lockHelper1 = new LockHelper(key);
        const lockHelper2 = new LockHelper(key);
        const [isNewLock1] = await lockHelper1.acquire({expire});
        assert.isTrue(isNewLock1);

        await timeout(expire);
        const [isNewLock2] = await lockHelper2.acquire({expire});
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

    it("lock errors", async () => {
        const key = "errors";
        const lockHelper = new LockHelper(key);

        // you cannot release without lock
        try {
            await lockHelper.release();
            assert.isTrue(false);
        } catch (err) {
            //
        }
    });

    it("massive locks", async () => {
        const callback = async () => {
            const randomKey = generateRandomString(8);
            const lockHelper = new LockHelper(randomKey);
            return LockHelper.execute(randomKey, async (lock) => {
                return true;
            });
        };

        let total = 10;
        const batch = 10;
        for (let i = 0; i < batch; i++) {
            const pp = new PerformanceHelper().start();
            const promises = Array(total).fill(0).map(x => callback());
            const results = await Promise.all(promises);
            total++;
            console.log(pp.readResult(), total);
        }

        // wait for a while for release
        await timeout(1000);
    });
});
