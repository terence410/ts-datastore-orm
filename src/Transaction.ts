// https://cloud.google.com/datastore/docs/concepts/transactions

import * as DataStore from "@google-cloud/datastore";
import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
import {errorCodes} from "./enums/errorCodes";
import {DatastoreOrmNativeError} from "./errors/DatastoreOrmNativeError";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {eventEmitters} from "./eventEmitters";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {Query} from "./Query";
import {
    IArgvAllocateIds,
    IArgvFind,
    IArgvFindMany,
    IArgvId,
    IKey,
    IRequestResponse, ITransactionDefaultOptions,
    ITransactionExecuteOptions, ITransactionOptions,
    ITransactionResponse,
} from "./types";
// datastore transaction operations:
// insert: save if not exist
// update: save if exist
// save, upsert: save not matter exist or not
// merge: merge partial keys, has bugs
// above should not use await (it probably will be done by batch by transaction)

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const defaultOptions: ITransactionDefaultOptions = {delay: 50, maxRetry: 0};

export class Transaction {
    public static setDefaultOptions(lockOptions: Partial<ITransactionExecuteOptions> = {}) {
        Object.assign(defaultOptions, lockOptions);
    }
    
    public static async execute<T extends any>(callback: (transaction: Transaction) => Promise<T>,
                                               options: Partial<ITransactionExecuteOptions> = {}): Promise<[T, ITransactionResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // return result
        let result: any;
        const transactionResponse: ITransactionResponse = {
            hasCommitted: false,
            totalRetry: 0,
            executionTime: 0,
            createdEntities: [],
            updatedEntities: [],
            deletedEntities: [],
        };

        // options
        const delay = options.delay || defaultOptions.delay;
        const maxRetry = Math.max(0, options.maxRetry || defaultOptions.maxRetry);

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        let retry = 0;
        do {
            // start transaction
            const transaction = new Transaction(options);
            try {
                // init transaction
                await transaction.run();

                // run the callback
                result = await callback(transaction);

                // check if user has cancelled the commit
                if (!transaction.hasRollback) {
                    await transaction.commit();
                    transactionResponse.hasCommitted = true;
                }

                transactionResponse.createdEntities = transaction.createdEntities;
                transactionResponse.updatedEntities = transaction.updatedEntities;
                transactionResponse.deletedEntities = transaction.deletedEntities;

                // break out the retry loop
                break;

            } catch (err) {
                // if we don't rollback, it will be faster
                await transaction.rollback();

                // retry transaction only if aborted
                if (err.code === errorCodes.ABORTED) {
                    if (retry < maxRetry) {
                        transactionResponse.totalRetry = retry;

                        // wait for a while
                        await timeout(delay);
                        continue;
                    }
                }

                // we reached max retry or not able to retry, throw the error
                if (friendlyErrorStack) {
                    err.stack = friendlyErrorStack;
                }

                throw err;
            }
        } while (retry++ < maxRetry);

        return [result, Object.assign(transactionResponse, performanceHelper.readResult())];
    }

    // datastore transaction
    public datastoreTransaction: DataStore.Transaction;

    // entities pending for save
    public createdKeys: IKey[] = [];
    public createdEntities: BaseEntity[] = [];
    public updatedEntities: BaseEntity[] = [];
    public deletedEntities: BaseEntity[] = [];

    // internal handling for rollback
    public hasRollback: boolean = false;
    private _connection: string;
    private _hasCompleted: boolean = false;
    private _hasStarted: boolean = false;

    constructor(options: Partial<ITransactionOptions> = {}) {
        this._connection = options.connection || "default";
        const datastore = datastoreOrm.getConnection(this._connection);
        this.datastoreTransaction = datastore.transaction({readOnly: options.readOnly});
    }

    // region public methods

