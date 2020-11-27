import {
    AfterLoad,
    BaseEntity,
    BeforeDelete, BeforeInsert, BeforeUpdate, BeforeUpsert,
    CompositeIndex,
    CompositeIndexExporter,
    createConnection,
    Entity,
    Field,
    tsDatastoreOrm,
    TsDatastoreOrmError,
} from "./src/index";

@CompositeIndex({_id: "desc"})
@Entity({namespace: "testing", kind: "User", enumerable: true})
export class User extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public date: Date = new Date();

    @Field({index: true})
    public string: string = "";

    @Field()
    public number: number = 10;

    @Field()
    public buffer: Buffer = Buffer.alloc(1);

    @Field()
    public array: number[] = [];

    @Field({index: true, excludeFromIndexes: ["object.name"]})
    public object: any = {};

    @Field()
    public undefined: undefined = undefined;

    @Field()
    public null: null = null;
}

@CompositeIndex({number: "desc", name: "desc"})
@CompositeIndex({_id: "desc"})
@Entity() // namespace: default, kind: same as class name
export class TaskGroup extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";

    @Field()
    public number: number = 0;

    @AfterLoad()
    @BeforeInsert()
    @BeforeUpsert()
    @BeforeUpdate()
    @BeforeDelete()
    public async hook(type: string) {
        // you can update the entity after certain events happened
    }
}

async function generalExamples() {
    const connection = await createConnection({keyFilename: "./datastoreServiceAccount.json"});
    const repository = connection.getRepository(User, {namespace: "mynamespace", kind: "NewUser"});
    const datastore = connection.datastore; // access to native datastore

    const user1 = repository.create();
    await repository.insert(user1);
    const key = user1.getKey(); // the native datastore key

    // the kind and namespace is attached to entity, but they are not enumerable by default
    // use @Entity({enumerable: true}) such that if you console.log(entity), _kind and _namespace will be displayed as well
    const {_kind, _namespace, _ancestorKey} = user1;

    // simple query
    const findUser1 = repository.findOne(user1._id);

    // find users
    const users = await repository
        .query()
        .filter("_id", x => x.gt(5))
        .limit(100)
        .findMany();

    // get id
    const ids = await repository.allocateIds(10);

    // remove all data
    await repository.truncate();
}

async function multipleEntities() {
    const connection = await createConnection({keyFilename: "./datastoreServiceAccount.json"});
    const repository = connection.getRepository(User, {namespace: "mynamespace", kind: "NewUser"});

    const users = Array(10).map((_, i) => repository.create({number: i}));
    await repository.insert(users);
    await repository.update(users);
    await repository.upsert(users);
    await repository.delete(users);
}

async function ancestorExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const taskGroupRepository = connection.getRepository(TaskGroup);

    const user1 = await userRepository.insert(userRepository.create({_id: 1}));
    const taskGroup = taskGroupRepository.create({_id: 1, name: "group 1", _ancestorKey: user1.getKey()});
    await taskGroupRepository.insert(taskGroup);

    // ignore the strong type on method call
    const findTaskGroup1 = await taskGroupRepository.query()
        .filterKey(taskGroup.getKey())
        .findOne();

    // get back the user
    if (findTaskGroup1?._ancestorKey) {
        const findUser1 = await userRepository.findOne(findTaskGroup1._ancestorKey);
    }

    // another way to query the entities
    const findTaskGroup2 = await taskGroupRepository.query()
        .setAncestorKey(user1.getKey())
        .filter("_id", 1)
        .findOne();
}

async function adminExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const myAdmin = connection.getAdmin();
    const namespaces = await myAdmin.getNamespaces();
    const kinds = await myAdmin.getKinds();
}

