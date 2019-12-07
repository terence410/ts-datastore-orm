import { assert, expect } from "chai";
import {RelationshipHelper} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Batcher} from "../src/Batcher";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {IncrementHelper} from "../src/helpers/IncrementHelper";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";

@Entity({namespace: "testing", kind: "increment"})
export class Increment extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public total1: number = 0;

    @Column({index: true})
    public total2: number = 0;
}

@Entity({namespace: "testing", kind: "incrementChild", ancestors: Increment})
export class IncrementChild extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public value: number = 0;
}

describe("Helper Test: Increment", () => {
    it("truncate", async () => {
        const [total, requestResponse] = await Increment.truncate();
    });

    it("retry auto increment", async () => {
        const loop = 5;
        const maxRetry = 3;
        const entity = Increment.create({id: 0});
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

        // we must at least half of the retry happened
        assert.isAtLeast(totalRetry, loop / 2);
        assert.equal(entity.total1, loop);
        assert.equal(entity.total2, loop);
    });

    it("massive auto increment", async () => {
        const loop = 5;
        const total = 50;

        const entities = Array(total).fill(0).map(x => Increment.create({total1: 0}));
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
    it("truncate", async () => {
        const [total, requestResponse] = await IncrementChild.truncate();
    });

    it("getOne", async () => {
        const [entity] = await Increment.create().save();
        const relationshipHelper = new RelationshipHelper(entity);

        const [entity1] = await relationshipHelper.get(IncrementChild);
        assert.isUndefined(entity1);

        const [entity2] = await relationshipHelper.getOrCreate(IncrementChild, {value: 500});
        assert.isDefined(entity2);
        assert.isNumber(entity2.id);

        const [entity3] = await relationshipHelper.get(IncrementChild);
        assert.isDefined(entity3);
    });

    it("getMany", async () => {
        const [entity] = await Increment.create().save();
        const relationshipHelper = new RelationshipHelper(entity);
        const [entities1] = await relationshipHelper.getMany(IncrementChild);
        assert.equal(entities1.length, 0);

        const [incrementChild] = await IncrementChild.create({value: 500}).setAncestor(entity).save();
        const [entities2] = await relationshipHelper.getMany(IncrementChild);
        assert.equal(entities2.length, 1);
    });
});
