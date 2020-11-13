import cluster from "cluster";
import {BaseEntity, createConnection, Entity, Field} from "../index";
import {getUsedMemoryInMb} from "../utils";

// entity
@Entity({kind: "speed2", namespace: "testing"})
export class Speed extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field({index: true})
    public date: Date = new Date();

    @Field({index: true})
    public number1: number = 0;

    @Field({index: true})
    public number2: number = 0;

    @Field({index: true})
    public string1: string = "";
}

// settings
const workerId = process.env.workerId || 0;
const reportDuration = 5 * 1000;
const createBatch = 100;
let total = 0;
let date = new Date();

async function startCluster() {
    const totalWorker = 1;
    console.log(`Total worker: ${totalWorker}`);
    for (let i = 0; i < totalWorker; i++) {
        cluster.fork({workerId: i});
    }
}

async function startWorker() {
    setTimeout(reportWorker, reportDuration);

    const connection = await createConnection({
        keyFilename: "./datastoreServiceAccount.json",
    });
    const repository = connection.getRepository(Speed);

    let count = 0;
    while (true) {
        const entities = Array(createBatch).fill(0).map((x, j) => {
            const entity = new Speed();
            entity.number1 = count++;
            entity.number2 = count * 10;
            entity.string1 = (100000 + count).toString();
            entity.date.setTime(entity.date.getTime() + j);
            return entity;
        });
        await repository.insert(entities);
        total += createBatch;
    }
}

function reportWorker() {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    console.log(`WorkerId: ${workerId}, Total created entity: ${total} in: ${diff / 1000}s, now: ${now}, memory: ${getUsedMemoryInMb()}MB`);
    date = now;
    total = 0;
    setTimeout(reportWorker, reportDuration);
}

// cluster
if (cluster.isMaster) {
    startCluster();
} else {
    startWorker();
}
