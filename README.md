# Datastore ORM (Typescript)

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/ts-datastore-orm.svg
[npm-url]: https://npmjs.org/package/ts-datastore-orm
[travis-image]: https://img.shields.io/travis/terence410/ts-datastore-orm.svg?style=flat-square
[travis-url]: https://travis-ci.org/terence410/ts-datastore-orm
[codecov-image]: https://img.shields.io/codecov/c/github/terence410/ts-datastore-orm.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/terence410/ts-datastore-orm
[david-image]: https://img.shields.io/david/terence410/ts-datastore-orm.svg?style=flat-square
[david-url]: https://david-dm.org/terence410/ts-datastore-orm

[ts-datastore-orm](https://www.npmjs.com/package/ts-datastore-orm) targets to provide a strong typed and structural ORM feature for Datastore (Firestore in Datastore mode).

This package is mainly built on top of [nodejs-datastore](https://github.com/googleapis/nodejs-datastore) provided by google.

This package also heavily tested with all features. You can find all the test cases [here](https://github.com/terence410/ts-datastore-orm/blob/master/tests/). 

You can also compare the native performance of [nodejs-datastore](https://github.com/terence410/ts-datastore-orm/blob/master/src/performance/datastore.performance.ts) with [ts-datastorem-orm](https://github.com/terence410/ts-datastore-orm/blob/master/src/performance/datastoreorm.performance.ts). Basically there is no significant overhead compared with native nodejs-datastore package.

# Feature
- Covering all features of datastore: query, transaction, ancestor, index, allocateIds, namespace, etc..
- Simple class structure using typescript decorator. (Very similar to [type-orm](https://www.npmjs.com/package/typeorm))
- Support default values and variable casting. This will be useful if you decided to add/modify columns to an entity.
- Provide execution time for every request. It only take up around 0.3s for 1 million measurements. 

# Project Setup
- npm install ts-datastore-orm
- In tsconfig.json
  - set "experimentalDecorators" to true. 
  - set "emitDecoratorMetadata" to true. 
  - set "strictNullChecks" to true.
- Create ./datastoreorm.default.json in the project root folder.
```json5
{
  "keyFilename": "datastoreServiceAccount.json",
  "friendlyError": true, // for easier debugging of some promise error, enable this if you found some error log hard to trace
  "namespace": "namespace" // default namespace for all the entities, leave it blank will use default namespace
}
```
- Generate datastore-service-account.json from Goolge APIs. (Details won't cover here)

# Environment Variable
- export NODE_ENV=production
  - it will try to load the config file "./datastoreorm.production.json" first
  - if the file is not found, it will load the config file "./datastoreorm.default.json"
- export DATASTOREORM_CONFIG_PATH=./path/custom.json
  - it will try to load the config file "./path/custom.json"

# Quick Start
```typescript
import {BaseEntity, Column, Entity} from "ts-datastore-orm";

@Entity({kind: "user"})
export class User extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;
    
    @Column({index: true})
    public total: number = 0;
}

async function main() {
    const user = User.create();
    await user.save();
    const id = user.id;
}
```

# General Usage
```typescript
import {BaseEntity, Batcher, Column, CompositeIndex, datastoreOrm, Entity, Transaction, DatastoreOrmDatastoreError, DatastoreOrmError} from "ts-datastore-orm";

@CompositeIndex({id: "desc"})
@CompositeIndex({string: "asc", ["object.name"]: "asc"})
@Entity({namespace: "testing", kind: "user"})
export class User extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public date: Date = new Date();

    @Column({index: true})
    public string: string = "";

    @Column()
    public number: number = 10;

    @Column()
    public buffer: Buffer = Buffer.alloc(1);

    @Column()
    public array: number[] = [];

    @Column({excludeFromIndexes: ["object.name"]})
    public object: any = {};
    
    @Column()
    public undefined: undefined = undefined;

    @Column()
    public null: null = null;
}

@Entity({namespace: "testing", kind: "taskGroup", ancestor: User})
export class TaskGroup extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";

    @Column()
    public number: number = 0;
}

async function init() {
    datastoreOrm.addConnection("default", {keyFilename: "serviceAccount.json"});
    datastoreOrm.addConnection("another", {clientEmail: "", privateKey: ""});
    const datastore1 = datastoreOrm.getConnection();
    const datastore2 = datastoreOrm.getConnection("another");
}

async function entityExamples() {
    const user1 = User.create({id: 1});
    const [user2, requestResponse1] = await User.create({id: 1}).save();
    const [user3, requestResponse2] = await User.find(user1.id);

    const user4 = new User();
    const isNew = user4.isNew;
    const values = user4.getValues();
    await user4.save();
    await user4.delete();
    const [user5] = await User.query().filter("id", "=", user4.id).runOnce();
    const [user6] = await User.find(user4.id);
}

async function batcherExamples() {
    const batcher = new Batcher();
    const users = Array(10).fill(0).map((x, i) => {
        return User.create({number: i});
    });
    const [total1, requestResponse1] = await batcher.saveMany(users);
    const [total2, requestResponse2] = await batcher.deleteMany(users);
}

async function ancestorExamples() {
    const [user1] = await User.create({id: 1}).save();
    const [taskGroup1] = await TaskGroup.create({id: 1, name: "group 1"})
        .setAncestor(user1)
        .save();

    // get back the user
    const [user2] = await taskGroup1.getAncestor(User);
    const user2Id = await taskGroup1.getAncestorId(User);

    // ignore the strong type on method call
    const [taskGroup2] = await TaskGroup.query()
        .filterAny("__key__", "=", taskGroup1.getKey())
        .runOnce();

    const [taskGroup3] = await TaskGroup.query()
        .setAncestor(user1)
        .filter("id", "=", 1)
        .runOnce();

    const [taskGroup4] = await TaskGroup.query()
        .filterKey("=", datastoreOrm.getConnection().key(["user1", 1, "taskGroup", 1]))
        .runOnce();

    const key1 = datastoreOrm.createKey([User, 1]);
    const key2 = datastoreOrm.createKey({ancestorKey: key1, path: [TaskGroup, 1]});
    const [taskGroup5] = await TaskGroup.query()
        .filterKey("=", key2)
        .runOnce();

    const key3 = datastoreOrm.createKey([User, 1, TaskGroup, 1]);
    const [taskGroup6] = await TaskGroup.find({ancestor: user1, id: taskGroup1.id});
    const [taskGroupList1] = await TaskGroup.query()
        .setAncestor(user1)
        .run();
}

async function eventExamples() {
    const events = EventTest.getEvents();
    events.on("create", entity => {

    });
    events.on("update", entity => {

    });
    events.on("delete", entity => {

    });
}

async function operationExamples() {
    await User.truncate();
    const [ids] = await User.allocateIds(1);
    
    // generate composite index
    await datastoreOrm.exportCompositeIndexes("./index.yaml", [User]);
}

async function keyExamples() {
    const key1 = datastoreOrm.createKey([User, 1]);
    const key2 = datastoreOrm.createKey({namespace: "namespace", path: [User, 1]});
    const key3 = datastoreOrm.createKey({namespace: "namespace", ancestorKey: key1, path: [User, 1]});
    const key4 = datastoreOrm.getConnection().key({namespace: "namespace", path: ["kind1", 1, "kind2", 2]});
    const key5 = User.create({id: 1}).getKey();
    const key6 = TaskGroup.create({id: 1}).setAncestor(User.create({id: 1})).getKey();
}
```

# Query
Query works in the same way as nodejs-datastore. It come withs paging for you to loop data more easily.
```typescript
async function queryExamples() {
    const [user1, requestResponse1] = await User.query().runOnce();
    const [userList1, requestResponse2] = await User.findMany([1, 2, 3, 4, 5]);
    const [userList2, requestResponse3] = await User.findMany({ancestor: user1, ids: [1, 2, 3, 4, 5]});
    const [userList3, requestResponse4] = await User.query().run();

    const user2 = User.create({id: 1});
    const query = TaskGroup.query()
        .filter("number", "=", 10)
        .filterAny("anyColumn.name", ">", 5)
        .setAncestor(user2)
        .groupByAny("anyColumn.name")
        .orderAny("anyColumn.name", {descending: true})
        .offset(5)
        .limit(10);

    while (query.hasNextPage()) {
        const [entities] = await query.run();
    }

    // stream
    const stream = query.runStream()
        .on("data", (entity) => {
            //
        })
        .on("info", (info) => {
            //
        })
        .on("error", (error) => {
            //
        })
        .on("end", () => {
            //
        });
}
```

# Transaction
Transaction.execute is simple and elegant way to play with Transaction easily. You don't have to worry about transaction rollback and spot out precisely the type of errors being throw.  
```typescript
async function transaction1Examples() {
    Transaction.setDefaultOptions({maxRetry: 0, delay: 50, readOnly: false});
    
    try {
        const [taskGroup1, transactionResponse1] = await Transaction.execute(async transaction => {
            let taskGroup2: TaskGroup | undefined;
            const [user1, requestResponse1] = await transaction.find(User, 1);
            const [userList1, requestResponse2] = await transaction.findMany(User, [1]);

            if (user1) {
                taskGroup2 = TaskGroup.create({name: "Task Group"});
                taskGroup2.setAncestor(user1);
                transaction.save(taskGroup2);
                return taskGroup2;
            } else {
                await transaction.rollback(); 
            }
        }, {maxRetry: 5});

        if (transactionResponse1.hasCommitted && taskGroup1) {
            const taskGroup3Id = taskGroup1.id;
            for (const entity of transactionResponse1.createdEntities) {
                if (entity instanceof TaskGroup) {
                    const taskGroup = entity as TaskGroup;
                    const taskGroupId = taskGroup.id;
                }
            }

            for (const entity of transactionResponse1.updatedEntities) {
                
            }
        }
    } catch (err) {
        if (err instanceof DatastoreOrmDatastoreError) {
            // err from data store
        } else if (err instanceof DatastoreOrmError) {
            // other library error
        } else {
            // your own logic error
        }
    }
}

async function transaction2Examples() {
    const transaction1 = new Transaction();
    await transaction1.run();
    const [user1, requestResponse3] = await transaction1.find(User, 1);
    try {
        if (user1) {
            transaction1.save(user1);
            await transaction1.commit();
        } else {
            await transaction1.rollback(); // can consider omit await for faster performance
        }
    } catch (err) {
        await transaction1.rollback(); // can consider omit await for faster performance
    }
}
```

# Errors
```typescript
async function errorExamples() {
    try {
        const [user1] = await User.create().save();
    } catch (err) {
        // all errors extends DatastoreOrmError
        if (err instanceof DatastoreOrmError) {
            if (err instanceof DatastoreOrmDatastoreError) {
                // errors related to the google datastore

            } else if (err instanceof DatastoreOrmOperationError) {
                // errors related to the library

            } else if (err instanceof DatastoreOrmDecoratorError) {
                // errors related to your decorator
            }
        }
    }
}
```

# Descendent Helper
Helps you to query descendant more easily, support transaction.
```typescript
import {IncrementHelper} from "ts-datastore-orm";

async function descendentHelperExamples() {
    const [user1] = await User.create({id: 1}).save();
    const descendentHelper1 = new DescendentHelper(user1);
    const [taskGroup1] = await descendentHelper1.findOne(TaskGroup);
    const [taskGroups1] = await descendentHelper1.findMany(TaskGroup);

    // use in transaction
    const [_, transactionResponse1] = await Transaction.execute(async transaction => {
        const [user2] = await transaction.find(User, 1);
        const descendentHelper2 = new DescendentHelper(user1, transaction);
        const [taskGroup2] = await descendentHelper2.findOne(TaskGroup);
        const [taskGroups2] = await descendentHelper2.findMany(TaskGroup);
    });
}
```

# IncrementHelper
Helps you to do atomic increment on an entity. Not suggest you use massively on single entity to avoid hotspots issue. 

```typescript
import {IncrementHelper} from "ts-datastore-orm";

async function incrementHelperExamples() {
    const [user1] = await User.create().save();
    const incrementHelper = new IncrementHelper(user1);
    const [total, response12] = await incrementHelper.increment("number", 1, {maxRetry: 2});
    const latestValue = user1.number;
}
```

# IncrementHelper
Quick way to help you to create index for some newly added column. This Helper is not suggested to use for frequently updated data as it may cause atomic issue
```typescript
import {IndexResaveHelper} from "ts-datastore-orm";

async function indexResaveHelperExamples() {
    const indexResaveHelper = new IndexResaveHelper(User);
    const [totalResaved] = await indexResaveHelper.resave(["number"]);
}
```

# LockHelper
A simple and robust locking helper for distributed servers. Useful for small to medium server. 
If you have performance considering, please use some other tools like [Redis Lock](https://redis.io/topics/distlock). 

```typescript
import {LockHelper} from "ts-datastore-orm";

async function lockHelperExamples() {
    const key = "test1";
    LockHelper.setDefaultOptions({expire: 1000, maxRetry: 2, delay: 50, throwReleaseError: false});
    // expire: how long the lock will be expired
    // maxRetry: the number of retry if it failed to acquire an lock
    // delay: the delay in ms waiting for a retry
    // throwReleaseError: whether you wanted to care any release error

    const lockHelper1 = new LockHelper(key, {expire: 1000, maxRetry: 5, delay: 100});
    try {
        const [isNewLock] = await lockHelper1.acquire();
        // isNewLock = true // you are acquired an expired lock
        const [isReleased] = await lockHelper1.release();
        // isReleased = true // an lock is in released state (whether you released it or it is expired)
        // isReleased = false // an lock still exist, in the case that your lock is expired and acquired by others
    } catch (err) {
        if (err instanceof DatastoreOrmLockError) {
            // if you failed to acquire the lock
        } else {
            // other logic error
        }
    }

    try {
        const [resultString, response] = await LockHelper.execute(key, async (lockHelper2) => {
            return "value";
        }, {maxRetry: 2});
    } catch (err) {
        //
    }

    // remove all lock
    await LockHelper.truncate();
}
```


# More Samples
Samples are in the [`tests/`](https://github.com/terence410/ts-datastore-orm/tree/master/tests) directory.

| Sample                      | Source Code                       | 
| --------------------------- | --------------------------------- |
| Basics | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/general.test.ts) |
| Transactions | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/transaction.test.ts) |
| Query | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/query.test.ts) |
| Cast | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/cast.test.ts) |
| Namespace | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/namespace.test.ts) |
| Subclass | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/subclass.test.ts) |
| Cast | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/cast.test.ts) |
| Errors | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/errors.test.ts) |
| Admin | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/admin.test.ts) |
| Helpers | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/helpers.test.ts) |
| LockHelper | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/helpers/lockHelper.test.ts) |
| IndexResaveHelper | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/helpers/indexResaveHelper.test.ts) |

# Useful links
- https://googleapis.dev/nodejs/datastore/5.0.0/index.html
- https://cloud.google.com/datastore/docs/
- https://www.npmjs.com/package/@google-cloud/datastore
- https://www.npmjs.com/package/@google-cloud/firestore

# TODO
- entity helper
    - create or update
    - find or update
