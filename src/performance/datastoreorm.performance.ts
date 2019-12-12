import cluster from "cluster";
import os from "os";
import {BaseEntity, Batcher, Column, Entity} from "../index";
import {getUsedMemory} from "../utils";

async function startCluster() {
    const totalWorker = 30;
    console.log(`Total worker: ${totalWorker}`);
    for (let i = 0; i < totalWorker; i++) {
        cluster.fork({workerId: i});
    }
}

@Entity({kind: "speed1"})
export class Speed extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public date: Date = new Date();

    @Column({index: true})
    public number1: number = 0;

    @Column({index: true})
    public number2: number = 0;

    @Column({index: true})
    public string1: string = "";
}
const workerId = process.env.workerId || 0;
const reportDuration = 5 * 1000;
const createBatch = 100;
let total = 0;
let date = new Date();
function report() {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    console.log(`WorkerId: ${workerId}, Total created entity: ${total} in: ${diff / 1000}s, now: ${now}, memory: ${getUsedMemory()}MB`);
    date = now;
    total = 0;
    setTimeout(report, reportDuration);
}

async function startWorker() {
    const batcher = new Batcher();
    setTimeout(report, reportDuration);

    let count = 0;
    while (true) {
        const entities = Array(createBatch).fill(0).map((x, j) => {
            const entity = Speed.create();
            entity.number1 = count++;
            entity.number2 = count * 10;
            entity.string1 = (100000 + count).toString();
            entity.date.setTime(entity.date.getTime() + j);
            return entity;
        });
        await batcher.saveMany(entities);
        total += createBatch;
    }
}

// cluster
if (cluster.isMaster) {
    startCluster();
} else {
    startWorker();
}
