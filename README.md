TsDatastoreOrm (Typescript Orm wrapper for Google Datastore)

[![NPM version][npm-image]][npm-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/ts-datastore-orm.svg
[npm-url]: https://npmjs.org/package/ts-datastore-orm
[codecov-image]: https://img.shields.io/codecov/c/github/terence410/ts-datastore-orm.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/terence410/ts-datastore-orm
[david-image]: https://img.shields.io/david/terence410/ts-datastore-orm.svg?style=flat-square
[david-url]: https://david-dm.org/terence410/ts-datastore-orm

[ts-datastore-orm](https://www.npmjs.com/package/ts-datastore-orm) targets to provide a strong typed and structural ORM feature for Datastore (Firestore in Datastore mode).

Please check the examples below to check out all the amazing features!

This package has 0 dependencies. You have to install the [@google-cloud/datastore](https://www.npmjs.com/package/@google-cloud/datastore) manually. 
```
npm install -s @google-cloud/datastore@latest
```

This package is compatible with @google-cloud/datastore v5.0.0 or above. I have tested the library specifically with the following versions: 
v5.0.6, 
v5.1.0, 
v6.1.1, 
v6.2.0, 
v6.3.0

You can also compare the native performance of 
[@google-cloud/datastore](https://github.com/terence410/ts-datastore-orm/blob/master/src/performance/datastore.performance.ts) with 
[ts-datastorem-orm](https://github.com/terence410/ts-datastore-orm/blob/master/src/performance/tsdatastoreorm.performance.ts). 
Basically there is no significant overhead compared with native nodejs-datastore package.

# Project Setup
- npm install -s @google-cloud/datastore@latest
- npm install -s ts-datastore-orm@latest
- In tsconfig.json
  - set "experimentalDecorators" to true. 
  - set "emitDecoratorMetadata" to true. 
  - set "strictNullChecks" to true.
- Generate service-account.json from Goolge APIs. (Details won't be covered here)

# Example: define Entity
```typescript
import { BaseEntity, CompositeIndex, CompositeIndexExporter, createConnection, Entity, Field, tsDatastoreOrm, TsDatastoreOrmError } from "ts-datastore-orm";

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
}
```

# Example: general
```typescript
async function generalExamples() {
    const connection = await createConnection({keyFilename: "./datastoreServiceAccount.json"});
    const repository = connection.getRepository(User, {namespace: "mynamespace", kind: "NewUser"});
    const taskGroupRepository = connection.getRepository(TaskGroup);
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
```

# Example: multiple entities
```typescript
async function multipleEntities() {
    const connection = await createConnection({keyFilename: "./datastoreServiceAccount.json"});
    const repository = connection.getRepository(User, {namespace: "mynamespace", kind: "NewUser"});

    const users = Array(10).map((_, i) => repository.create({number: i}));
    await repository.insert(users);
    await repository.update(users);
    await repository.upsert(users);
    await repository.delete(users);
}
```

# Example: ancestors
```typescript
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
```

# Example: admin
```typescript
async function adminExamples() {
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const myAdmin = connection.getAdmin();
    const namespaces = await myAdmin.getNamespaces();
    const kinds = await myAdmin.getKinds();
}
```

# Example: query
```typescript
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
```

# Example: transaction manager
```typescript
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
```

# Example: error
```typescript
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
```

# Example: increment helper
```typescript
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
```

# Example: index resave helper
```typescript
async function indexResaveHelperExamples() {
    // sometimes u added new index and need to resave the entities
    const connection = await createConnection({clientEmail: "", privateKey: ""});
    const userRepository = connection.getRepository(User);
    const helper = userRepository.getIndexResaveHelper();

    await helper.resave("number");
    await helper.resave(["number", "string"]);
}
```

# Example: lock manager
```typescript
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
```

# Example: composite index exporter
```typescript
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
```

# More Examples
Examples are in the [`tests/`](https://github.com/terence410/ts-datastore-orm/tree/master/tests) directory.

| Sample                      | Source Code                       | 
| --------------------------- | --------------------------------- |
| General | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/general.test.ts) |
| Query | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/query.test.ts) |
| Subclass | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/subclass.test.ts) |
| Errors | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/errors.test.ts) |
| CompositeIndex | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/compositeIndex.test.ts) |
| Admin | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/admin.test.ts) |
| TransactionManager | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/transactionManager.test.ts) |
| LockManager | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/lockManager.test.ts) |
| IndexResaveHelper | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/indexResaveHelper.test.ts) |
| IncrementHelper | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/incrementHelper.test.ts) |

# Useful links
- https://googleapis.dev/nodejs/datastore/6.0.0/index.html
- https://cloud.google.com/datastore/docs/
- https://www.npmjs.com/package/@google-cloud/datastore
- https://www.npmjs.com/package/@google-cloud/firestore

