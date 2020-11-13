import * as Datastore from "@google-cloud/datastore";
import {decoratorMeta} from "../decoratorMeta";
import {ILockCallback, ILockManagerParams} from "../types";
import {Lock} from "./Lock";
import {LockEntity} from "./LockEntity";

export class LockManager {
    public readonly datastore: Datastore.Datastore;
    public readonly classObject: typeof LockEntity;
    public readonly namespace: string | undefined;
    public readonly kind: string;
    public readonly expiresIn: number;
    public readonly maxRetry: number;
    public readonly retryDelay: number;

    constructor(options: ILockManagerParams) {
        const classObject = LockEntity;
        const entityMeta = decoratorMeta.getEntityMeta(classObject);
        const namespace = options?.namespace || entityMeta.namespace;
        const kind = options?.kind || entityMeta.kind;

        this.datastore = options.datastore;
        this.classObject = classObject;
        this.namespace = namespace === "" ? undefined : namespace;
        this.kind = kind;
        this.expiresIn = options.expiresIn;
        this.maxRetry = options.maxRetry;
        this.retryDelay = options.retryDelay;
    }

    public async start<R extends any>(lockKey: string, callback: ILockCallback<R>): Promise<{value: R}> {
        const lock = new Lock({
            lockKey,
            classObject: this.classObject,
            datastore: this.datastore,
            namespace: this.namespace,
            kind: this.kind,
            expiresIn: this.expiresIn,
            maxRetry: this.maxRetry,
            retryDelay: this.retryDelay,
        });

        return await lock.start(callback);
    }
}
