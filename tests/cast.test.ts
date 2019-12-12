import { assert, expect } from "chai";
import {BaseEntity, casts, Column, Entity} from "../src";

function customCast(newValue: any, oldValue: any) {
    if (Array.isArray(newValue) || newValue === 10) {
        return 10;
    } else {
        return -10;
    }
}

type IUnionObject = {
    name: string;
    age: number;
    skin?: string;
    home: {
        country: string,
        district: string,
        streetNo?: number,
    },
};

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

    @Column({cast: casts.mergeObject})
    public mergeObject: IUnionObject = {name: "Terence", age: 10, home: {country: "hk", district: "island"}};

    @Column({cast: casts.mergeObjectStrict})
    public mergeObjectStrict: IUnionObject = {name: "Terence", age: 10, home: {country: "hk", district: "island"}};

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
    mergeObject: {},
    mergeObjectStrict: {},
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

    it("merge object", async () => {
        const mergeObject = {name: "Anonymous", skin: "yellow", home: {country: "uk", streetNo: 10}};
        const entity1 = Cast.create();
        (entity1 as any)._data.mergeObject = mergeObject;
        (entity1 as any)._data.mergeObjectStrict = mergeObject;
        await entity1.save();

        const [foundEntity] = await Cast.find(entity1.id);
        assert.isDefined(foundEntity);
        if (foundEntity) {
            // value is overrided
            assert.equal(foundEntity.mergeObject.name, mergeObject.name);
            assert.equal(foundEntity.mergeObject.skin, mergeObject.skin);
            assert.equal(foundEntity.mergeObject.home.streetNo, mergeObject.home.streetNo);

            // won't have the value in strict
            assert.equal(foundEntity.mergeObjectStrict.name, mergeObject.name);
            assert.isUndefined(foundEntity.mergeObjectStrict.skin);
            assert.isUndefined(foundEntity.mergeObjectStrict.home.streetNo);
        }
    });
});
