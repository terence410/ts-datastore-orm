import { assert, expect } from "chai";
import {DescendentHelper} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Batcher} from "../src/Batcher";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {EntityHelper} from "../src/helpers/EntityHelper";
import {IncrementHelper} from "../src/helpers/IncrementHelper";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";
import {timeout} from "../src/utils";

@Entity({namespace: "testing", kind: "helper"})
export class Helper extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public total1: number = 0;

    @Column({index: true})
    public total2: number = 0;
}

@Entity({namespace: "testing", kind: "helperChild", ancestor: Helper})
export class HelperChild extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public value: number = 0;
}

describe("Helper Test: Truncate", () => {
    it("truncate", async () => {
        await Helper.truncate();
        await HelperChild.truncate();
    });
});

describe("Helper Test: Increment", () => {
    it("retry auto increment", async () => {
        const loop = 5;
        const maxRetry = 3;
        const entity = Helper.create({id: 0});
        await entity.save();
        let totalRetry = 0;

        for (let i = 0; i < loop; i++) {
            const incrementHelper = new IncrementHelper(entity);
            const results = await Promise.all([
                incrementHelper.increment("total1", 1, {maxRetry}),
                incrementHelper.increment("total2", 1, {maxRetry}),
            ]);
            totalRetry += results[0][1].totalRetry;
            totalRetry += results[1][1].totalRetry;
            assert.equal(results[0][0], i + 1);
            assert.equal(results[1][0], i + 1);
        }

        // we must have some retry
        assert.equal(entity.total1, loop);
        assert.equal(entity.total2, loop);
    });

    it("massive auto increment", async () => {
        const loop = 5;
        const total = 50;

        const entities = Array(total).fill(0).map(x => Helper.create({total1: 0}));
        const batcher = new Batcher();
        await batcher.saveMany(entities);

        for (let i = 0; i < loop; i++) {
            const performanceHelper = new PerformanceHelper().start();
            const promises = entities.map(x => {
                const incrementHelper = new IncrementHelper(x);
                return incrementHelper.increment("total1");
            });

            const results = await Promise.all(promises);
            const totalSum = results.map(x => x[0]).reduce((a, b) => a + b, 0);
            const maxExecutionTime = results.reduce((a, b) => Math.max(a, b[1].executionTime), 0);
            assert.equal(totalSum, total * (i + 1));
        }
    });
});

describe("Helper Test: Relationship", () => {
    it("findOne", async () => {
        const [entity1] = await Helper.create().save();
        const descendentHelper = new DescendentHelper(entity1);

        const [entityChild1] = await descendentHelper.findOne(HelperChild);
        assert.isUndefined(entityChild1);

        const [entityChild2] = await HelperChild.create({value: 500}).setAncestor(entity1).save();
        const [entityChild3] = await descendentHelper.findOne(HelperChild);
        assert.isDefined(entityChild3);
        if (entityChild3) {
            assert.equal(entityChild2.id, entityChild3.id);
        }
    });

    it("findMany", async () => {
        const [entity] = await Helper.create().save();
        const descendentHelper = new DescendentHelper(entity);
        const [entities1] = await descendentHelper.findMany(HelperChild);
        assert.equal(entities1.length, 0);

        const [incrementChild] = await HelperChild.create({value: 500}).setAncestor(entity).save();
        const [entities2] = await descendentHelper.findMany(HelperChild);
        assert.equal(entities2.length, 1);
    });
});

describe("Helper Test: Entity", () => {
    it("findOrCreate", async () => {
        const id = 1001;
        const [ancestor] = await Helper.create().save();

        const entityHelper = new EntityHelper(HelperChild);
        const callback = async () => {
            const value = Math.random() * 1000 | 0;
            return entityHelper.findOrCreate({id, value}, ancestor);
        };

        // we load the same entity many times
        const total = 100;
        const promises = Array(total).fill(0).map((x => callback()));
        const results = await Promise.all(promises);
        assert.equal(results.length, total);

        // all values are the same
        const value1 = results[0][0].value;
        assert.isTrue(results.every(x => x[0].value === value1));
    });
});
