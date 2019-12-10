import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src";

function customCast(value: any) {
    if (Array.isArray(value) || value === 10) {
        return 10;
    } else {
        return -10;
    }
}

@Entity({kind: "cast"})
export class Cast extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({cast: String})
    public string: string = "";

    @Column({cast: Number})
    public number: number = 0;

    @Column({cast: Boolean})
    public boolean: boolean = false;

    @Column({cast: Date})
    public date: Date = new Date();

    @Column({cast: customCast})
    public custom1: any = "";

    @Column({cast: customCast})
    public custom2: any = "";
}

const validate = (entity: Cast) => {
    assert.equal(typeof entity.string, "string");
    assert.equal(typeof entity.number, "number");
    assert.equal(typeof entity.boolean, "boolean");
    assert.equal(typeof entity.date, "object");
    assert.isTrue(entity.date instanceof Date);
    assert.equal(entity.custom1, 10);
    assert.equal(entity.custom2, -10);
};

const values = {
    string: 12345,
    number: Math.random().toString(),
    date: new Date().getTime(),
    boolean: 10,
    custom1: [1, 3, 3],
    custom2: {value: 10},
};

describe("Cast Test", () => {
    it("truncate", async () => {
        await Cast.truncate();
    });

    it("Create and find entity", async () => {
        const entity1 = Cast.create(values as any);
        await entity1.save();
        validate(entity1);

        const [foundEntity] = await Cast.find(entity1.id);
        assert.isDefined(foundEntity);
        if (foundEntity) {
            validate(foundEntity);
        }
    });

    it("Force invalid date and validate casting", async () => {
        const entity1 = Cast.create();
        (entity1 as any)._data = values;
        assert.deepEqual(entity1.getValues(), Object.assign(values, {id: 0}) as any);
        await entity1.save();

        const [foundEntity] = await Cast.find(entity1.id);
        assert.isDefined(foundEntity);
        if (foundEntity) {
            validate(foundEntity);
        }
    });

});
