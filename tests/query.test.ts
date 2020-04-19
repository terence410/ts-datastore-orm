import { assert, expect } from "chai";
import {BaseEntity, Column, datastoreOrm, Entity} from "../src";
import {Batcher} from "../src/Batcher";
import {CompositeIndex} from "../src/decorators/CompositeIndex";
import {IEntityCompositeIndexes} from "../src/types";
// @ts-ignore
import {beforeCallback} from "./share";

@CompositeIndex({id: "desc"})
@CompositeIndex({date1: "desc", string1: "asc"})
@CompositeIndex({string1: "asc", ["object1.string"]: "desc"})
@Entity({namespace: "testing", kind: "queryTest"})
export class QueryTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public date1: Date = new Date();

    @Column()
    public date2: Date = new Date();

    @Column({index: true})
    public nullableDate: Date | null = null;

    @Column({index: true})
    public string1: string = "";

    @Column()
    public string2: string = "";

    @Column({index: true})
    public number1: number = 0;

    @Column()
    public number2: number = 0;

    @Column()
    public buffer: Buffer = Buffer.alloc(1);

    @Column({index: true})
    public array1: number[] = [];

    @Column()
    public array2: number[] = [];

    @Column({index: true})
    public object1: {string?: string, value?: number} = {};

    @Column({index: true, excludeFromIndexes: ["object2.value"]})
    public object2: {string?: string, value?: number} = {};

    @Column({index: true, excludeFromIndexes: ["objectArray1[].value"]})
    public objectArray1: Array<{string: string, value: number}> = [];
}

@CompositeIndex({number: "desc", string: "desc", __ancestor__: false})
@CompositeIndex({number: "desc"})
@Entity({namespace: "testing", kind: "queryTestChild", ancestor: QueryTest})
export class QueryTestChild extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public number: number = 0;

    @Column({index: true})
    public string: string = "";
}

const total = 50;

// before test
before(beforeCallback);

