import { assert, expect } from "chai";
import {Field} from "../src/decorators/Field";
import {Entity} from "../src/decorators/Entity";
import {BaseEntity} from "../src/BaseEntity";
import {Repository} from "../src/Repository";
// @ts-ignore
import {connection, beforeCallback} from "./share";

export class SubClassBase extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public createdAt: Date = new Date();

    @Field()
    public updatedAt: Date = new Date();
}

@Entity({namespace: "testing"})
export class IntermediateClass extends SubClassBase {
    public name: string = "";
}

@Entity({namespace: "testing", kind: "subClass"})
export class SubClass extends IntermediateClass {
    @Field({generateId: true})
    public _id: number = 0;

    // override to have index
    @Field({index: true})
    public updatedAt: Date = new Date();

    @Field()
    public name: string = "";
}

before(beforeCallback);
describe("Subclass Test", () => {
    let repository1: Repository<typeof SubClass>;
    before(() => {
        repository1 = connection.getRepository(SubClass);
    });
    after(() => repository1.truncate());

    it("create entity", async () => {
        const entity = await repository1.create({name: "Terence", createdAt: new Date(1234)});
        await repository1.insert(entity);

        const findEntity = await repository1.findOne(entity._id);
        assert.containsAllKeys(findEntity!, ["createdAt", "updatedAt"]);
        assert.isNumber(findEntity!.createdAt.getTime());
        assert.isNumber(findEntity!.updatedAt.getTime());

        // check if indexing works
        const entities1 = await repository1.query()
            .order("createdAt", {descending: true})
            .findMany();
        assert.equal(entities1.length, 1);

        const entity2 = await repository1
            .query().
            order("updatedAt", {descending: true})
            .findOne();
        assert.isDefined(entity2);
    });
});
