import {
    BaseEntity,
    Batcher,
    Column,
    datastoreOrm,
    Entity,
    IncrementHelper,
    RelationshipHelper,
    Transaction,
} from "./src/index";

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
    const [ids] = await User.allocateIds();
}

async function keyExamples() {
    const key1 = User.createKey(1);
    const key2 = datastoreOrm.createKey(User, 1);
    const key3 = datastoreOrm.createKey([User, 1]);
    const key4 = datastoreOrm.getDatastore().key(["kind1", 1, "kind2", 2]);
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

    const key1 = datastoreOrm.createKey(User, 1);
    const key2 = datastoreOrm.createKey(TaskGroup, 1);
    key2.parent = key1;
    const [taskGroup5] = await TaskGroup.query()
        .filterKey("=", key2)
        .runOnce();

    const key3 = datastoreOrm.createKey(User, 1, TaskGroup, 1);
    const [taskGroup6] = await TaskGroup.query()
        .filterKey("=", key3)
        .runOnce();

    const [taskGroups1] = await TaskGroup.query()
        .setAncestor(user1)
        .run();
}

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

async function relationshipHelperExamples() {
    const [user1] = await User.create().save();
    const relationshipHelper = new RelationshipHelper(user1);
    const [taskGroup4, response9] = await relationshipHelper.get(TaskGroup);
    const [taskGroup5, response10] = await relationshipHelper.getOrCreate(TaskGroup, {name: "hello"});
    const [taskGroups1, response11] = await relationshipHelper.getMany(TaskGroup);
}

async function incrementHelperExamples() {
    const [user1] = await User.create().save();
    const incrementHelper = new IncrementHelper(user1);
    const [total, response12] = await incrementHelper.increment("number", 1, {maxRetry: 2});
    const latestValue = user1.number;
}
