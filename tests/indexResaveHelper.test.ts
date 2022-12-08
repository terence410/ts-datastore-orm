import { assert, expect } from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {Repository} from "../src/Repository";
// @ts-ignore
import {assertTsDatastoreOrmError, initializeConnection, connection} from "./share";

@Entity()
export class RawEntity extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";

    @Field()
    public value: number = 0;

    @Field()
    public check: number = 0;
}

@Entity({kind: "RawEntity"})
export class IndexEntity extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public name: string = "";

    @Field({index: true})
    public value: number = 0;

    @Field({index: true})
    public check: number = 0;

    @Field()
    public noIndex: number = 0;
}

// before test
before(initializeConnection);
describe("Index Resave Helper Test", () => {
    const total = 10;
    let rawRepository: Repository<typeof RawEntity>;
    let indexRepository: Repository<typeof IndexEntity>;

    before(() => {
        rawRepository = connection.getRepository(RawEntity);
        indexRepository = connection.getRepository(IndexEntity);
    });
    after(async () => {
        await rawRepository.truncate();
    });

    it("create entity", async () => {
        for (let i = 0; i < total; i++) {
            const entity = rawRepository.create({
                name: Math.random().toString(),
                value: Math.random(),
                check: i + 1,
            });
            await rawRepository.insert(entity);
        }
    });

    it("query will return nothing", async () => {
        const results1 = await rawRepository.query().filter("name", x => x.gt("")).findMany();
        assert.equal(results1.length, 0);

        const results2 = await rawRepository.query().filter("value", x => x.gt(0)).findMany();
        assert.equal(results2.length, 0);
    });

    it("resave with new index", async () => {
        const indexResaveHelper = indexRepository.getIndexResaveHelper();
        const totalResaved = await indexResaveHelper.resave(["name", "value"]);
        assert.equal(totalResaved, total);

        const results1 = await rawRepository.query().filter("name", x => x.gt("")).findMany();
        assert.equal(results1.length, totalResaved);

        const results2 = await rawRepository.query().filter("value", x => x.gt(0)).findMany();
        assert.equal(results2.length, totalResaved);

        // make sure other values are not reset
        const allEntities = await rawRepository.query().findMany();
        assert.equal(allEntities.length, total);
        for (const item of allEntities) {
            assert.notEqual(item.check, 0);
        }
    });

    it("resave field without index", async () => {
        const helper = indexRepository.getIndexResaveHelper();
        await assertTsDatastoreOrmError(() => helper.resave("noIndex")
            , {message: /Field "noIndex" is not set as index./});

    });
});
