import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export function createMd5(value: string | Buffer): string {
    return crypto.createHash("md5").update(value).digest("hex");
}

export function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateRandomString(length: number) {
    const value = crypto.randomBytes(length / 2 | 0).toString("hex");
    return value.substr(0, length);
}

export function getUsedMemory() {
    return (process.memoryUsage().heapUsed / 1024 / 1024) | 0;
}

export function readJsonFile(filename: string) {
    filename = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);
    const rawData = fs.readFileSync(filename);
    return JSON.parse(rawData.toString());
}
