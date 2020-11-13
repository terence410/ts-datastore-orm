import { assert, expect } from "chai";
import {Repository} from "../src/";
// @ts-ignore
import {Guild} from "./entities/Guild";
// @ts-ignore
import {Task} from "./entities/Task";
// @ts-ignore
import {TaskGroup} from "./entities/TaskGroup";
// @ts-ignore
import {User} from "./entities/User";
// @ts-ignore
import {beforeCallback, connection} from "./share";

before(beforeCallback);
describe("General Test", () => {
    let guildRepository: Repository<typeof Guild>;
    let userRepository: Repository<typeof User>;
    let taskGroupRepository: Repository<typeof TaskGroup>;
    let taskRepository: Repository<typeof Task>;

    before(() => {
        guildRepository = connection.getRepository(Guild);
        userRepository = connection.getRepository(User);
        taskGroupRepository = connection.getRepository(TaskGroup);
        taskRepository = connection.getRepository(Task);
    });
    after(async () => {
        await guildRepository.truncate();
        await userRepository.truncate();
        await taskGroupRepository.truncate();
        await taskRepository.truncate();
    });

    it("getUrl", async () => {
        console.log(await userRepository.getUrl());
    });

    it("new object", async () => {
        const user = new User();
        assert.equal(user._kind, "User");
        assert.equal(user._namespace, "testing");
        assert.equal(user._kind, userRepository.kind);
        assert.equal(user._namespace, userRepository.namespace);

        // _kind and _namespace is not enumerable
        user._kind = "hello";
        user._namespace = "hello";
        const keys = Object.keys(user);
        assert.isFalse(keys.includes("_kind"));
        assert.isFalse(keys.includes("_namespace"));

        // guild is set to enumerable
        const guild = new Guild();
        guild._ancestorKey = user.getKey();
        assert.containsAllKeys(guild, ["_kind", "_namespace", "_ancestorKey"]);
    });

    it("getKey", async () => {
        const user1 = new User();
        const key1 = user1.getKey();
        assert.equal(key1.namespace, "testing");
        assert.equal(key1.namespace, user1._namespace);
        assert.equal(key1.kind, "User");
        assert.equal(key1.kind, user1._kind);
        assert.equal(key1.id, "0");
        assert.equal(key1.id, user1._id.toString());
    });

    it("basic operation", async () => {
        // create
        const now = new Date();
        const user = new User();
        user.number = 100;
        assert.equal(user._id, 0);
        await userRepository.insert(user);
        assert.isAtLeast(user._id, 1);

        // update
        user.number = 101;
        await userRepository.update(user);

        const findUser1 = await userRepository.findOne(user._id);
        assert.deepEqual(findUser1, user);

        // delete
        await userRepository.delete(user);

        const findUser2 = await userRepository.findOne(user._id);
        assert.isUndefined(findUser2);
    });

    it("generateId", async () => {
        const user1 = new User();
        await userRepository.insert(user1);
        assert.isTrue(user1._id > 0);

        // we assign non number or string, it will still trigger generate id
        for (const id of [null, undefined, new Date(), false, []]) {
            const user2 = new User();
            (user2 as any)._id = id;
            assert.isUndefined(user2.getKey().id);

            await userRepository.insert(user2);
            assert.isTrue(user2._id > 0);
        }
    });

    it("insert and find entity", async () => {
        // create
        const values = {
            date: new Date(),
            number: Math.random(),
            array: [1, 2, 3],
            string: "abc",
            buffer: Buffer.alloc(10),
            object: {name: "Terence"},
            undefined,
            null: null,
        };
        const user = userRepository.create(values);
        await userRepository.insert(user);

        const findUser = await userRepository.findOne(user._id);
        assert.isDefined(findUser);
        assert.deepEqual(findUser, user);
    });

    it("upsert entity", async () => {
        const user = userRepository.create();
        await userRepository.upsert(user);

        // this will do an update
        user.number = 10;
        await userRepository.upsert(user);

        // delete
        await userRepository.delete(user);

        // upserert again
        await userRepository.upsert(user);
    });

    it("create entity with empty space", async () => {
        const guild1 = guildRepository.create({_id: "  abc  "});
        await guildRepository.insert(guild1);
        assert.equal(guild1._id, "  abc  ");

        const guild2 = guildRepository.create({_id: "  "});
        await guildRepository.insert(guild2);
        assert.equal(guild2._id, "  ");

        const findGuild2 = await guildRepository.findOne(guild2._id);
        assert.equal(findGuild2!._id, guild2._id);
    });

    it("merge entity", async () => {
        const user = userRepository.create();
        await userRepository.insert(user);
        await userRepository.merge(user);
    });

    it("allocate ids", async () => {
        const ids = await userRepository.allocateIds(10);
        const users = ids.map(_id => userRepository.create({_id}));
        await userRepository.insert(users);

        users.forEach((user, i) => {
            assert.equal(user._id, ids[i]);
        });
    });

    it("auto generate id", async () => {
        const user = userRepository.create({number: 5});
        assert.equal(user._id, 0);
        await userRepository.insert(user);
        assert.isAtLeast(user._id, 10000000000);
    });

    it("insert array of entities", async () => {
        const ids = [1, 2, 3, 4, 5];
        const entities = [];
        for (let i = 0; i < ids.length; i++) {
            const entity = new User();
            entity._id = ids[i];
            entity.string = "value: " + i;
            entity.array.push(i);
            entity.object = {name: i};
            entity.buffer = Buffer.alloc(i + 1);
            entities.push(entity);
        }
        await userRepository.insert(entities);

        // findOne
        const entity1 = await userRepository.findOne(ids[0]);
        assert.isDefined(entity1);

        // findMany
        const entities1 = await userRepository.findMany(ids);
        assert.equal(entities1.length, ids.length);

        // find Many by keys
        const entities2 = await userRepository.findMany(entities.map(x => x.getKey()));
        assert.equal(entities2.length, ids.length);

        // query
        const entities3 = await userRepository
            .query()
            .filter("_id", x => x.ge(ids[0]))
            .filter("_id", x => x.le(ids[ids.length - 1]))
            .findMany();
        assert.equal(entities3.length, ids.length);
    });

    it("batch operations", async () => {
        const total = 100;
        const entities = Array(total).fill(0).map((x, i) => {
            const user = new User();
            user.number = i;
            return user;
        });

        // insert
        await userRepository.insert(entities);
        const users1 = await userRepository.findMany(entities.map(x => x._id));
        assert.equal(users1.length, total);

        // updates
        entities.forEach(x => {
            x.number = Math.random();
        });
        await userRepository.update(entities);

        // delete
        const a = await userRepository.delete(entities);
        const users2 = await userRepository.findMany(entities.map(x => x._id));
        assert.equal(users2.length, 0);
    });

    it("ancestor", async () => {
        const user = userRepository.create();
        await userRepository.insert(user);

        const taskGroup = taskGroupRepository.create({_ancestorKey: user.getKey(), name: "Group1"});
        await taskGroupRepository.insert(taskGroup);

        const totalTasks = 10;
        const tasks: Task[] = [];
        for (let i = 0; i < totalTasks; i++) {
            const task = taskRepository.create({_ancestorKey: taskGroup.getKey(), deadline: new Date()});
            tasks.push(task);
        }
        await taskRepository.insert(tasks);

        // getting back all the data
        for (let i = 0; i < totalTasks; i++) {
            const findTask1 = await taskRepository.findOne(tasks[i]._id);
            assert.isUndefined(findTask1);

            const findTask2 = await taskRepository.findOne(tasks[i].getKey());
            assert.isDefined(findTask2);
            assert.deepEqual(tasks[i], findTask2);

            const findTask3 = await taskRepository.query()
                .setAncestorKey(taskGroup.getKey())
                .filterKey(x => x.eq(tasks[i].getKey())).findOne();
            assert.isDefined(findTask3);

            // this also works the same
            const findTask4 = await taskRepository.query()
                .filterKey(tasks[i].getKey()).findOne();
            assert.isDefined(findTask4);
            assert.deepEqual(tasks[i], findTask4);

            const findTask5 = await taskRepository.query()
                .setAncestorKey(taskGroup.getKey())
                .filter("_id", tasks[i]._id).findOne();
            assert.isDefined(findTask5);
            assert.deepEqual(tasks[i], findTask5);

            const findTaskGroup = await taskGroupRepository.findOne(findTask5!._ancestorKey!);
            assert.isDefined(findTaskGroup);
            assert.deepEqual(findTaskGroup, taskGroup);

            const findUser = await userRepository.findOne(findTaskGroup!._ancestorKey!);
            assert.isDefined(findUser);
            assert.deepEqual(findUser, user);
        }
    });
});
