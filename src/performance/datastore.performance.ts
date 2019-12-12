import * as Datastore from "@google-cloud/datastore";
import cluster from "cluster";
import os from "os";
import {configLoader} from "../configLoader";
import {getUsedMemory} from "../utils";

const config = configLoader.getConfig();
const dataStore = new Datastore.Datastore({keyFilename: config.keyFilename});

async function startCluster() {
    const totalWorker = 30;
    console.log(`Total worker: ${totalWorker}`);
    for (let i = 0; i < totalWorker; i++) {
        cluster.fork({workerId: i});
    }
}

const kind = "speed1";
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
    setTimeout(report, reportDuration);

    while (true) {
        const entities = Array(createBatch).fill(0).map((x, j) => {
            const key = dataStore.key({namespace: "testing", path: [kind]});
            return {
                key,
                data: {},
            };
        });
        await dataStore.save(entities);
        total += createBatch;
    }
}

// cluster
if (cluster.isMaster) {
    startCluster();
} else {
    startWorker();
}
