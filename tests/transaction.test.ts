import { assert, expect } from "chai";
import {Transaction} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {errorCodes} from "../src/enums/errorCodes";
import {timeout} from "../src/utils";

@Entity({namespace: "testing", kind: "transactionTest"})
export class TransactionTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";
}

@Entity({namespace: "testing", kind: "transactionTestChild", ancestors: TransactionTest})
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
        const [user1] = await TransactionTest.create({id: id1, name: "Terence"}).save();
        const [user2] = await TransactionTest.create({id: id2, name: "Terence"}).save();

        const [child1, transactionResponse] = await Transaction.execute(async transaction => {
            let child2: TransactionTest | undefined;
            const [users1, requestResponse1] = await transaction.findMany(TransactionTest, [id1, id2]);

            if (users1.length > 1) {
                const user1a = users1[0];
                const user2a = users1[1];
                const [ids] = await transaction.allocateIds(TransactionTest);
                child2 = TransactionTestChild.create({name: "Task Group", id: ids[0]});
                child2.setAncestor(user1a);
                transaction.save(child2);
                transaction.delete(user2a);
                return child2;
            } else {
                transaction.rollback();
            }
        }, {maxRetry: 2});

        // we have a child
        assert.equal(transactionResponse.savedEntities.length, 1);
        assert.equal(transactionResponse.deletedEntities.length, 1);
        assert.isDefined(child1);

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
            transaction.rollback();
        });
        assert.isFalse(transactionResponse.hasCommit);
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
                    transaction.rollback();
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
            assert.equal(err.code, errorCodes.ABORTED);
        }

        try {
            const results = await Promise.all([
                callback(5),
                callback(5),
                callback(5),
            ]);

            // we will see some transaction has retry
            const totalRetryItem = results.find(x => x.totalRetry > 0);
            assert.isDefined(totalRetryItem);
        } catch (err) {
            assert.isTrue(false);
            console.log(err.message);
        }
    });

    it("readonly transaction", async () => {
        const [user1] = await TransactionTest.create({name: "Terence"}).save();

        const readonly = async (readOnly: boolean) => {
            const [children1, transactionResponse] = await Transaction.execute(async transaction => {
                const [user2] = await transaction.find(TransactionTest, user1.id);
                await timeout(1000);
                const [children2, requestResponse1] = await transaction.query(TransactionTestChild).setAncestor(user1).run();
                return children2;
            }, {readOnly});
            return children1;
        };

        const update = async () => {
            const [user, transactionResponse] = await Transaction.execute(async transaction => {
                await timeout(500);
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
});
