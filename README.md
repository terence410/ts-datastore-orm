# Datastore ORM (Typescript)

[![NPM version](https://badge.fury.io/js/ts-datastore-orm.png)](https://www.npmjs.com/package/ts-datastore-orm)

[ts-datastore-orm](https://www.npmjs.com/package/ts-datastore-orm) targets to provide a structural Orm feature for Datastore.

This package is mainly built on top of [nodejs-datastore](https://github.com/googleapis/nodejs-datastore) provided by google.

# Feature
- Covering all features of datastore: query, transaction, ancestor, index, allocateIds, namespace, etc..
- Simple class structure using typescript decorator. (Very similar to [type-orm](https://www.npmjs.com/package/typeorm))
- Support default values. This will be useful if you decided to add extra columns to an entity.
- Provide execution time for every request. It only take up around 0.3s for 1 million measurements. 
- LockHelper: Simple but robust distributed lock for atomic updates. Useful for small to medium server without worry of scaling.

# Project Setup
- npm install ts-datastore-orm
- In tsconfig.json, set "experimentalDecorators" to true. 
- In tsconfig.json, set "emitDecoratorMetadata" to true. 
- In tsconfig.json, set "strictNullChecks" to true. (To avoid type confusion in entity)
- Create datastoreorm.default.json in the project root folder.
- Generate datastore-service-account.json from Goolge APIs. (Details won't cover here)

# Environment Variable
- export NODE_ENV=production
  - it will try to load the config file "./datastoreom.production.json"
- export DATASTOREORM_CONFIG_PATH=./path/custom.json
  - it will try to load the config file "./path/custom.json"
  - this has a higher priority than NODE_ENV
  
# Config file format (./datastoreorm.default.json)

```json5
{
  "keyFilename": "datastoreServiceAccount.json",
  "friendlyError": true, // for easier debugging of promise
  "namespaec": "namespace" // default namespace for the entity
}
```

# Quick Start
```typescript
import {BaseEntity, Column, Entity} from "ts-datastore-orm";

@Entity({namespace: "testing", kind: "user"})
export class User extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;
}

async function main() {
    const user = User.create();
    await user.save();
    const id = user.id;
}

```

# Samples: Define Entity and general operation
```typescript
import {
    BaseEntity,
    Batcher,
    Column,
    datastoreOrm,
    Entity,
    Transaction,
    IncrementHelper,
    DescendentHelper,
    LockHelper,
} from "ts-datastore-orm";

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
}

@Entity({namespace: "testing", kind: "taskGroup", ancestors: User})
export class TaskGroup extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";

    @Column()
    public number: number = 0;
}

async function operationExamples() {
    await User.truncate();
    const [ids] = await User.allocateIds(1);
}

async function keyExamples() {
    const key1 = datastoreOrm.createKey([User, 1]);
    const key2 = datastoreOrm.createKey({namespace: "namespace", path: [User, 1]});
    const key3 = datastoreOrm.createKey({namespace: "namespace", ancestorKey: key1, path: [User, 1]});
    const key4 = datastoreOrm.getDatastore().key(["kind1", 1, "kind2", 2]);
    const key5 = User.create({id: 1}).getKey();
    const key6 = TaskGroup.create({id: 1}).setAncestor(User.create({id: 1})).getKey();
}

async function entityExamples() {
    const user1 = User.create({id: 1});
    const [requestResponse1] = await user1.save();
    const [user2, requestResponse2] = await User.find(user1.id);

    const user3 = new User();
    const id3 = user3.id;
    const [requestResponse3] = await user3.save();
    const [user4, requestResponse4] = await User.query().filter("id", "=", user3.id).runOnce();

}

async function batcherExamples() {
    const batcher = new Batcher();
    const users3 = Array(10).fill(0).map((x, i) => {
        return User.create({number: i});
    });
    const [requestResponse3] = await batcher.saveMany(users3);
    const [requestResponse4] = await batcher.deleteMany(users3);
}

async function ancestorExamples() {
    const [user1] = await User.create({id: 1}).save();
    const [taskGroup1] = await TaskGroup.create({id: 1, name: "group 1"})
        .setAncestor(user1)
        .save();

    // ignore the strong type on method call
    const [taskGroup2] = await TaskGroup.query()
        .filterAny("__key__", "=", taskGroup1.getKey())
        .runOnce();

    const [taskGroup3] = await TaskGroup.query()
        .setAncestor(user1)
        .filter("id", "=", 1)
        .runOnce();

    const [taskGroup4] = await TaskGroup.query()
        .filterKey("=", datastoreOrm.getDatastore().key(["user1", 1, "taskGroup", 1]))
        .runOnce();

    const key1 = datastoreOrm.createKey([User, 1]);
    const key2 = datastoreOrm.createKey([TaskGroup, 1]);
    key2.parent = key1;
    const [taskGroup5] = await TaskGroup.query()
        .filterKey("=", key2)
        .runOnce();

    const key3 = datastoreOrm.createKey([User, 1, TaskGroup, 1]);
    const [taskGroup6] = await TaskGroup.query()
        .filterKey("=", key3)
        .runOnce();

    const [taskGroups1] = await TaskGroup.query()
        .setAncestor(user1)
        .run();
}

```

# Samples: Query
```typescript
async function queryExamples() {
    const [user1, requestResponse1] = await User.query().runOnce();
    const [users1, requestResponse2] = await User.findMany([1, 2, 3, 4, 5]);
    const [users2, requestResponse3] = await User.query().run();

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

# Samples: Transaction
```typescript
async function transaction1Examples() {
    const [taskGroup1, transactionResponse1] = await Transaction.execute(async transaction => {
        let taskGroup2: TaskGroup | undefined;
        const [user1, requestResponse1] = await transaction.find(User, 1);
        const [users2, requestResponse2] = await transaction.findMany(User, [1]);

        if (user1) {
            taskGroup2 = TaskGroup.create({name: "Task Group"});
            taskGroup2.setAncestor(user1);
            transaction.save(taskGroup2);
            return taskGroup2;
        } else {
            transaction.rollback(); // not necessary to await for it for better performance
        }
    }, {maxRetry: 5});

    if (transactionResponse1.isSuccess && taskGroup1) {
        const taskGroup3Id = taskGroup1.id;
        for (const entity of transactionResponse1.savedEntities) {
            if (entity instanceof TaskGroup) {
                const taskGroup = entity as TaskGroup;
                const taskGroupId = taskGroup.id;
            }
        }
    }
}

async function transaction2Examples() {
    const transaction1 = new Transaction();
    await transaction1.run();
    const [user1, queryResponse3] = await transaction1.find(User, 1);
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

# Samples: Relationship Helper
Helps you to query descendant more easily, support transaction.
```typescript
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

# Samples: IncrementHelper
Helps you to do atomic increment on an entity. Not suggest you use massively on single to avoid hotspots issue. 
```typescript
async function incrementHelperExamples() {
    const [user1] = await User.create().save();
    const incrementHelper = new IncrementHelper(user1);
    const [total, response12] = await incrementHelper.increment("number", 1, {maxRetry: 2});
    const latestValue = user1.number;
}
```

# Samples: LockHelper
A simple and robust locking helper for distributed servers. Useful for small to medium server. 
If you have performance considering, please use some other tools like [Redis Lock](https://redis.io/topics/distlock). 
```typescript
async function lockHelperExamples() {
    const key = "test1";
    LockHelper.setDefaultOptions({expire: 1000, maxRetry: 2, delay: 50, quickRelease: true, throwReleaseError: false});
    // expire: how long the lock will be expired
    // maxRetry: the number of retry if it failed to acquire an lock
    // delay: the delay in ms waiting for a retry
    // quickRelease: release the lock in background without waiting the response from server (for performance optimization)
    // throwReleaseError: whether you wanted to care any release error
    
    const lockHelper1 = new LockHelper(key, {expire: 1000, maxRetry: 5, delay: 100});
    try {
        const [isNewLock] = await lockHelper1.acquire();
        // isNewLock = true // you are acquired an expired lock
        const [isReleased] = await lockHelper1.release();
        // isReleased = true // an lock is in released state (whether you released it or it is expired)
        // isReleased = false // an lock still exist, in the case that your lock is expired and acquired by others
    } catch (err) {
        //
    }

    try {
        const [resultString, response] = await LockHelper.execute(key, async (lockHelper2) => {
            return "value";
        }, {maxRetry: 2, quickRelease: true});
    } catch (err) {
        //
    }
    
    // remove all locsk
    await LockHelper.truncate();
}
```

# Samples: EntityHelper
```typescript
// TBC
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
| Errors | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/errors.test.ts) |
| Admin | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/admin.test.ts) |
| Helpers | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/helpers.test.ts) |
| LockHelper | [source code](https://github.com/terence410/ts-datastore-orm/blob/master/tests/helpers/lockHelper.test.ts) |

# Useful links
- https://googleapis.dev/nodejs/datastore/5.0.0/index.html
- https://cloud.google.com/datastore/docs/
- https://www.npmjs.com/package/@google-cloud/datastore
- https://www.npmjs.com/package/@google-cloud/firestore

# To-do
- consolidate all error messages and type (wrap all datastore errors and handle friendly errors)
- able to generate/deploy composite config
