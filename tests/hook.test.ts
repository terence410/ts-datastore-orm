import { assert, expect } from "chai";
import {IsDate, Length, validate, validateOrReject} from "class-validator";
import {BaseEntity} from "../src/BaseEntity";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {AfterLoad} from "../src/decorators/hooks/AfterLoad";
import {BeforeDelete} from "../src/decorators/hooks/BeforeDelete";
import {BeforeInsert} from "../src/decorators/hooks/BeforeInsert";
import {BeforeUpdate} from "../src/decorators/hooks/BeforeUpdate";
import {BeforeUpsert} from "../src/decorators/hooks/BeforeUpsert";
import {Repository} from "../src/Repository";
// @ts-ignore
import {assertAsyncError, beforeCallback, connection} from "./share";

@Entity({namespace: "testing", enumerable: true})
export class HookClass1 extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public updatedAt: Date = new Date();

    // @IsDate()
    @Length(10, 20)
    @Field()
    public name: string = "";

    public states: string[] = [];

    @BeforeInsert()
    private async beforeInsert() {
        this.states.push("beforeInsert");

        const errors = await validate(this);
        if (errors.length) {
            throw new Error(JSON.stringify(errors.map(x => x.constraints)));
        }
    }

    @BeforeUpsert()
    private async beforeUpsert() {
        this.states.push("beforeUpsert");
    }

    @BeforeUpdate()
    private async beforeUpdate() {
        this.states.push("beforeUpdate");
    }

    @AfterLoad()
    private async afterLoad() {
        this.states.push("afterLoad");
    }

    @BeforeDelete()
    public async beforeDelete() {
        this.states.push("beforeDelete");
    }
}

@Entity({namespace: "testing", enumerable: true})
export class HookClass2 extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    public states: string[] = [];

    @AfterLoad()
    @BeforeInsert()
    @BeforeUpsert()
    @BeforeUpdate()
    @BeforeDelete()
    public async hook(type: string) {
        this.states.push(type);
    }
}

@Entity({namespace: "testing", enumerable: true})
export class ExtendClass extends HookClass2 {
    @AfterLoad()
    public async newAfterLoad(type: string) {
        this.states.push("newAfterLoad");
    }
}

before(beforeCallback);
describe("Hook Test", () => {
    let repository1: Repository<typeof HookClass1>;
    let repository2: Repository<typeof HookClass2>;
    let repository3: Repository<typeof ExtendClass>;
    before(() => {
        repository1 = connection.getRepository(HookClass1);
        repository2 = connection.getRepository(HookClass2);
        repository3 = connection.getRepository(ExtendClass);
    });
    after(() => repository1.truncate());
    after(() => repository2.truncate());

    it("all hooks", async () => {
        const entity = repository1.create({name: "abcdefghijklmnop"});
        await repository1.insert(entity);
        await repository1.upsert(entity);
        await repository1.update(entity);

        const findEntity = await repository1.findOne(entity._id);
        await repository1.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "afterLoad"]);
    });

    it("all hooks 2", async () => {
        const entity = repository2.create();
        await repository2.insert(entity);
        await repository2.upsert(entity);
        await repository2.update(entity);

        const findEntity = await repository2.findOne(entity._id);
        await repository2.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "afterLoad"]);
    });

    it("all hooks 3 (extended class)", async () => {
        const entity = repository3.create();
        await repository3.insert(entity);
        await repository3.upsert(entity);
        await repository3.update(entity);

        const findEntity = await repository3.findOne(entity._id);
        await repository3.delete(entity);

        assert.deepEqual(entity.states, [ "beforeInsert", "beforeUpsert", "beforeUpdate", "beforeDelete" ]);
        assert.deepEqual(findEntity!.states, [ "newAfterLoad"]);
    });

    it("transaction", async () => {
        const entity1 = repository1.create({name: "abcdefghijklmnop"});
        const entity2 = repository1.create({name: "abcdefghijklmnop"});
        await repository1.insert(entity1);
        await repository1.insert(entity2);

        const transactionManager = connection.getTransactionManager();
        const result = await transactionManager.start(async session => {
            const newEntity1 = repository1.create({name: "abcdefghijklmnop"});
            const newEntity2 = repository1.create({name: "abcdefghijklmnop"});
            const findEntity1 = await repository1.findOneWithSession(entity1._id, session);
            const findEntity2 = await repository1.findOneWithSession(entity2._id, session);

            repository1.insertWithSession(newEntity1, session);
            repository1.upsertWithSession(newEntity2, session);
            repository1.updateWithSession(findEntity1!, session);
            repository1.deleteWithSession(findEntity2!, session);

            return [newEntity1, newEntity2, findEntity1, findEntity2];
        });

        const values = result.value.map(x => x!.states);
        assert.deepEqual(values, [["beforeInsert"], ["beforeUpsert"], ["afterLoad", "beforeUpdate"], ["afterLoad", "beforeDelete"]]);
    });

    it("auto validate before insert", async () => {
        const entity = repository1.create({name: "abcd"});
        await assertAsyncError(async () => {
            await repository1.insert(entity);
        }, {message: /name must be longer than or equal/});
    });
});