    // start transaction
    public async run() {
        if (this._hasCompleted) {
            throw new DatastoreOrmOperationError(`You cannot rerun a transaction.`);
        }

        // rest the data (in case the transaction is reused)
        this._hasStarted = true;
        this.createdKeys = [];
        this.createdEntities = [];
        this.updatedEntities = [];
        this.deletedEntities = [];

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            await this.datastoreTransaction.run();
        } catch (err) {
            const error = new DatastoreOrmNativeError(`Transaction Run Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    public async commit(): Promise<[IRequestResponse]> {
        this._hasCompleted = true;

        const performanceHelper = new PerformanceHelper().start();

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            const [result] = await this.datastoreTransaction.commit();
            this._processCreatedKeys();
            this._processEvents();
            return [performanceHelper.readResult()];

        } catch (err) {
            const error = new DatastoreOrmNativeError(`Transaction Commit Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    public async rollback(): Promise<[IRequestResponse]> {
        // reset data
        this.createdKeys = [];
        this.createdEntities = [];
        this.updatedEntities = [];
        this.deletedEntities = [];
        this.hasRollback = true;
        this._hasCompleted = true;

        const performanceHelper = new PerformanceHelper().start();

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            await this.datastoreTransaction.rollback();
            return [performanceHelper.readResult()];

        } catch (err) {
            const error = new DatastoreOrmNativeError(`Transaction Rollback Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    public query<T extends typeof BaseEntity>(entityType: T) {
        const entityMeta = datastoreOrm.getEntityMeta(entityType);
        return new Query(entityType, this);
    }

    public async find<T extends typeof BaseEntity>(entityType: T, argv: IArgvId | IArgvFind): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        // parse argv
        let id: IArgvId = argv as IArgvId;
        let namespace: string | undefined;
        let ancestor: BaseEntity | undefined;
        if (typeof argv === "object" && argv.id) {
            namespace = (argv as IArgvFind).namespace;
            ancestor = (argv as IArgvFind).ancestor;
            id = (argv as IArgvFind).id;
        }

        // validate
        this._validateEntity(entityType);

        const [entities, requestResponse] = await this.findMany(entityType, {namespace, ancestor, ids: [id]});
        return [entities.length ? entities[0] : undefined, requestResponse];
    }

    public async findMany<T extends typeof BaseEntity>(entityType: T, argv: IArgvId[] | IArgvFindMany): Promise<[Array<InstanceType<T>>, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // parse argv
        let ids = argv as IArgvId[];
        let namespace: string | undefined;
        let ancestorKey: IKey | undefined;
        if (!Array.isArray(argv)) {
            namespace = argv.namespace;
            ancestorKey = argv.ancestor ? argv.ancestor.getKey() : undefined;
            ids = argv.ids;
        }

        // validate
        this._validateEntity(entityType);

        // friendly error
        if (ids.length) {
            const keys = datastoreOrm.mapIdsToKeys(entityType, ids, namespace, ancestorKey);

            // friendly error
            const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
            try {
                const [results] = await this.datastoreTransaction.get(keys);

                // convert into entities
                let entities: any[] = [];
                if (Array.isArray(results)) {
                    entities = results.map(x => entityType.newFromEntityData(x));
                }

                return [entities, performanceHelper.readResult()];

            } catch (err) {
                const error = new DatastoreOrmNativeError(`(${entityType.name}) Transaction Find Error. ids (${ids.join(", ")}). Error: ${err.message}.`,
                    err.code,
                    err);
                if (friendlyErrorStack) {
                    error.stack = friendlyErrorStack;
                }

                throw error;
            }
        }

        return [[], performanceHelper.readResult()];
    }

    public save<T extends BaseEntity>(entities: T | T[]) {
        if (!Array.isArray(entities)) {
            entities = [entities];
        }

        // validate
        this._validateEntities(entities);

        // pass to transaction
        const insertEntities = entities.filter(x => x.isNew);
        const updateEntities = entities.filter(x => !x.isNew);

        if (insertEntities.length) {
            // set isNew to false
            const insertSaveDataList = insertEntities.map(x => x.getSaveData());
            insertEntities.forEach(x => x.isNew = false);
            this.datastoreTransaction.insert(insertSaveDataList);
            this.createdKeys = this.createdKeys.concat(insertSaveDataList.map(x => x.key));

            // append to created entities
            this.createdEntities = this.createdEntities.concat(entities);
        }

        if (updateEntities.length) {
            updateEntities.forEach(x => x.isNew = false);
            const updateSaveDataList = updateEntities.map(x => x.getSaveData());
            this.datastoreTransaction.update(updateSaveDataList);

            // append to updated entities
            this.updatedEntities = this.updatedEntities.concat(entities);
        }
    }

    public delete<T extends BaseEntity>(entities: T | T[]) {
        if (!Array.isArray(entities)) {
            entities = [entities];
        }

        // validate
        this._validateEntities(entities);

        // pass to transaction
        const keys = entities.map(x => x.getKey());
        this.datastoreTransaction.delete(keys);

        // append to deleted entities
        this.deletedEntities = this.deletedEntities.concat(entities);
    }

    public async allocateIds<T extends typeof BaseEntity>(entityType: T, argv: number | IArgvAllocateIds): Promise<[number[], IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // parse argv
        let total = argv as number;
        let namespace = "";
        if (typeof argv === "object") {
            total = argv.total;
            namespace = argv.namespace;
        }

        const key = datastoreOrm.createKey({namespace, path: [entityType]});

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            const [keys] = await this.datastoreTransaction.allocateIds(key, {allocations: total});
            const ids = keys.map(x => Number(x.id));

            return [ids, performanceHelper.readResult()];

        } catch (err) {
            const error = new DatastoreOrmNativeError(`(${entityType.name}) Transaction Allocate Ids Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    // endregion

    // region private methods
    private _validateEntity<T extends typeof BaseEntity>(entityType: T) {
        if (!this._hasStarted) {
            throw new DatastoreOrmOperationError(`Please call await transaction.run().`);
        }

        const entityMeta = datastoreOrm.getEntityMeta(entityType);
        if (entityMeta.connection !== this._connection) {
            throw new DatastoreOrmOperationError(
                `(${entityType.name}) This entity is using a connection "${entityMeta.connection}" while the transaction is connected to "${this._connection}"`);
        }
    }

    private _validateEntities<T extends BaseEntity, G extends typeof BaseEntity>(entities: T[]) {
        for (const entity of entities) {
            this._validateEntity(entity.constructor as G);
        }
    }

    private _processCreatedKeys() {
        for (let i = 0; i < this.createdKeys.length; i++) {
            const entity = this.createdEntities[i];
            const newKey = this.createdKeys[i];
            if (!(entity as any)._id) {
                (entity as any)._set("id", Number(newKey.id));
            }
        }
    }

    private _processEvents() {
        // emit events
        this.createdEntities.forEach(x => eventEmitters.emit("create", x));
        this.updatedEntities.forEach(x => eventEmitters.emit("update", x));
        this.deletedEntities.forEach(x => eventEmitters.emit("delete", x));
    }

    // endregion
}
