import * as Datastore from "@google-cloud/datastore";
import cluster from "cluster";
import {getUsedMemoryInMb} from "../utils";

// datastore
const dataStore = new Datastore.Datastore({keyFilename: "./serviceAccount.json"});

// settings
const kind = "speed";
const workerId = process.env.workerId || 0;
const reportDuration = 5 * 1000;
const createBatch = 100;
let total = 0;
let date = new Date();

async function startCluster() {
    const totalWorker = 30;
    console.log(`Total worker: ${totalWorker}`);
    for (let i = 0; i < totalWorker; i++) {
        cluster.fork({workerId: i});
    }
}

async function startWorker() {
    setTimeout(reportWorker, reportDuration);

    while (true) {
        const entities = Array(createBatch).fill(0).map((x, j) => {
            const key = dataStore.key({namespace: "testing", path: [kind]});
            return {key, data: {}};
        });
        await dataStore.save(entities);
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
