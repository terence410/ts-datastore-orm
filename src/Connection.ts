import * as Datastore from "@google-cloud/datastore";
import {BaseEntity} from "./BaseEntity";
import {DatastoreAdmin} from "./DatastoreAdmin";
import {decoratorMeta } from "./decoratorMeta";
import {LockEntity} from "./locks/LockEntity";
import {LockManager} from "./locks/LockManager";
import {Repository} from "./Repository";
import {TransactionManager} from "./transactions/TransactionManager";
import {ILockManagerOptions, ITransactionManagerOptions} from "./types";

export class Connection {
    public readonly datastore: Datastore.Datastore;

    constructor(options: {datastore: Datastore.Datastore}) {
        this.datastore = options.datastore;
    }

    public getRepository<T extends typeof BaseEntity>(classObject: T, options?: {namespace?: string, kind?: string}): Repository<T> {
        const entityMeta = decoratorMeta.getEntityMeta(classObject);
        const namespace = options?.namespace || entityMeta.namespace;

        return new Repository({
            datastore: this.datastore,
            classObject,
            namespace: namespace === "" ? undefined : namespace,
            kind: options?.kind || entityMeta.kind,
        });
    }

    public getTransactionManager(options: Partial<ITransactionManagerOptions> = {}) {
        return new TransactionManager({
            datastore: this.datastore,
            maxRetry: options.maxRetry || 0,
            retryDelay: options.retryDelay || 0,
            readOnly: options.readOnly || false,
        });
    }

    public getLockManager(options: ILockManagerOptions) {
        return new LockManager({
            namespace: options.namespace,
            kind: options.kind,
            datastore: this.datastore,
            expiresIn: options.expiresIn,
            maxRetry: options.maxRetry || 0,
            retryDelay: options.retryDelay || 0,
        });
    }

    public getAdmin() {
        return new DatastoreAdmin({datastore: this.datastore});
    }
}
