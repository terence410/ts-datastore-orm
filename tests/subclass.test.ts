import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src";
// @ts-ignore
import {beforeCallback} from "./share";

export class SubClassBase extends BaseEntity {
    @Column({index: true})
    public createdAt: Date = new Date();
}

export class IntermediateClass extends SubClassBase {
    @Column({index: true})
    public updatedAt: Date = new Date();
}

@Entity({namespace: "testing", kind: "subClass"})
export class SubClass extends IntermediateClass {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";
}

// before test
before(beforeCallback);

describe("Subclass Test", () => {
    it("truncate", async () => {
        await SubClass.truncate();
    });

    it("create entity", async () => {
        const [entity] = await SubClass.create({name: "Terence", createdAt: new Date(1234)}).save();
        const [newEntity] = await SubClass.find(entity.id);
        if (newEntity) {
            assert.containsAllKeys(newEntity.getValues(), ["createdAt", "updatedAt"]);
        }

        entity.set("createdAt", new Date());
        entity.set("updatedAt", new Date());
        assert.isNumber(entity.get("createdAt").getTime());
        assert.isNumber(entity.get("updatedAt").getTime());

        const [entities1] = await SubClass.query().order("createdAt", {descending: true}).run();
        assert.equal(entities1.length, 1);

        const [entities2] = await SubClass.query().order("updatedAt", {descending: true}).run();
        assert.equal(entities2.length, 1);
    });
});