describe("Query Test", () => {
    it("truncate", async () => {
        await QueryTest.truncate();
        await QueryTestChild.truncate();
    });

    it("create entities", async () => {
        const entities: QueryTest[] = [];
        for (let i = 0; i < total; i++) {
            const entity = new QueryTest();
            entity.date1 = new Date();
            entity.date2 = entity.date1;
            entity.number2 = Math.random();
            entity.number1 = i;
            entity.number2 = Math.random();
            entity.string1 = i.toString();
            entity.string2 = entity.number2.toString();
            entity.array1 = [1, 2, 3, 4, 5];
            entity.array2 = [1, 2, 3, 4, 5];
            entity.object1 = {string: i.toString(), value: i};
            entity.object2 = {string: i.toString(), value: i};
            entity.objectArray1 = [{string: i.toString(), value: i}];
            entities.push(entity);
        }
        const batcher = new Batcher();
        await batcher.save(entities);
    });

    it("query: non index", async () => {
        const number2 = 4;
        const [entities1] = await QueryTest.query()
            .filter("number2", ">", number2)
            .run();
        assert.equal(entities1.length, 0);

        const [entities2] = await QueryTest.query()
            .order("number2", {descending: true})
            .run();
        assert.equal(entities1.length, 0);
    });

    it("query: simple", async () => {
        const number1 = 4;
        const query = QueryTest.query()
            .filter("number1", ">", number1)
            .limit(5);

        let count = 0;
        while (query.hasNextPage()) {
            const [entities] = await query.run();
            count += entities.length;
        }

        assert.equal(count, total - number1 - 1);
    });

    it("query: with end cursor", async () => {
        const number1 = 4;
        const query1 = QueryTest.query()
            .filter("number1", ">", number1)
            .limit(5);

        const [entities1] = await query1.run();
        const endCursor = query1.getEndCursor();
        assert.isTrue(query1.hasNextPage());
        assert.isNotEmpty(endCursor);

        // we continue to run with cursor
        const query2 = QueryTest.query()
            .filter("number1", ">", number1)
            .setEndCursor(endCursor)
            .limit(5);

        const [entities2] = await query2.run();
        assert.isTrue(query2.hasNextPage());
        assert.notEqual(query2.getEndCursor(), endCursor);

        // run till the end
        while (query2.hasNextPage()) {
            await query2.run();
        }
        assert.isFalse(query2.hasNextPage());
        const finalEndCursor = query2.getEndCursor();
        assert.isString(endCursor);

        // try to use the final cursor
        const query3 = QueryTest.query()
            .filter("number1", ">", number1)
            .setEndCursor(finalEndCursor)
            .limit(5);

        const [entities3] = await query3.run();
        assert.equal(entities3.length, 0);
        assert.isFalse(query3.hasNextPage());
    });

    it("query: order", async () => {
        const number1 = 4;

        // descending
        const [entity1] = await QueryTest.query()
            .order("number1", {descending: true})
            .runOnce();

        assert.isDefined(entity1);
        if (entity1) {
            assert.equal(entity1.number1, total - 1);
        }

        // offset
        const offset1 = 5;
        const [entity2] = await QueryTest.query()
            .order("number1", {descending: false})
            .offset(offset1)
            .runOnce();

        assert.isDefined(entity2);
        if (entity2) {
            assert.equal(entity2.number1, offset1);
        }
    });

    it("query: array", async () => {
        const [entity] = await QueryTest.query()
            .filterAny("array1", "=", 1)
            .filterAny("array1", 2)
            .runOnce();
        assert.isDefined(entity);
    });

    it("query: object", async () => {
        // object1.string is indexed
        const [entity1] = await QueryTest.query()
            .filterAny("object1.value", 0)
            .runOnce();
        assert.isDefined(entity1);

        const [entity2] = await QueryTest.query()
            .orderAny("object1.value", {descending: true})
            .runOnce();
        assert.isDefined(entity2);
        if (entity2) {
            assert.equal(entity2.object1.value, total - 1);
        }

        // object2.value is excluded from index
        const [entity3] = await QueryTest.query()
            .filterAny("object2.value", 0)
            .runOnce();
        assert.isUndefined(entity3);
    });

    it("query: object array", async () => {
        // object1[].string is indexed
        const [entity1] = await QueryTest.query()
            .filterAny("objectArray1.string", "0")
            .runOnce();
        assert.isDefined(entity1);
        if (entity1) {
            assert.equal(entity1.objectArray1[0].string, "0");
        }

        // object1[].value is not indexed
        const [entity2] = await QueryTest.query()
            .filterAny("objectArray1.value", "=", 0)
            .runOnce();
        assert.isUndefined(entity2);
    });

    it("query: key only", async () => {
        const [entity] = await QueryTest.query()
            .selectKey()
            .runOnce();
        assert.isDefined(entity);
        
        if (entity) {
            entity.number1 = 10;
            try {
                await entity.save();
                assert.isTrue(false);
            } catch (err) {
                assert.isTrue(/Entity is read only/.test(err.message));
            }
        }
    });

    it("query: stream", async () => {
        const number1 = 4;
        const query = QueryTest
            .query()
            .filter("number1", ">", number1)
            .limit(5);

        let count = 0;
        for (let i = 0; i < 100 && query.hasNextPage(); i++) {
            await new Promise((resolve, reject) => {
                const stream = query.runStream()
                    .on("data", entity => {
                        count += 1;
                    })
                    .on("info", (info) => {
                        // query info from datastore
                    })
                    .on("error", (error) => {
                        assert.isTrue(false);
                        reject(error);
                    })
                    .on("end", () => {
                        resolve();
                    });
            });
        }

        assert.equal(count, total - number1 - 1);
    });

    it("query: ancestor", async () => {
        const [queryTest1] = await new QueryTest().save();

        // ancestor of diff type
        const [queryTestChild1] = await new QueryTestChild()
            .setAncestor(queryTest1)
            .save();

        // query without ancestor
        const [queryTestChild2] = await QueryTestChild
            .query()
            .filter("id", queryTestChild1.id)
            .runOnce();
        assert.isUndefined(queryTestChild2);

        // query with diff ancestor
        const [queryTestChild4] = await QueryTestChild
            .query()
            .setAncestor(queryTest1)
            .filter("id", "=", queryTestChild1.id)
            .runOnce();
        assert.isDefined(queryTestChild4);

        // get back the ancestor
        const [ancestor1] = await queryTestChild1.getAncestor(QueryTest);
        assert.isDefined(ancestor1);
        if (ancestor1) {
            assert.isTrue(ancestor1 instanceof QueryTest);
        }
    });

    it("query: sql 1", async () => {
        const entity = QueryTest.create({nullableDate: null});
        await entity.save();
        const query = QueryTest.query().filter("nullableDate", null);
        assert.equal(query.getSQL(), "SELECT * from `queryTest` WHERE nullableDate = null");
    });

    it("query: sql 2", async () => {
        const [queryTest1] = await new QueryTest().save();

        // ancestor of diff type
        const [queryTestChild1] = await new QueryTestChild()
            .setAncestor(queryTest1)
            .save();

        const query = QueryTestChild
            .query()
            .filter("id", ">=", queryTestChild1.id)
            .setAncestor(queryTest1);
        const [entity] = await query.runOnce();
        assert.isDefined(entity);
    });

    it("query: sql", async () => {
        const [queryTestChild] = await QueryTestChild.query().runOnce();

        if (queryTestChild) {
            const [ancestor] = await queryTestChild.getAncestor(QueryTest);
            const query = QueryTestChild.query()
                .filterKey(queryTestChild.getKey())
                .setAncestor(ancestor as any)
                .selectKey()
                .groupByAny("string")
                .order("number", {descending: true})
                .offset(0)
                .limit(100);
            const sql = query.getSQL();
            assert.match(sql, /SELECT/);
        }
    });

    it("query: sql", async () => {
        const sql = QueryTestChild.query().filter("id", 1).getSQL();
        assert.equal(sql,
            "SELECT * from `queryTestChild` WHERE __key__ = Key(Namespace(\"testing\"), queryTestChild, 1)");
    });

    it("export composite index", async () => {
        const filename = "./index.yaml";
        datastoreOrm.exportCompositeIndexes(filename, [QueryTest, QueryTestChild]);
    });
});
