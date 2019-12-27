import { assert, expect } from "chai";
import {
    Batcher,
    datastoreOrm,
    DatastoreOrmDatastoreError,
    DatastoreOrmDecoratorError,
    DatastoreOrmOperationError, Transaction
} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";

@Entity({kind: "errorTest"})
class ErrorTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total: number = 0;

    @Column()
    public string: string = "";
}

@Entity({kind: "errorTestChild", ancestors: [ErrorTest]})
class ErrorTestChild extends BaseEntity {
    @Column()
    public id: number = 0;
}

async function assertDecoratorError(callback: () => void, errorMessageRegex: RegExp) {
    let isSuccess = false;
    try {
        await callback();
        isSuccess = true;
    } catch (err) {
        assert.isTrue(err instanceof DatastoreOrmDecoratorError);
        assert.match(err.message, errorMessageRegex);
    }
    assert.isFalse(isSuccess);
}

async function assertOperationError(callback: () => void, errorMessageRegex: RegExp) {
    let isSuccess = false;
    try {
        await callback();
        isSuccess = true;
    } catch (err) {
        assert.isTrue(err instanceof DatastoreOrmOperationError);
        assert.match(err.message, errorMessageRegex);
    }
    assert.isFalse(isSuccess);
}

async function assertDatastoreError(callback: () => void, errorMessageRegex: RegExp) {
    let isSuccess = false;
    try {
        await callback();
        isSuccess = true;
    } catch (err) {
        assert.isTrue(err instanceof DatastoreOrmDatastoreError);
        assert.match(err.message, errorMessageRegex);
    }
    assert.isFalse(isSuccess);
}

describe("Errors Test: Reset", () => {
    it("truncate", async () => {
        const [total, requestResponse] = await ErrorTest.truncate();
    });
});

describe("Errors Test: Decorators", () => {
    it("Entity without id", async () => {
        await assertDecoratorError(() => {
            @Entity({kind: "errorTest1"})
            class ErrorTest1 extends BaseEntity {
                @Column()
                public total: number = 0;
            }
        }, /Entity must define an id column/);
    });

    it("Entity without kind", async () => {
        await assertDecoratorError(() => {
            @Entity()
            class ErrorTest1 extends BaseEntity {
                @Column()
                public id: number = 0;
            }
        }, /Entity must define a kind/);
    });

    it("Entity subclass an existing entity", async () => {
        await assertDecoratorError(() => {
            @Entity()
            class ErrorTest1 extends ErrorTest {
                @Column()
                public id: number = 0;
            }
        }, /Entity is subclassing/);
    });

    it("Entity id is not valid", async () => {
        await assertDecoratorError(() => {
            @Entity({kind: "errorTest1"})
            class ErrorTest1 extends BaseEntity {
                @Column()
                public id: Date = new Date();
            }
        }, /id must be in the type of string or number/);
    });

    it("Entity generate id is not valid", async () => {
        await assertDecoratorError(() => {
            @Entity({kind: "errorTest1"})
            class ErrorTest1 extends BaseEntity {
                @Column({generateId: true})
                public id: string = "";
            }
        }, /generateId must be in the type of number/);
    });

    it("Entity with same kind", async () => {
        await assertDecoratorError(() => {
            @Entity({kind: "errorTest"})
            class ErrorTest1 extends BaseEntity {
                @Column()
                public id: string = "";
            }
        }, /Entity with kind.*is already used/);
    });
});

