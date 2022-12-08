import { assert, expect } from "chai";
import {generateRandomString, timeout} from "../src/utils";
// @ts-ignore
import {assertAsyncError, assertTsDatastoreOrmError, initializeConnection, connection} from "./share";

before(initializeConnection);
describe("Lock Test", () => {
    it("simple lock", async () => {
        const lockManager = connection.getLockManager({expiresIn: 1000});
        const lockKey = "hello";
        const result = await lockManager.start(lockKey, async () => {
            return 5;
        });
        assert.equal(result.value, 5);
    });

    it("existing lock", async () => {
        const expiresIn = 1000;
        const lockManager = connection.getLockManager({expiresIn});
        const key = "test";

        const promise1 = lockManager.start(key, async () => {
            await timeout(1000);
        });
        // wait for a while to make sure lock is active
        await timeout(100);

        await assertTsDatastoreOrmError(async () => {
            await lockManager.start(key, async () => {

            });
        }, {message: /Failed to acquire the lock/});

        // wait for the lock to complete
        await promise1;

        // able to start the lock again
        await lockManager.start(key, async () => {
            //
        });
    });

    it("massive locks with different keys", async () => {
        const lockManager = connection.getLockManager({expiresIn: 1000});
        const callback = async () => {
            const randomKey = generateRandomString(8);
            return lockManager.start(randomKey, async () => {
                return true;
            });
        };

        let total = 10;
        const batch = 10;
        for (let i = 0; i < batch; i++) {
            const promises = Array(total).fill(0).map(x => callback());
            const results = await Promise.all(promises);
            total++;
        }
    });

    it("error: throw error in execute", async () => {
        const lockManager = connection.getLockManager({expiresIn: 1000});
        const key = "test6";

        const error1 = new Error("testing");
        await assertAsyncError(async () => {
            await lockManager.start(key, async () => {
                throw error1;
            });
        }, {message: /testing/});

        // we can continue to do the lock
        const result = await lockManager.start(key, async () => {
        });
    });

    it("atomic check", async () => {
        const key = "test4";
        const lockManager = connection.getLockManager({expiresIn: 5000, retryDelay: 100, maxRetry: 10});
        const total = 10;
        let count = 0;

        const callback = async () => {
            return lockManager.start(key, async () => {
                count++;
            });
        };

        const promises = Array(total).fill(0).map(x => callback());
        const results = await Promise.all(promises);
        assert.equal(count, total);
    });
});
