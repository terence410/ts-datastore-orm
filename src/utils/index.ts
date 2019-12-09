import crypto from "crypto";

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
