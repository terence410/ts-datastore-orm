import { assert, expect } from "chai";
import {BaseEntity, Batcher, Column, Entity, Transaction} from "../src";

@Entity({namespace: "testing", kind: "eventTest"})
export class EventTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";
}

let existEntity1: EventTest;
let existEntity2: EventTest;
let existEntity3a: EventTest;
let existEntity3b: EventTest;

describe("Event Test", () => {
    it("truncate", async () => {
        await EventTest.truncate();
        [existEntity1] = await EventTest.create({name: "Exist"}).save();
        [existEntity2] = await EventTest.create({name: "Exist"}).save();
        [existEntity3a] = await EventTest.create({name: "Exist"}).save();
        [existEntity3b] = await EventTest.create({name: "Exist"}).save();
    });

    it("create entity", async () => {
        const sequence = [];
        const events = EventTest.getEvents();

        const promise1 = new Promise(resolve => {
            events.on("create", entity => {
                sequence.push("create");
                resolve(entity);
            });
        });

        const promise2 = new Promise(resolve => {
            events.on("update", entity => {
                sequence.push("update");
                resolve(entity);
        });
        });

        const promise3 = new Promise(resolve => {
            events.on("delete", entity => {
                sequence.push("delete");
                resolve(entity);
            });
        });

        const [entity1] = await EventTest.create({name: "Create"}).save();
        sequence.push(1);
        await existEntity1.save();
        sequence.push(2);
        await entity1.delete();
        sequence.push(3);

        const results = await Promise.all([promise1, promise2, promise3]);
        assert.deepEqual(sequence, [1, "create", 2, "update", 3, "delete"]);
    });

    it("create entity in batcher", async () => {
        const sequence = [];
        const batcher = new Batcher();
        const events = EventTest.getEvents();

        const promise1 = new Promise(resolve => {
            events.on("create", entity => {
                sequence.push("create");
                resolve(entity);
            });
        });

        const promise2 = new Promise(resolve => {
            events.on("update", entity => {
                sequence.push("update");
                resolve(entity);
            });
        });

        const promise3 = new Promise(resolve => {
            events.on("delete", entity => {
                sequence.push("delete");
                resolve(entity);
            });
        });

        const entity1 = EventTest.create({name: "Create"});
        await batcher.saveMany([entity1, existEntity2]);
        sequence.push(1);
        await batcher.deleteMany([entity1]);
        sequence.push(2);
        const results = await Promise.all([promise1, promise2, promise3]);

        // validate
        assert.deepEqual(sequence, [1, "create", "update", 2, "delete"]);
    });

    it("create entity in transaction", async () => {
        const sequence: any[] = [];

        const events = EventTest.getEvents();
        const promise1 = new Promise(resolve => {
            events.on("create", entity => {
                sequence.push("create");
                resolve(entity);
            });
        });

        const promise2 = new Promise(resolve => {
            events.on("update", entity => {
                sequence.push("update");
                resolve(entity);
            });
        });

        const promise3 = new Promise(resolve => {
            events.once("delete", entity => {
                sequence.push("delete");
                resolve(entity);
            });
        });

        await Transaction.execute(async transaction => {
            const entity1 = EventTest.create({name: "Create"});
            transaction.save(entity1);
            transaction.save(existEntity3a);
            transaction.delete(existEntity3b);
            sequence.push(1);
        });

        const results = await Promise.all([promise1, promise2, promise3]);
        assert.deepEqual(sequence, [1, "create", "update", "delete"]);
    });
});
