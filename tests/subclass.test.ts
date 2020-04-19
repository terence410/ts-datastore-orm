import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src";
// @ts-ignore
import {beforeCallback} from "./share";

export class SubClassBase extends BaseEntity {
    @Column({index: true})
    public createdAt: Date = new Date();
}

@Entity({namespace: "testing", kind: "subClass"})
export class SubClass extends SubClassBase {
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
        entity.set("createdAt", new Date());
        const date = entity.get("createdAt");
        const getTime = date.getTime();

        const [entities] = await SubClass.query().order("createdAt", {descending: true}).run();
        assert.equal(entities.length, 1);
    });
});
