import { assert, expect } from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {Repository} from "../src/Repository";
// @ts-ignore
import {assertAsyncError, assertTsDatastoreOrmError, initializeConnection, connection} from "./share";

@Entity()
export class IncrementHelper extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public total1: number = 0;

    @Field({index: true})
    public total2: number = 0;

    @Field({index: true})
    public string1: string = "";
}

before(initializeConnection);
describe("Helper Test: Increment", () => {
    let repository: Repository<typeof IncrementHelper>;

    before(() => {
        repository = connection.getRepository(IncrementHelper);
    });
    after(async () => {
        await repository.truncate();
    });

    it("retry auto increment", async () => {
        const loop = 5;

        // create entity
        const entity = repository.create();
        await repository.insert(entity);

        // prepare helper
        const incrementHelper = repository.getIncrementHelper({maxRetry: 2, retryDelay: 500});
        for (let i = 0; i < loop; i++) {
            const results = await Promise.all([
                incrementHelper.increment(entity._id, "total1", 1),
                incrementHelper.increment(entity._id, "total2", 1),
            ]);
            assert.equal(results[0], i + 1);
            assert.equal(results[1], i + 1);
        }

        // we must have some retry
        const findEntity = await repository.findOne(entity._id);
        assert.equal(findEntity!.total1, loop);
        assert.equal(findEntity!.total2, loop);
    });

    it("error: entity not exist", async () => {
        const incrementHelper = repository.getIncrementHelper();
        await assertTsDatastoreOrmError(() => incrementHelper.increment(1, "total1", 1)
        , {message: /Entity not exist/});

        const entity = repository.create();
        await assertAsyncError(() => incrementHelper.increment(entity, "total1", 1)
            , {message: /_id must not be 0, empty string or undefined./});
    });

    it("error: not a number", async () => {
        const entity = repository.create();
        await repository.insert(entity);
        const incrementHelper = repository.getIncrementHelper();

        await assertTsDatastoreOrmError(() => incrementHelper.increment(entity._id, "string1", 1)
            , {message: /Entity field is not a number/});
    });

    it("error: not same namespace or kind", async () => {
        const entity1 = repository.create({_id: 1});
        const entity2 = repository.create({_id: 1});
        entity1._namespace = "something";
        entity2._kind = "something";

        const incrementHelper = repository.getIncrementHelper();
        await assertTsDatastoreOrmError(() => incrementHelper.increment(entity1, "string1", 1)
            , {message: /Namespace not match/});

        await assertTsDatastoreOrmError(() => incrementHelper.increment(entity2, "string1", 1)
            , {message: /Kind not match/});
    });

    it("error: transaction error", async () => {
        const entity = repository.create();
        await repository.insert(entity);
        const incrementHelper = repository.getIncrementHelper();

        await assertAsyncError(async () => {
            await Promise.all([
                incrementHelper.increment(entity._id, "total1", 1),
                incrementHelper.increment(entity._id, "total2", 1),
                incrementHelper.increment(entity._id, "total1", 1),
                incrementHelper.increment(entity._id, "total2", 1),
            ]);
        }, {message: /multiple transactions attempt to access the same data/});
    });

    it("massive auto increment", async () => {
        const loop = 5;
        const total = 50;

        const entities = Array(total).fill(0).map(x => repository.create({total1: 0}));
        await repository.insert(entities);

        const incrementHelper = repository.getIncrementHelper({maxRetry: 2, retryDelay: 100});

        for (let i = 0; i < loop; i++) {
            const promises = entities.map(x => {
                return incrementHelper.increment(x._id, "total1");
            });

            const results = await Promise.all(promises);
            const totalSum = results.map(x => x).reduce((a, b) => a + b, 0);
            assert.equal(totalSum, total * (i + 1));
        }
    });
});
