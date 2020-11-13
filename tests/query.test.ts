import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import { assert, expect } from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {Repository} from "../src/Repository";
// @ts-ignore
import {assertAsyncError, beforeCallback, connection} from "./share";

@Entity({namespace: "testing"})
class QueryTest extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public date1: Date = new Date();

    @Field()
    public date2: Date = new Date();

    @Field({index: true})
    public boolean1: boolean = false;

    @Field({index: true})
    public nullableDate: Date | null = null;

    @Field({index: true})
    public string1: string = "";

    @Field()
    public string2: string = "";

    @Field({index: true})
    public mod: number = 0;

    @Field({index: true})
    public number1: number = 0;

    @Field()
    public number2: number = 0;

    @Field({index: true})
    public buffer: Buffer = Buffer.alloc(1);

    @Field({index: true})
    public array1: number[] = [];

    @Field()
    public array2: number[] = [];

    @Field({index: true})
    public object1: {string?: string, value?: number} = {};

    @Field({index: true, excludeFromIndexes: ["object2.value"]})
    public object2: {string?: string, value?: number} = {};

    @Field({index: true, excludeFromIndexes: ["objectArray1[].value"]})
    public objectArray1: Array<{string: string, value: number}> = [];
}

@Entity({namespace: "testing"})
export class QueryTestChild extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public number: number = 0;

    @Field({index: true})
    public string: string = "";
}

const total = 50;
const mod = 10;

