import { assert, expect } from "chai";
import {datastoreOrm} from "../src";
import {Batcher} from "../src/Batcher";
// @ts-ignore
import {Guild} from "./entities/Guild";
// @ts-ignore
import {Task} from "./entities/Task";
// @ts-ignore
import {TaskGroup} from "./entities/TaskGroup";
// @ts-ignore
import {User} from "./entities/User";

const batcher = new Batcher();

describe("General Test", () => {
    it("truncate", async () => {
        await User.truncate();
        await TaskGroup.truncate();
        await Task.truncate();
    });

    it("create entity", async () => {
        // create
        const now = new Date();
        const user = new User();
        user.id = 999;
        user.number = 100;
        await user.save();

        // update
        user.number = 101;
        await user.save();

        // deprecated call
        const date = user.get("date");
        user.set("date", new Date());

        // to json
        const json = user.toJSON();
        const values = user.getValues();

        // delete
        await user.delete();
    });

    it("create and read entity", async () => {
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
        const user = User.create(values);
        await user.save();
        
        const [foundUser] = await User.find(user.id);
        assert.isDefined(foundUser);
        if (foundUser) {
            assert.deepEqual(user.getValues(), foundUser.getValues());
            assert.deepEqual(foundUser.getValues(), Object.assign(values, {id: user.id}));
        }
    });

    it("create entity with empty space", async () => {
        const guild1 = Guild.create({id: " abc  "});
        assert.equal(guild1.id, "abc");

        const guild2 = Guild.create({id: "  "});
        assert.equal(guild2.id, "");
    });

    it("allocate ids", async () => {
        const [ids] = await User.allocateIds(10);
        const users = ids.map(id => User.create({id}));
        await batcher.save(users);
        users.forEach((user, i) => {
            assert.equal(user.id, ids[i]);
        });
    });

    it("auto generate id", async () => {
        const user = User.create({number: 5});
        assert.equal(user.id, 0);
        await user.save();
        assert.isAtLeast(user.id, 10000000000);
    });

    it("new entity", async () => {
        const ids = [1, 2, 3, 4, 5];
        const entities = [];
        for (let i = 0; i < ids.length; i++) {
            const entity = new User();
            entity.id = ids[i];
            entity.string = "value: " + i;
            entity.array.push(i);
            entity.object = {name: i};
            entity.buffer = Buffer.alloc(i + 1);
            await entity.save();
            entities.push(entity);
        }

        // findOne
        const [entity1] = await User.find(ids[0]);
        assert.isDefined(entity1);

        // findMany
        const [entities1] = await User.findMany(ids);
        assert.equal(entities1.length, ids.length);

        // find Many by keys
        const [entities2] = await User.findMany(entities.map(x => x.getKey()));
        assert.equal(entities2.length, ids.length);

        // query
        const [entities3] = await User
            .query()
            .filter("id", ">=", ids[0])
            .filter("id", "<=", ids[ids.length - 1])
            .run();
        assert.equal(entities3.length, ids.length);
    });

    it("merge value", async () => {
        const date = new Date();
        const values = {
            number: 123,
            date: new Date(),
            string: "abc",
            array: [1, 2, 3],
            object: {a: 1, b: 2, c: 3},
            buffer: Buffer.alloc(5),
        };
        const user = User.create(values);
        await user.save();

        // merge some values
        const mergeObjects: Array<[string, any]> = [
            ["date", new Date(123)],
            ["number", 456],
            ["string", "xyz"],
            ["array", [4, 5, 6]],
            ["object", {x: 4, y: 5, z: 6}],
            ["buffer", Buffer.alloc(10)],
        ];

        for (const [key, value] of mergeObjects) {
            const mergeValues = {[key]: value};
            await user.merge(mergeValues);
            assert.equal(user.get(key as any), value);

            const [newUser] = await User.find(user.id);
            if (newUser) {
                assert.deepEqual(user.getValues(), newUser.getValues());
            }
        }
    });
});

describe("General Test: Batcher", () => {
    it("batch create", async () => {
        const total = 100;
        const entities = Array(total).fill(0).map((x, i) => {
            return User.create({number: i});
        });

        // insert
        await batcher.save(entities);
        const [users1] = await User.findMany(entities.map(x => x.id));
        assert.equal(users1.length, total);

        // updates
        entities.forEach(x => {
            x.number = Math.random();
        });
        await batcher.save(entities);

        // delete
        await batcher.delete(entities);
        const [users2] = await User.findMany(entities.map(x => x.id));
        assert.equal(users2.length, 0);
    });
});

describe("General Test: Entity Group", () => {
    it("user task", async () => {
        const user1 = User.create({id: 1000});
        await user1.save();

        const user2 = User.create({id: 10001});
        await user2.save();

        const taskGroup1 = TaskGroup.create({id: 1, name: "group 1"});
        taskGroup1.setAncestor(user1);
        await taskGroup1.save();

        const taskGroup2 = TaskGroup.create({id: 2, name: "group 2"});
        taskGroup2.setAncestor(user2);
        await taskGroup2.save();

        const task1 = Task.create({id: 1, total: 11});
        task1.setAncestor(taskGroup1);
        await task1.save();

        const task2 = Task.create({id: 2, total: 12});
        task2.setAncestor(taskGroup2);
        await task2.save();

        // query
        const [taskGroupList1] = await TaskGroup.query().setAncestor(user1).run();
        assert.equal(taskGroupList1.length, 1);

        const [taskGroupList2] = await TaskGroup.query().filterKey("=", taskGroup1.getKey()).run();
        assert.equal(taskGroupList2.length, 1);

        const key = datastoreOrm.createKey([User, user1.id, TaskGroup, taskGroup1.id]);
        const [taskGroupList3] = await TaskGroup.query().filterKey("=", key).run();
        assert.equal(taskGroupList3.length, 1);
        
        // find many
        const [taskGroups4] = await TaskGroup.findMany({ancestor: user1, ids: [1, 2]});
        assert.equal(taskGroups4.length, 1);

        const [task3] = await Task.find({ancestor: taskGroup1, id: 1});
        assert.isDefined(task3);

        if (task3) {
            const [taskGroup3] = await task3.getAncestor(TaskGroup);
            const [user3] = await task3.getAncestor(User);
            assert.isDefined(taskGroup3);
            assert.isDefined(user3);

            if (taskGroup3 && user3) {
                assert.equal(task3.getAncestorId(TaskGroup), taskGroup3.id);
                assert.equal(task3.getAncestorId(User), user3.id);
            }
        }
    });
});
