import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src";

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

// casts

function mergeObjectStrictRecursive(value: any, newValue: any) {
    for (const key of Object.keys(value)) {
        if (typeof value[key] === "object" && typeof newValue[key] === "object") {
            mergeObjectStrictRecursive(value[key], newValue[key]);
        } else if (key in newValue) {
            value[key] = newValue[key];
        }
    }
}

function mergeObjectRecursive(value: any, newValue: any) {
    for (const key of Object.keys(newValue)) {
        if (typeof value[key] === "object" && typeof newValue[key] === "object") {
            mergeObjectRecursive(value[key], newValue[key]);
        } else if (key in newValue) {
            value[key] = newValue[key];
        }
    }
}

function mergeObjectStrict(newValue: any, oldValue: any) {
    if (typeof oldValue === "object" && typeof newValue === "object") {
        mergeObjectStrictRecursive(oldValue, newValue);
        return oldValue;

    } else if (typeof oldValue === "object") {
        return oldValue;
    }

    return newValue;
}

function mergeObject(newValue: any, oldValue: any) {
    if (typeof oldValue === "object" && typeof newValue === "object") {
        mergeObjectRecursive(oldValue, newValue);
        return oldValue;

    } else if (typeof oldValue === "object") {
        return oldValue;
    }

    return newValue;
}

function mergeArrayObjectInternal(defaultValue: any, newValues: any[], oldValues: any[]): any[] | undefined {
    if (Array.isArray(newValues)) {
        for (let i = 0; i < newValues.length; i++) {
            newValues[i] = mergeObject(newValues[i], defaultValue);
        }
        return newValues;

    } else if (Array.isArray(oldValues)) {
        return oldValues;
    }

    return [];
}

function mergeArrayObject(defaultValue: object): any {
    return mergeArrayObjectInternal.bind(null, defaultValue);
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
    public date?: Date;

    @Column({cast: mergeObject})
    public mergeObject: IUnionObject = {name: "Terence", age: 10, home: {country: "hk", district: "island"}};

    @Column({cast: mergeObjectStrict})
    public mergeObjectStrict: IUnionObject = {name: "Terence", age: 10, home: {country: "hk", district: "island"}};

    @Column({cast: mergeArrayObject({name: "Terence", age: 10, home: {country: "hk", district: "island"}})})
    public mergeArrayObject: IUnionObject[] = [];
}

const validate = (entity: Cast) => {
    assert.equal(typeof entity.string, "string");
    assert.equal(typeof entity.number, "number");
    assert.equal(typeof entity.boolean, "boolean");
    assert.equal(typeof entity.date, "object");
    assert.isTrue(entity.date instanceof Date);
};

const values = {
    string: 12345,
    number: Math.random().toString(),
    date: new Date().getTime(),
    boolean: 10,
    mergeObject: {},
    mergeObjectStrict: {},
    mergeArrayObject: [],
};

describe("Cast Test", () => {
    it("truncate", async () => {
        await Cast.truncate();
    });

    it("truncate", async () => {
        const input = {date: (new Date()).toDateString(), id: 123};
        console.log(input);
        await Cast.create(input as any).save();
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
        const newObject = {name: "Anonymous", skin: "yellow", home: {country: "uk", streetNo: 10}};
        const entity1 = Cast.create();
        (entity1 as any)._data.mergeObject = newObject;
        (entity1 as any)._data.mergeObjectStrict = newObject;
        (entity1 as any)._data.mergeArrayObject = [newObject];
        await entity1.save();

        const [foundEntity] = await Cast.find(entity1.id);
        assert.isDefined(foundEntity);
        if (foundEntity) {
            // value is overrided
            assert.equal(foundEntity.mergeObject.name, newObject.name);
            assert.equal(foundEntity.mergeObject.skin, newObject.skin);
            assert.equal(foundEntity.mergeObject.home.streetNo, newObject.home.streetNo);

            // won't have the value in strict
            assert.equal(foundEntity.mergeObjectStrict.name, newObject.name);
            assert.isUndefined(foundEntity.mergeObjectStrict.skin);
            assert.isUndefined(foundEntity.mergeObjectStrict.home.streetNo);

            // array object
            assert.equal(foundEntity.mergeArrayObject[0].name, newObject.name);
            assert.equal(foundEntity.mergeArrayObject[0].skin, newObject.skin);
            assert.equal(foundEntity.mergeArrayObject[0].home.streetNo, newObject.home.streetNo);
        }
    });
});
