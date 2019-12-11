import { assert, expect } from "chai";
import {DatastoreOrmDecoratorError, DatastoreOrmOperationError} from "../src";
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
    it("truncate", async () => {
        const [total, requestResponse] = await ErrorTest.truncate();
    });

    it("Save without id", async () => {
        await assertOperationError(async () => {
            const [entity1] = await ErrorTest.create().save();
            const child1 = ErrorTestChild.create();
            child1.setAncestor(entity1);
            await child1.save();
        }, /Please provide an id for this entity/);
    });

    it("Get key without id", async () => {
        await assertOperationError(async () => {
            const entity = ErrorTest.create();
            entity.getKey();
        }, /Please provide an id for this entity/);
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
            await entity2.save();
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
        await assertOperationError(async () => {
            const [entity] = await ErrorTest.create().save();
            entity.id = 1;
        }, /You cannot update id of an existing entity. id \(.*\)/);
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