// before test
before(beforeCallback);
describe("Query Test", () => {
    let entityRepository: Repository<typeof QueryTest>;
    let childRepository: Repository<typeof QueryTestChild>;

    before(() => {
        entityRepository = connection.getRepository(QueryTest);
        childRepository = connection.getRepository(QueryTestChild);
    });
    after(async () => {
        await entityRepository.truncate();
        await childRepository.truncate();
    });

    before("create entities", async () => {
        const entities: QueryTest[] = [];
        for (let i = 0; i < total; i++) {
            const entity = new QueryTest();
            entity.date1 = new Date();
            entity.date2 = entity.date1;
            entity.boolean1 = Math.random() > 0.5;
            entity.mod = i % mod;
            entity.number2 = Math.random();
            entity.number1 = i;
            entity.number2 = Math.random();
            entity.string1 = i.toString();
            entity.string2 = entity.number2.toString();
            entity.buffer = Buffer.from([i]);
            entity.array1 = [1, 2, 3, 4, 5];
            entity.array2 = [1, 2, 3, 4, 5];
            entity.object1 = {string: i.toString(), value: i};
            entity.object2 = {string: i.toString(), value: i};
            entity.objectArray1 = [{string: i.toString(), value: i}];
            entities.push(entity);
        }
        await entityRepository.insert(entities);
    });

    it("no index", async () => {
        const value = 4;
        const entities1 = await entityRepository.query()
            .filter("number2", x => x.lt(value))
            .findMany();
        assert.equal(entities1.length, 0);

        const entities2 = await entityRepository.query()
            .order("number2", {descending: true})
            .findMany();
        assert.equal(entities2.length, 0);

        const entities3 = await entityRepository.query()
            .order("number1", {descending: true})
            .findMany();
        assert.equal(entities3.length, total);
    });

    it("findOne with paging", async () => {
        const number1 = 4;
        const query = entityRepository.query()
            .filter("number1", x => x.gt(number1))
            .limit(5);

        let count = 0;
        while (query.hasNextPage()) {
            const entity = await query.findOne();
            count += 1;
        }

        assert.equal(count, total - number1 - 1);
    });

    it("findMany with paging", async () => {
        const number1 = 4;
        const query = entityRepository.query()
            .filter("number1", x => x.gt(number1))
            .limit(5);

        let count = 0;
        while (query.hasNextPage()) {
            const entities = await query.findMany();
            count += entities.length;
        }

        assert.equal(count, total - number1 - 1);
    });

    it("endCursor", async () => {
        const number1 = 4;
        const limit = 5;
        const query1 = entityRepository.query()
            .filter("number1", x => x.gt(number1))
            .limit(limit);

        const entities1 = await query1.findMany();
        const endCursor = query1.getEndCursor();
        assert.isTrue(query1.hasNextPage());
        assert.isNotEmpty(endCursor);

        // we continue to run with cursor
        const query2 = entityRepository.query()
            .filter("number1", x => x.gt(number1))
            .setEndCursor(endCursor!)
            .limit(limit);

        const entities2 = await query2.findMany();
        assert.isTrue(query2.hasNextPage());
        assert.notEqual(query2.getEndCursor(), endCursor);

        // run till the end
        while (query2.hasNextPage()) {
            await query2.findMany();
        }
        assert.isFalse(query2.hasNextPage());
        const finalEndCursor = query2.getEndCursor();
        assert.isString(endCursor);

        // try to use the final cursor
        const query3 = entityRepository.query()
            .filter("number1", x => x.gt(number1))
            .setEndCursor(finalEndCursor!)
            .limit(limit);

        const entities3 = await query3.findMany();
        assert.equal(entities3.length, 0);
        assert.isFalse(query3.hasNextPage());
    });

    it("filter: date", async () => {
        const query = entityRepository.query()
            .filter("date1", x => x.lt(new Date()));
        const entity1 = await query.findOne();
        assert.isDefined(entity1);
        assert.match(query.getSql(), /DATETIME/);
    });

    it("filter: boolean", async () => {
        const query = entityRepository.query()
            .filter("boolean1", true);
        const entity1 = await query.findOne();
        assert.isDefined(entity1);
        assert.match(query.getSql(), /true/);
    });

    it("filter: buffer", async () => {
        const query = entityRepository.query()
            .filter("buffer", x => x.gt(Buffer.from([1])));
        const entity1 = await query.findOne();
        assert.isDefined(entity1);
        assert.match(query.getSql(), /BLOB/);
    });

    it("order", async () => {
        const number1 = 4;

        // descending
        const entity1 = await entityRepository.query()
            .order("number1", {descending: true})
            .findOne();

        assert.isDefined(entity1);
        if (entity1) {
            assert.equal(entity1.number1, total - 1);
        }

        // offset
        const offset1 = 5;
        const entity2 = await entityRepository.query()
            .order("number1", {descending: false})
            .offset(offset1)
            .findOne();

        assert.isDefined(entity2);
        if (entity2) {
            assert.equal(entity2.number1, offset1);
        }
    });

    it("filter array", async () => {
        const entity = await entityRepository.query()
            .filter("array1", 1)
            .filter("array1", x => x.eq(2))
            .findOne();
        assert.isDefined(entity);
    });

    it("object.value", async () => {
        // object1.string is indexed
        const entity1 = await entityRepository.query({weakType: true})
            .filter("object1.value", 0)
            .findOne();
        assert.isDefined(entity1);

        const entity2 = await entityRepository.query({weakType: true})
            .order("object1.value", {descending: true})
            .findOne();
        assert.isDefined(entity2);
        if (entity2) {
            assert.equal(entity2.object1.value, total - 1);
        }

        // object2.value is excluded from index
        const entity3 = await entityRepository.query({weakType: true})
            .filter("object2.value", 0)
            .findOne();
        assert.isUndefined(entity3);
    });

    it("query: object array", async () => {
        // object1[].string is indexed
        const entity1 = await entityRepository.query({weakType: true})
            .filter("objectArray1.string", "0")
            .findOne();
        assert.isDefined(entity1);
        if (entity1) {
            assert.equal(entity1.objectArray1[0].string, "0");
        }

        // object1[].value is not indexed
        const entity2 = await entityRepository.query({weakType: true})
            .filter("objectArray1.value", 0)
            .findOne();
        assert.isUndefined(entity2);
    });

    it("key only query", async () => {
        const query = entityRepository.selectKeyQuery();
        const key1 = await query
            .findOne();
        assert.isDefined(key1);
        assert.isTrue(key1!.constructor === DatastoreEntity.entity.Key);
        assert.match(query.getSql(), /SELECT __key__/);

        const keys1 = await entityRepository.selectKeyQuery().findMany();
        assert.equal(keys1.length, total);

        const iterator = entityRepository.selectKeyQuery().getAsyncIterator();
        for await (const keys of iterator) {
            assert.isArray(keys);
        }
    });

    it("groupBy (need index)", async () => {
        const entities = await entityRepository.query().groupBy("mod").findMany();
        assert.equal(entities.length, mod);
    });

    it("ancestor", async () => {
        const entity1 = await entityRepository.insert(new QueryTest());

        // ancestor of diff type
        const child1 = new QueryTestChild();
        child1._ancestorKey = entity1.getKey();
        await childRepository.insert(child1);

        // query without ancestor
        const findChild1 = await childRepository
            .query()
            .filter("_id", child1._id)
            .findOne();
        assert.isUndefined(findChild1);

        // query with diff ancestor
        const findChild2 = await childRepository
            .query()
            .setAncestorKey(entity1.getKey())
            .filter("_id", child1._id)
            .findOne();
        assert.isDefined(findChild2);
        assert.isDefined(findChild2!._ancestorKey);

        // get back the ancestor
        const findEntity1 = await entityRepository.findOne(findChild2!._ancestorKey!);
        assert.isDefined(findEntity1);
        if (findEntity1) {
            assert.isTrue(findEntity1 instanceof QueryTest);
        }
    });

    it("error: invalid cursor", async () => {
        await assertAsyncError(async () => {
            const query = await entityRepository.query().setEndCursor("hello").findMany();
        }, {message: /invalid encoding/});

        await assertAsyncError(async () => {
            const iterator = entityRepository.selectKeyQuery().setEndCursor("hello").getAsyncIterator();
            for await (const entities of iterator) {
                //
            }
        }, {message: /invalid encoding/});
    });

    it("sql 1", async () => {
        const query = entityRepository.query().filter("nullableDate", null);
        assert.equal(query.getSql(), "SELECT * from `QueryTest` WHERE nullableDate = null");
    });

    it("sql 2", async () => {
        const entity = await entityRepository.create();

        const query = childRepository.query()
            .filter("_id", 1)
            .setAncestorKey(entity.getKey())
            .groupBy("string")
            .order("number", {descending: true})
            .offset(0)
            .limit(100);
        const sql = query.getSql();
        assert.equal(sql, "SELECT  DISTINCT ON (string) * from `QueryTestChild` WHERE __key__ = Key(Namespace(\"testing\"), QueryTestChild, 1) AND __key__ HAS ANCESTOR Key(Namespace(\"testing\"), QueryTest, \"0\") ORDER BY number DESC LIMIT 100");
    });

    it("sql 3", async () => {
        const sql = childRepository.query().filter("_id", 1).getSql();
        assert.equal(sql,
            "SELECT * from `QueryTestChild` WHERE __key__ = Key(Namespace(\"testing\"), QueryTestChild, 1)");
    });
});
