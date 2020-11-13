import { assert, expect } from "chai";
import {Field} from "../src/decorators/Field";
import {Entity} from "../src/decorators/Entity";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";
import {BaseEntity} from "../src/BaseEntity";
import {Repository} from "../src/Repository";
import {timeout} from "../src/utils";
// @ts-ignore
import {assertAsyncError, connection, beforeCallback} from "./share";

@Entity({namespace: "testing", kind: "TransactionTest"})
export class TransactionManagerTest extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";

    @Field()
    public value: number = 0;

    @Field()
    public date: Date = new Date();
}

@Entity({namespace: "testing", kind: "TransactionTestChild"})
export class TransactionTestChild extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";
}

// before test
before(beforeCallback);
describe("Transaction Test", () => {
    let entityRepository: Repository<typeof TransactionManagerTest>;
    let childRepository: Repository<typeof TransactionTestChild>;

    before(() => {
        entityRepository = connection.getRepository(TransactionManagerTest);
        childRepository = connection.getRepository(TransactionTestChild);
    });
    after(async () => {
        await entityRepository.truncate();
        await childRepository.truncate();
    });

    it("standard transaction", async () => {
        const id1 = 1;
        const id2 = 2;
        const newName = "New Name";
        const entity1 = entityRepository.create({_id: id1, name: "Terence"});
        await entityRepository.insert(entity1);

        const entity2 = await entityRepository.create({_id: id2, name: "Terence"});
        await entityRepository.insert(entity2);

        const transactionManager = connection.getTransactionManager();
        const result = await transactionManager.start(async session => {
            const findEntities = await entityRepository.findManyWithSessions([id1, id2], session);

            const entity1a = findEntities[0];
            const entity1b = findEntities[1];

            const ids = await entityRepository.allocateIdsWithSession(1, session);
            const testChild = childRepository.create({name: "Child", _id: ids[0]});
            testChild._ancestorKey = entity1a.getKey();
            entity1a.name = newName;

            entityRepository.updateWithSession(entity1a, session);
            entityRepository.deleteWithSession(entity1b, session);
            childRepository.insertWithSession(testChild, session);
            return testChild;
        });

        // we have a child
        const newChild = result.value;
        assert.isTrue(result.hasCommitted);
        assert.isDefined(newChild);
        if (newChild) {
            assert.isTrue(newChild._id > 0);

            // child id is correct
            const findNewChild = await childRepository.findOne(newChild.getKey());
            assert.isDefined(findNewChild);
        }

        // entity updated
        const findEntity1 = await entityRepository.findOne(entity1._id);
        assert.isDefined(findEntity1);

        // entity removed
        const findEntity2 = await entityRepository.findOne(entity2._id);
        assert.isUndefined(findEntity2);
    });

    it("rollback transaction", async () => {
        const transactionManager = connection.getTransactionManager();
        const result = await transactionManager.start(async session => {
            await session.rollback();
        });
        assert.isFalse(result.hasCommitted);
    });

    it("error: throw error", async () => {
        const transactionManager = connection.getTransactionManager();
        const error = new Error("test");
        const returnError = await assertAsyncError(async () => {
            const result = await transactionManager.start(async session => {
                throw error;
            });
        }, {message: /test/});

        assert.equal(error, returnError);
    });

    it("error: conflict updating same entity", async () => {
        const entity1 = await entityRepository.create({name: "Terence"});
        await entityRepository.insert(entity1);

        const callback = async (maxRetry: number = 0) => {
            const transactionManager = connection.getTransactionManager({maxRetry, retryDelay: 1000});
            const result = await transactionManager.start(async session => {
                const findEntity1 = await entityRepository.findOneWithSession(entity1._id, session);
                findEntity1!.value++;
                entityRepository.updateWithSession(findEntity1!, session);
                await timeout(100);
            });
            
            return result;
        };

        // throw error
        await assertAsyncError(async () => {
            await Promise.all([
                callback(),
                callback(),
                callback(),
            ]);
        }, {message: /cross-transaction contention/});

        const total = 5;
        const promises = Array(total).fill(0).map(x => callback(5));
        const results = await Promise.all(promises);

        // we will see some transaction has retry
        const totalRetryItem = results.find(x => x.totalRetry > 0);
        assert.isDefined(totalRetryItem);
    });

    it("multiple action, only last action will be used", async () => {
        const entity1 = await entityRepository.create({name: "Terence"});
        await entityRepository.insert(entity1);

        const transactionManager = connection.getTransactionManager();
        const result = await transactionManager.start(async session => {
            const findEntity1 = await entityRepository.findOneWithSession(entity1._id, session);
            entityRepository.insertWithSession([findEntity1!], session);
            entityRepository.upsertWithSession([findEntity1!], session);
            entityRepository.updateWithSession([findEntity1!], session);
            entityRepository.deleteWithSession([findEntity1!], session);
        });

        const findEntity = await entityRepository.findOne(entity1._id);
        assert.isUndefined(findEntity);
    });

    it("readonly transaction", async () => {
        const entity1 = await entityRepository.insert(new TransactionManagerTest());

        const readonlyCallback = async (readOnly: boolean) => {
            const transactionManager = connection.getTransactionManager({readOnly});
            const result = await transactionManager.start(async session => {
                const findEntity1 = await entityRepository.findOneWithSession(entity1._id, session);
                await timeout(500);

                const childEntity = await childRepository.queryWithSession(session).setAncestorKey(entity1.getKey()).findOne();
                const childEntityKey = await childRepository.selectKeyQueryWithSession(session).setAncestorKey(entity1.getKey()).findOne();

                return {childEntity, childEntityKey};
            });

            return result.value;
        };

        const insert = async () => {
            const transactionManager = connection.getTransactionManager();
            const result = await transactionManager.start(async session => {
                await timeout(250);
                const child = new TransactionTestChild();
                child._ancestorKey = entity1.getKey();
                childRepository.insertWithSession(child, session);
            } );
            return result.value;
        };

        // child entities created inside readonly
        const result1 = await Promise.all([readonlyCallback(true), insert()]);
        assert.isUndefined(result1[0].childEntity);

        // child entities are found later on
        const result2 = await Promise.all([readonlyCallback(false), insert()]);
        assert.isDefined(result2[0].childEntity);
        assert.deepEqual(result2[0].childEntity!.getKey(), result2[0].childEntityKey);
    });

    it("massive findOne transaction", async () => {
        const entity1 = await entityRepository.insert(new TransactionManagerTest());

        const callback = async () => {
            const transactionManager = connection.getTransactionManager();
            return await transactionManager.start(async session => {
                const findEntity1 = await entityRepository.findOneWithSession(entity1._id, session);
            });
        };

        let total = 10;
        const batch = 10;
        for (let i = 0; i < batch; i++) {
            const pp = new PerformanceHelper().start();
            const promises = Array(total).fill(0).map(x => callback());
            const results = await Promise.all(promises);
            total++;
        }
    });
});
