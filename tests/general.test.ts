import { assert, expect } from "chai";
import {datastoreOrm} from "../src";
import {Batcher} from "../src/Batcher";
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

    it("allocate ids", async () => {
        const [ids] = await User.allocateIds(10);
        const users = ids.map(id => User.create({id}));
        await batcher.saveMany(users);
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
        for (let i = 0; i < ids.length; i++) {
            const entity = new User();
            entity.id = ids[i];
            entity.string = "value: " + i;
            entity.array.push(i);
            entity.object = {name: i};
            entity.buffer = Buffer.alloc(i + 1);
            await entity.save();
        }

        const [entities1] = await User.findMany(ids);
        const [entities2] = await User
            .query()
            .filter("id", ">=", ids[0])
            .filter("id", "<=", ids[ids.length - 1])
            .run();
        assert.equal(entities1.length, ids.length);
        assert.equal(entities2.length, ids.length);
    });
});

describe("General Test: Batcher", () => {
    it("batch create", async () => {
        const total = 100;
        const entities = Array(total).fill(0).map((x, i) => {
            return User.create({number: i});
        });
        await batcher.saveMany(entities);
        const [users1] = await User.findMany(entities.map(x => x.id));
        assert.equal(users1.length, total);

        await batcher.deleteMany(entities);
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
        const [taskGroups1] = await TaskGroup.query().setAncestor(user1).run();
        assert.equal(taskGroups1.length, 1);

        const [taskGroups2] = await TaskGroup.query().filterKey("=", taskGroup1.getKey()).run();
        assert.equal(taskGroups2.length, 1);

        const key = datastoreOrm.createKey([User, user1.id, TaskGroup, taskGroup1.id]);
        const [taskGroups3] = await TaskGroup.query().filterKey("=", key).run();
        assert.equal(taskGroups3.length, 1);
    });
});