describe("Errors Test: Operations", () => {
    it("Delete multiple times (valid)", async () => {
        const batcher = new Batcher();
        const [entity1] = await ErrorTest.create().save();
        await entity1.delete();
        await entity1.delete();
    });

    it("Save without id", async () => {
        await assertOperationError(async () => {
            const [entity1] = await ErrorTest.create().save();
            const child1 = ErrorTestChild.create();
            child1.setAncestor(entity1);
            await child1.save();
        }, /This entity has no valid id nor auto generate id/);
    });

    it("Get key without id", async () => {
        await assertOperationError(async () => {
            const entity = ErrorTest.create();
            entity.getKey();
        }, /This entity has no valid id for getKey()/);
    });

    it("Set an invalid id", async () => {
        await assertOperationError(async () => {
            const entity = ErrorTest.create();
            entity.id = new Date() as any;
            const key = entity.getKey();
        }, /id must be string or number./);
    });

    it("Set invalid ancestor", async () => {
        await assertOperationError(async () => {
            const [entity1] = await ErrorTest.create().save();
            const entity2 = ErrorTest.create();
            entity2.setAncestor(entity1);
        }, /Entity does not require any ancestor/);
    });

    it("Need a valid ancestor 1", async () => {
        await assertOperationError(async () => {
            const child1 = ErrorTestChild.create({id: 1});
            await child1.save();
        }, /Entity requires ancestors of/);
    });

    it("Need a valid ancestor 2", async () => {
        await assertOperationError(async () => {
            const [entity1] = await ErrorTest.create().save();
            const [child1] = await ErrorTestChild.create({id: 1}).setAncestor(entity1).save();

            const child2 = ErrorTestChild.create({id: 2});
            child2.setAncestor(child1);
            await child2.save();
        }, /Entity requires ancestors of/);
    });

    it("Update id after save", async () => {
        const [entity1] = await ErrorTest.create().save();
        entity1.id = entity1.id; // this is ok

        await assertOperationError(async () => {
            const [entity2] = await ErrorTest.create().save();
            entity2.id = 1;
        }, /You cannot update id of an existing entity. id \(.*\)/);
    });

    it("Update ancestor", async () => {
        const [entity1] = await ErrorTest.create().save();
        const [entity2] = await ErrorTest.create().save();
        const entityChild1 = ErrorTestChild.create().setAncestor(entity1);

        await assertOperationError(async () => {
            entityChild1.setAncestor(entity2);
        }, /You cannot update ancestor once it is set./);
    });

    it("Update id after save", async () => {
        await assertOperationError(async () => {
            const [entity] = await ErrorTest.create().save();
            entity.setNamespace("namespace");
        }, /You cannot update namespace of an existing entity. id \(.*\)/);
    });

    it("Ancestor has different namespace", async () => {
        await assertOperationError(async () => {
            const [entity] = await ErrorTest.create().save();
            const child = ErrorTestChild.create({id: 2});
            child.setNamespace("namespace");
            child.setAncestor(entity);
        }, /The ancestor namespace .* is different/);
    });

    it("Ancestor has different namespace in query", async () => {
        await assertOperationError(async () => {
            const [entity] = await ErrorTest.create().save();
            const query = ErrorTestChild.query().setNamespace("namespace").setAncestor(entity);
        }, /The ancestor namespace .* is different/);
    });

    it("Update id for readonly entity save", async () => {
        await assertOperationError(async () => {
            const [entity] = await ErrorTest.create().save();
            const [foundEntity] = await ErrorTest
                .query()
                .selectKey()
                .filter("id", "=", entity.id)
                .runOnce();
            if (foundEntity) {
                foundEntity.string = "new";
                await foundEntity.save();
            }

        }, /Entity is read only. id \(.*\)/);
    });
});

describe("Errors Test: Datastore", () => {
    it("Save deleted entity", async () => {
        const [entity1] = await ErrorTest.create().save();
        await entity1.delete();

        await assertDatastoreError(async () => {
            await entity1.save();
        }, /Entity cannot be saved/);
    });

    it("Delete entity with error", async () => {
        const entity1 = ErrorTest.create({id: -1}).setNamespace("not exist");

        await assertDatastoreError(async () => {
            await entity1.delete();
        }, /Entity cannot be deleted/);
    });

    it("Find Error", async () => {
        await assertDatastoreError(async () => {
            const [entity1] = await ErrorTest.find({namespace: "not exist", id: 1});
        }, /Find Error/);
    });

    it("Allocate Id Error", async () => {
        await assertDatastoreError(async () => {
            const [ids] = await ErrorTest.allocateIds(-1);
        }, /Allocate Ids Error/);
    });

    it("Batch save error", async () => {
        await assertDatastoreError(async () => {
            const batcher = new Batcher();
            const entity1 = ErrorTest.create({id: -1}).setNamespace("not exist");
            await batcher.saveMany([entity1]);
        }, /Batcher Save Error for insert/);
    });

    it("Batch delete error", async () => {
        await assertDatastoreError(async () => {
            const batcher = new Batcher();
            const entity1 = ErrorTest.create({id: -1}).setNamespace("not exist");
            await batcher.deleteMany([entity1]);
        }, /Batcher Delete Error/);
    });

    it("Query run error", async () => {
        await assertDatastoreError(async () => {
            await ErrorTest.query().setNamespace("not exist").run();
        }, /Query Run Error/);
    });

    it("Query stream error", async () => {
        await new Promise(resolve => {
            const stream = ErrorTest.query().setNamespace("not exist").runStream();
            stream.on("error", err => {
                assert.isTrue(err instanceof DatastoreOrmDatastoreError);
                assert.match(err.message, /Query Run Stream Error/);
                resolve();
            });
        });
    });

    it("Transaction find error", async () => {
        await assertDatastoreError(async () => {
            const transaction = new Transaction();
            await transaction.run();
            await transaction.find(ErrorTest, {namespace: "not exist", id: 1});
        }, /Transaction Find Error/);
    });

    it("Transaction allocate ids error", async () => {
        await assertDatastoreError(async () => {
            const transaction = new Transaction();
            await transaction.run();
            await transaction.allocateIds(ErrorTest, -1);
        }, /Transaction Allocate Ids Error/);
    });

    it("Transaction commit error", async () => {
        await assertDatastoreError(async () => {
            const transaction = new Transaction();
            await transaction.run();
            await transaction.commit();
            await transaction.rollback();
        }, /Transaction Rollback Error/);
    });

    it("Transaction commit error", async () => {
        const [entity1] = await ErrorTest.create().save();

        const transaction1 = new Transaction();
        await transaction1.run();
        await transaction1.find(ErrorTest, entity1.id);

        const transaction2 = new Transaction();
        await transaction2.run();
        await transaction2.find(ErrorTest, entity1.id);

        transaction1.save(entity1);
        transaction2.save(entity1);

        await assertDatastoreError(async () => {
            await transaction1.commit();
            await transaction2.commit();
        }, /Transaction Commit Error/);
    });
});