async function queryExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const user = userRepository.create({_id: 1});

    const findUser1 = await userRepository.query().findOne();
    const findUsers2 = await userRepository.findMany([1, 2, 3, 4, 5]);
    const findUsers3 = await userRepository.query().filter("_id", x => x.ge(1).lt(6)).findMany();
    const findUsers4 = await userRepository.query().limit(10).offset(3).order("number", {descending: true}).findMany();

    // complex query with strong type
    const query1 = userRepository.query()
        .filter("number", 10)
        .setAncestorKey(user.getKey())
        .groupBy("number")
        .order("number", {descending: true})
        .offset(5)
        .limit(10);

    // complex query with strong type
    const query = userRepository.query({weakType: true})
        .filter("object.name", 10)
        .setAncestorKey(user.getKey())
        .groupBy("object.name")
        .order("object.name", {descending: true})
        .offset(5)
        .limit(10);

    // iterator
    const batch = 500;
    const iterator = userRepository.query().limit(batch).getAsyncIterator();
    for await (const entities of iterator) {
        if (entities.length === batch) {
            // true
        }
    }

    // select key query
    // this can save some query cost and also return faster
    const keys = await userRepository.selectKeyQuery().findMany();
}

async function transactionManagerExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);

    const transactionManager1 = connection.getTransactionManager();

    // customize behavior of the transaction
    // for readonly transaction, please refer to datastore documentation
    const transactionManager2 = connection.getTransactionManager({maxRetry: 3, retryDelay: 200, readOnly: true});

    const result = await transactionManager1.start(async (session) => {
        const findEntity1 = await userRepository.findOneWithSession(1, session);
        const findEntity2 = await userRepository.queryWithSession( session).findOne();
        const ids = await userRepository.allocateIdsWithSession(10, session);

        if (findEntity2) {
            // only the last operation of the same entity will applies only
            userRepository.insertWithSession(findEntity2, session);
            userRepository.updateWithSession(findEntity2, session);
            userRepository.upsertWithSession(findEntity2, session);
            userRepository.deleteWithSession(findEntity2, session);
        } else {
            await session.rollback();
        }

        return 5;
    });

    // value === 5 in above case
    const {value, hasCommitted, totalRetry} = result;
}

async function errorExamples() {
    // this help you to provide a better stack upon error
    tsDatastoreOrm.useFriendlyErrorStack = true;

    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const user = userRepository.create({_id: 1});

    try {
        await userRepository.delete(user);
    } catch (err) {
        if (err instanceof TsDatastoreOrmError) {
            // error from this library

        }
    }
}

async function incrementHelperExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const user = userRepository.create({_id: 1});
    const incrementHelper = userRepository.getIncrementHelper();

    // take all kind of parameters
    const latestValue1 = await incrementHelper.increment(user._id, "number", 10);
    const latestValue2 = await incrementHelper.increment(user, "number", 10);
    const latestValue3 = await incrementHelper.increment(user.getKey(), "number", 10);
}

async function indexResaveHelperExamples() {
    // sometimes u added new index and need to resave the entities
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const helper = userRepository.getIndexResaveHelper();

    await helper.resave("number");
    await helper.resave(["number", "string"]);
}

async function lockManagerExamples() {
    // this is a tool for atomic lock
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const lockManager1 = connection.getLockManager({expiresIn: 1000});

    // this look will try to acquire the lock 2 more times if it failed, waiting 100ms for each retry
    // you can also customize which namespace and kind to save temporary data of the lock
    const lockManager2 = connection.getLockManager({expiresIn: 1000, maxRetry: 2, retryDelay: 100, namespace: "custom", kind: "Lock"});

    try {
        const lockKey = "anyKey";
        const result = await lockManager1.start(lockKey, async () => {
            return 5;
        });
        console.log(result.value);

    } catch (err) {
        // your own error or lock acquire error

    }
}

async function compositeIndexExamples() {
    const filename = "./index.yaml";
    const exporter = new CompositeIndexExporter();
    exporter.addEntity(User, {kind: "NewUser"});
    exporter.addEntity(TaskGroup, {kind: "NewTaskGroup"});
    // you can add multiple class, but you can't customize the kind name
    exporter.addEntity([User, TaskGroup]);

    const yaml = exporter.getYaml();
    exporter.exportTo(filename);

}
