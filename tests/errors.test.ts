import {assert, expect} from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {Repository} from "../src/Repository";
// @ts-ignore
import {assertAsyncError, assertTsDatastoreOrmError, initializeConnection, connection} from "./share";

@Entity()
class TestEntity extends BaseEntity {
    @Field()
    public _id: number = 0;

    @Field({index: true})
    public total: number = 0;

    @Field({index: true})
    public string: string = "";
}

@Entity()
class GenerateIdEntity extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public total: number = 0;

    @Field({index: true})
    public string: string = "";
}

before(initializeConnection);
describe("Error Tests", () => {
    let repository: Repository<typeof TestEntity>;
    let generateIdRepository: Repository<typeof GenerateIdEntity>;

    before(() => {
        repository = connection.getRepository(TestEntity, {namespace: "testing"});
        generateIdRepository = connection.getRepository(GenerateIdEntity);
    });
    after(async () => {
        await repository.truncate();
        await generateIdRepository.truncate();
    });

    it("Entity without @Entity() decorator", async () => {
        await assertTsDatastoreOrmError(() => {
            class ErrorTest1 extends BaseEntity {
                @Field()
                public _id: number = 0;
            }

            connection.getRepository(ErrorTest1);
        }, {message: /Entity must define with class decorator /});
    });

    it("Entity without @Field() decorator", async () => {
        await assertTsDatastoreOrmError(() => {
            @Entity()
            class ErrorTest1 extends BaseEntity {
            }

            connection.getRepository(ErrorTest1);
        }, {message: /Entity must define an _id field with property decorator/});
    });

    it("Entity without _id field", async () => {
        await assertTsDatastoreOrmError(() => {
            @Entity()
            class ErrorTest1 extends BaseEntity {
                @Field()
                public total: number = 0;
            }
        }, {message: /Entity must define an _id field with property decorator/});
});

    it("Entity _id is not valid", async () => {
        for (const value of ["", 0, undefined, new Date(), null]) {
            const entity = repository.create({_id: value} as any);

            await assertTsDatastoreOrmError(async () => repository.insert(entity),
                {message: /_id must not be 0, empty string or undefined./});

            await assertTsDatastoreOrmError(async () => repository.update(entity),
                {message: /_id must not be 0, empty string or undefined./});

            await assertTsDatastoreOrmError(async () => repository.delete(entity),
                {message: /_id must not be 0, empty string or undefined./});
        }
    });

    it("Entity namespace not match", async () => {
        const entity = new TestEntity();
        entity._id = 1;

        await assertTsDatastoreOrmError(async () => {
            await repository.insert(entity);
        }, {message: /Namespace not match/});

        await assertTsDatastoreOrmError(async () => {
            await repository.insert([entity]);
        }, {message: /Namespace not match/});

        await assertTsDatastoreOrmError(async () => {
            await repository.delete(entity.getKey());
        }, {message: /Namespace not match/});
    });

    it("Entity kind not match", async () => {
        const entity = repository.create();
        entity._id = 1;
        entity._kind = "testing";

        await assertTsDatastoreOrmError(async () => {
            await repository.insert(entity);
        }, {message: /Kind not match/});

        await assertTsDatastoreOrmError(async () => {
            await repository.insert([entity]);
        }, {message: /Kind not match/});

        await assertTsDatastoreOrmError(async () => {
            await repository.delete(entity.getKey());
        }, {message: /Kind not match/});
    });

    it("insert same entities", async () => {
        const entity1 = repository.create({_id: 1});
        const entity2 = repository.create({_id: 1});

        await assertAsyncError(async () => {
            await repository.insert([entity1, entity1]);
        }, {message: /may not contain multiple mutations affecting the same entity./});

        await assertAsyncError(async () => {
            await repository.insert([entity1, entity2]);
        }, {message: /may not contain multiple mutations affecting the same entity./});
    });

    it("insert same entities (generateId)", async () => {
        const entity1 = generateIdRepository.create();
        const entity2 = generateIdRepository.create();

        await assertAsyncError(async () => {
            await generateIdRepository.insert([entity1, entity1]);
        }, {message: /You cannot insert the same entity./});

        // below is ok
        await generateIdRepository.insert([entity1, entity2]);
    });

    it("insert same entities in transaction (generateId)", async () => {
        const entity1 = generateIdRepository.create();
        const transactionManager = connection.getTransactionManager();

        await assertAsyncError(async () => {
            await transactionManager.start(async (session) => {
                await generateIdRepository.insertWithSession([entity1, entity1], session);
            });
        }, {message: /You cannot insert the same entity./});
    });

    it("Delete multiple times", async () => {
        // it's pretty hard to check if the deleted item originally existed or not
        const entity1 = generateIdRepository.create();
        const entity2 = generateIdRepository.create();
        await generateIdRepository.insert([entity1, entity2]);
        await generateIdRepository.delete([entity1, entity2]);
        await generateIdRepository.delete([entity1, entity2]);
    });

    it("Update deleted entity", async () => {
        const entity1 = generateIdRepository.create();
        await generateIdRepository.insert(entity1);
        await generateIdRepository.delete(entity1.getKey());

        const error = await assertAsyncError(async () => {
            await generateIdRepository.update(entity1);
        }, {message: /NOT_FOUND/});
    });

    it("Allocate Id Error", async () => {
        const error = await assertAsyncError(async () => {
            await generateIdRepository.allocateIds(-1);
        }, {message: /Invalid array length/});
    });
});
