import { assert, expect } from "chai";
import {DatastoreOrmDatastoreError, Transaction} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";
import {timeout} from "../src/utils";

@Entity({namespace: "testing", kind: "transactionTest"})
export class TransactionTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";

    @Column()
    public value: number = 0;

    @Column()
    public date: Date = new Date();
}

@Entity({namespace: "testing", kind: "transactionTestChild", ancestor: TransactionTest})
export class TransactionTestChild extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";
}

describe("Transaction Test", () => {
    it("truncate", async () => {
        await TransactionTest.truncate();
        await TransactionTestChild.truncate();
    });

    it("standard transaction 1", async () => {
        const id1 = 1;
        const id2 = 2;
        const newName = "New Name";
        const [user1] = await TransactionTest.create({id: id1, name: "Terence"}).save();
        const [user2] = await TransactionTest.create({id: id2, name: "Terence"}).save();

        const [child1, transactionResponse] = await Transaction.execute(async transaction => {
            let child2: TransactionTestChild | undefined;
            const [users1, requestResponse1] = await transaction.findMany(TransactionTest, [id1, id2]);

            if (users1.length > 1) {
                const user1a = users1[0];
                const user2a = users1[1];
                const [ids] = await transaction.allocateIds(TransactionTest, 1);
                child2 = TransactionTestChild.create({name: "Task Group", id: ids[0]});
                child2.setAncestor(user1a);
                user1a.name = newName;
                transaction.save(user1a);
                transaction.save(child2);
                transaction.delete(user2a);
                return child2;
            } else {
                await transaction.rollback();
            }
        }, {maxRetry: 2});

        // we have a child
        assert.equal(transactionResponse.createdEntities.length, 1);
        assert.equal(transactionResponse.updatedEntities.length, 1);
        assert.equal(transactionResponse.deletedEntities.length, 1);
        assert.isDefined(child1);
        if (child1) {
            assert.isTrue(child1.id > 0);

            // child id is correct
            const [child1a] = await TransactionTestChild.find({ancestor: user1, id: child1.id});
            assert.isDefined(child1a);
        }

        // entity updated
        const [user1b] = await TransactionTest.find(id1);
        assert.isDefined(user1b);
        if (user1b) {
            assert.equal(user1b.name, newName);
        }

        // entity removed
        const [user2b] = await TransactionTest.find(id2);
        assert.isUndefined(user2b);
    });

    it("standard transaction 2", async () => {
        const id = 11;
        const transaction1 = new Transaction();
        await transaction1.run();
        const [user1, requestResponse3] = await transaction1.find(TransactionTest, id);
        try {
            if (!user1) {
                const user2 = TransactionTest.create({name: "Terence"});
                transaction1.save(user2);
                assert.equal(user2.id, 0);
                const [requestResponse1] = await transaction1.commit();
                assert.isAtLeast(user2.id, 1);
            } else {
                assert.isTrue(false);
                await transaction1.rollback(); // can consider omit await for faster performance
            }
        } catch (err) {
            assert.isTrue(false);
            await transaction1.rollback(); // can consider omit await for faster performance
        }
    });

    it("rollback transaction", async () => {
        const [_, transactionResponse] = await Transaction.execute(async transaction => {
            await transaction.rollback();
        });
        assert.isFalse(transactionResponse.hasCommitted);
    });

    it("throw error in transaction", async () => {
        try {
            const [_, transactionResponse] = await Transaction.execute(async transaction => {
                throw new Error("test");
            });
            assert.isTrue(false);
        } catch (err) {
            assert.isFalse(err instanceof DatastoreOrmDatastoreError);
            assert.equal(err.message, "test");
        }
    });

    it("conflict transaction", async () => {
        const [user1] = await TransactionTest.create({name: "Terence"}).save();

        const callback = async (maxRetry: number = 0) => {
            const [_, transactionResponse] = await Transaction.execute(async transaction => {
                const [user2] = await transaction.find(TransactionTest, user1.id);
                if (user2) {
                    user2.name = "hello";
                    transaction.save(user2);
                } else {
                    await transaction.rollback();
                }
            }, {maxRetry});

            return transactionResponse;
        };

        try {
            await Promise.all([
                callback(),
                callback(),
                callback(),
            ]);
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof DatastoreOrmDatastoreError);
        }

        try {
            const total = 5;
            const promises = Array(total).fill(0).map(x => callback(5));
            const results = await Promise.all(promises);

            // we will see some transaction has retry
            const totalRetryItem = results.find(x => x.totalRetry > 0);
            assert.isDefined(totalRetryItem);
        } catch (err) {
            console.log(err.message);
            assert.isTrue(false);
        }
    });

    it("readonly transaction", async () => {
        const [user1] = await TransactionTest.create({name: "Terence"}).save();

        const readonly = async (readOnly: boolean) => {
            const [children1, transactionResponse] = await Transaction.execute(async transaction => {
                const [user2] = await transaction.find(TransactionTest, user1.id);
                await timeout(500);
                const [children2, requestResponse1] = await transaction.query(TransactionTestChild).setAncestor(user1).run();
                return children2;
            }, {readOnly});
            return children1;
        };

        const update = async () => {
            const [user, transactionResponse] = await Transaction.execute(async transaction => {
                await timeout(250);
                const child = TransactionTestChild.create();
                child.setAncestor(user1);
                transaction.save(child);
            } );
            return user;
        };

        // child entities created inside readonly
        const result1 = await Promise.all([readonly(true), update()]);
        const childrenA = result1[0];
        assert.equal(childrenA.length, 0);

        // child entities are found later on
        const result2 = await Promise.all([readonly(false), update()]);
        const childrenB = result2[0];
        assert.equal(childrenB.length, 2);
    });

    it("massive read transaction", async () => {
        const [user1] = await TransactionTest.create({name: "Terence"}).save();

        const callback = async () => {
            const [_, transactionResponse] = await Transaction.execute(async transaction => {
                const [user2] = await transaction.find(TransactionTest, user1.id);
            }, {maxRetry: 0});
            return transactionResponse;
        };

        let total = 10;
        const batch = 10;
        for (let i = 0; i < batch; i++) {
            const pp = new PerformanceHelper().start();
            const promises = Array(total).fill(0).map(x => callback());
            const results = await Promise.all(promises);
            total++;
            // console.log(pp.readResult(), total);
        }
    });
});
