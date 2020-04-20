import * as Datastore from "@google-cloud/datastore";
import {Batcher} from "./Batcher";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmDatastoreError} from "./errors/DatastoreOrmDatastoreError";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {eventEmitters} from "./eventEmitters";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {Query} from "./Query";
import {
    IArgvAllocateIds,
    IArgvColumn, IArgvFind, IArgvFindMany,
    IArgvId, IArgvNamespace,
    IArgvValue,
    IArgvValues,
    IEntityData, IEvents,
    IKey, IPropType,
    IRequestResponse,
} from "./types";

export class BaseEntity {
    // region static methods

    public static create<T extends typeof BaseEntity>(this: T, values: Partial<IArgvValues<InstanceType<T>>> = {}): InstanceType<T> {
        return (new this() as InstanceType<T>).setValues(values);
    }

    public static query<T extends typeof BaseEntity>(this: T): Query<T> {
        return new Query(this);
    }

    public static getEvents<T extends typeof BaseEntity>(this: T): IEvents<InstanceType<T>> {
        return eventEmitters.getEventEmitter(this, true);
    }

    public static async find<T extends typeof BaseEntity>(this: T, argv: IArgvId | IArgvFind): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        // parse argv
        let id: IArgvId = argv as IArgvId;
        let namespace: string | undefined;
        let ancestor: BaseEntity | undefined;
        if (typeof argv === "object" && argv.id) {
            namespace = (argv as IArgvFind).namespace;
            ancestor = (argv as IArgvFind).ancestor;
            id = (argv as IArgvFind).id;
        }

        const [entities, requestResponse] = await this.findMany({namespace, ancestor, ids: [id]});
        return [entities.length ? entities[0] : undefined, requestResponse];
    }

    public static async findMany<T extends typeof BaseEntity>(this: T, argv: IArgvId[] | IArgvFindMany): Promise<[Array<InstanceType<T>>, IRequestResponse]> {
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

        if (ids.length) {
            const entityMeta = datastoreOrm.getEntityMeta(this);
            const datastore = datastoreOrm.getConnection(entityMeta.connection);
            const keys = datastoreOrm.mapIdsToKeys(this, ids, namespace, ancestorKey);

            // friendly error
            const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
            try {
                const [results] = await datastore.get(keys);

                // convert into entities
                let entities: any[] = [];
                if (Array.isArray(results)) {
                    entities = results.map(x => this.newFromEntityData(x));
                }

                return [entities, performanceHelper.readResult()];

            } catch (err) {
                const error = new DatastoreOrmDatastoreError(`(${this.name}) Find Error. ids (${ids.join(", ")}). Error: ${err.message}.`,
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

    public static async allocateIds<T extends typeof BaseEntity>(this: T, argv: number | IArgvAllocateIds): Promise<[number[], IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // parse argv
        let total = argv as number;
        let namespace = "";
        if (typeof argv === "object") {
            total = argv.total;
            namespace = argv.namespace;
        }

        const entityMeta = datastoreOrm.getEntityMeta(this);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const key = datastoreOrm.createKey({namespace, path: [this]});

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            const [keys] = await datastore.allocateIds(key, {allocations: total});
            const ids = keys.map(x => Number(x.id));
            return [ids, performanceHelper.readResult()];

        } catch (err) {
            const error = new DatastoreOrmDatastoreError(`(${this.name}) Allocate Ids Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    public static async truncate<T extends typeof BaseEntity>(this: T, options: IArgvNamespace = {}): Promise<[number, IRequestResponse]> {
        const maxBatch = 500;
        const query = this.query().selectKey().limit(maxBatch);
        const namespace = options.namespace || "";

        // set namespace if we have
        if (namespace) {
            query.setNamespace(namespace);
        }

        // we do batch delete to optimize performance
        const batcher = new Batcher({maxBatch});
        const requestResponse: IRequestResponse = {executionTime: 0};
        let total = 0;

        while (query.hasNextPage()) {
            const [entities, requestResponse1] = await query.run();
            const [_, batchResponse] = await batcher.delete(entities);
            total += entities.length;
            requestResponse.executionTime += requestResponse1.executionTime;
            requestResponse.executionTime += batchResponse.executionTime;
        }

        return [total, requestResponse];
    }

    /** @internal */
    public static newFromEntityData<T extends typeof BaseEntity>(this: T, data: { [key: string]: any }, isReadOnly: boolean = false):
        InstanceType<T> {
        const entity = this.create(data as any);
        const key = (data as any)[Datastore.Datastore.KEY] as IKey;
        entity._set("id", key.name || Number(key.id));
        if (key.parent) {
            entity._ancestorKey = key.parent;
        }
        entity.setNamespace(key.namespace || "");
        entity._isNew = false;
        entity._rawData = data;
        entity._isReadOnly = isReadOnly;
        return entity;
    }

    // endregion

    // public id: string | number = 0;
    private _isNew = true;
    private _isReadOnly = false;
    private _ancestorKey: IKey | undefined;
    private _id: number | string = "";
    private _data: { [key: string]: any } = {};
    private _rawData: { [key: string]: any } = {};
    private _namespace: string;

    constructor() {
        // assign namespace
        const entityMeta = datastoreOrm.getEntityMeta(this.constructor);
        this._namespace = entityMeta.namespace;
    }

    // region getter

    public get isNew(): boolean {
        return this._isNew;
    }

    /** @internal */
    public set isNew(value) {
        this._isNew = value;
    }

    public get isReadOnly(): boolean {
        return this._isReadOnly;
    }

    // endregion

    // region public methods

    /** @internal */
    public getSaveData(): IEntityData {
        const excludeFromIndexes = datastoreOrm.getExcludeFromIndexes(this.constructor);
        return {
            key: this.getSaveDataKey(),
            excludeFromIndexes,
            data: this._data,
        };
    }

    public getMergeData(data: object): IEntityData {
        const excludeFromIndexes = datastoreOrm.getExcludeFromIndexes(this.constructor);
        return {
            key: this.getSaveDataKey(),
            excludeFromIndexes,
            data,
        };
    }

    // this will validate the ancestor
    /** @internal */
    public getSaveDataKey(): IKey {
        this._validateAncestorKey(this._ancestorKey);

        // get the key
        let key: IKey;
        if (!this._id) {
            // if this is not new or no auto generate id
            const entityColumn = datastoreOrm.getEntityColumn(this.constructor, "id");
            if (!this.isNew || !entityColumn.generateId) {
                throw new DatastoreOrmOperationError(`(${this.constructor.name}) This entity has no valid id nor auto generate id for saving. id must be non zero and non empty.`);
            }
            key = datastoreOrm.createKey({namespace: this._namespace, path: [this.constructor]});
        } else {
            key = datastoreOrm.createKey({namespace: this._namespace, path: [this.constructor, this._id]});
        }

        // add parent
        if (this._ancestorKey) {
            key.parent = this._ancestorKey;
        }

        return key;
    }

    // this just get the current key without any validate on ancestor
    // useful for delete
    public getKey(): IKey {
        if (!this._id) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) This entity has no valid id for getKey() or serve as ancestor. id must be non zero and non empty.`);
        }

        const key = datastoreOrm.createKey({namespace: this._namespace, path: [this.constructor, this._id]});
        if (this._ancestorKey) {
            key.parent = this._ancestorKey;
        }

        return key;
    }

    public setValues<T extends BaseEntity>(this: T, values: Partial<IArgvValues<T>>) {
        const columns = datastoreOrm.getColumns(this.constructor);
        for (const column of columns) {
            if (column in values) {
                this._set(column, (values as any)[column]);
            }
        }

        return this;
    }

    public getValues<T extends BaseEntity>(this: T) {
        const values: any = {};
        const columns = datastoreOrm.getColumns(this.constructor);
        for (const column of columns) {
            values[column] = this._get(column);
        }

        return values as IArgvValues<T>;
    }

    public set<T extends BaseEntity, K extends IArgvColumn<T>>(this: T, column: K, value: IArgvValue<T, K>) {
        return this._set(column as string, value);
    }

    public get<T extends BaseEntity, K extends IArgvColumn<T>>(this: T, column: K): IArgvValue<T, K> {
        return this._get(column as string);
    }

    // we only validate ancestor during save
    public setAncestor<R extends BaseEntity>(ancestor: R) {
        const ancestorKey = ancestor.getKey();

        // validate the ancestor
        this._validateAncestorKey(ancestorKey);

        if (this._ancestorKey) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) You cannot update ancestor once it is set.`);
        }

        this._ancestorKey = ancestorKey;
        return this;
    }

    public setNamespace(value: string) {
        if (!this._isNew) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) You cannot update namespace of an existing entity. id (${(this as any).id}).`);
        }

        this._namespace = value;
        return this;
    }

    public getNamespace() {
        return this._namespace;
    }

    public async save(): Promise<[this, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        if (this.isReadOnly) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) Entity is read only. id (${(this as any).id}).`);
        }

        // save
        const entityMeta = datastoreOrm.getEntityMeta(this.constructor);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const saveData = this.getSaveData();

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            // update isNew = false no matter what
            if (this.isNew) {
                this.isNew = false;
                const [insertResult] = await datastore.insert(saveData);

                // if we do not have id, this is an auto generated id, we will try to get it
                if (!this._id && saveData.key.id) {
                    this._set("id", Number(saveData.key.id));
                }

                // emit event
                eventEmitters.emit("create", this);

            } else {
                this.isNew = false;
                const [updateResult] = await datastore.update(saveData);

                // emit event
                eventEmitters.emit("update", this);

            }
        } catch (err) {
            const error = new DatastoreOrmDatastoreError(`(${this.constructor.name}) Entity cannot be saved. id (${(this as any).id}). Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }

        return [this, performanceHelper.readResult()];
    }

    public async merge<T extends BaseEntity>(this: T, values: Partial<IArgvValues<T>>): Promise<[T, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        if (this.isReadOnly) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) Entity is read only. id (${(this as any).id}).`);
        }

        if (this.isNew) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) You cannot call merge() on a new Entity.`);
        }

        // save
        const entityMeta = datastoreOrm.getEntityMeta(this.constructor);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const mergeData = this.getMergeData(values);

        // update the local data first
        for (const [key, value] of Object.entries(values)) {
            this._set(key, value);
        }

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            // update isNew = false no matter what
            const [updateResult] = await datastore.merge(mergeData);

            // emit event
            eventEmitters.emit("update", this);
    } catch (err) {
            const error = new DatastoreOrmDatastoreError(`(${this.constructor.name}) Entity cannot be saved. id (${(this as any).id}). Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }

        return [this, performanceHelper.readResult()];
    }

    // deleting an not existing key wont' throw error
    public async delete(): Promise<[this, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const entityMeta = datastoreOrm.getEntityMeta(this.constructor);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const key = this.getKey();

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            const [result] = await datastore.delete(key);

            // emit event
            eventEmitters.emit("delete", this);

        } catch (err) {
            const error = new DatastoreOrmDatastoreError(`(${this.constructor.name}) Entity cannot be deleted. id (${(this as any).id}). Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }

        return [this, performanceHelper.readResult()];
    }

    public async getAncestor<T extends typeof BaseEntity>(entityType: T): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        const ancestorEntityMeta = datastoreOrm.getEntityMeta(entityType);
        let key = this.getKey();
        while (key.parent) {
            key = key.parent;
            if (key && key.kind === ancestorEntityMeta.kind) {
                const ancestorEntityType = datastoreOrm.getEntityByKind(ancestorEntityMeta.connection, ancestorEntityMeta.kind);
                return await (ancestorEntityType as T)
                    .query()
                    .setNamespace(this.getNamespace())
                    .filterKey(key)
                    .runOnce();
            }
        }

        return [undefined, {executionTime: 0}];
    }

    public getAncestorId<T extends any>(entityType: T): IPropType<T, "id"> | undefined {
        const entityMeta = datastoreOrm.getEntityMeta(entityType as any);

        let key = this.getKey();
        while (key.parent) {
            key = key.parent;
            if (key && key.kind === entityMeta.kind) {
                return key.name ? key.name : Number(key.id);
            }
        }
    }

    public toJSON() {
        return this.getValues();
    }

    // endregion

    // region private methods

    /** @internal */
    private _validateAncestorKey(ancestorKey: IKey | undefined) {
        const target = this.constructor;
        const entityMeta = datastoreOrm.getEntityMeta(target);

        // if we have a key
        if (ancestorKey) {
            // check namespace
            const ancestorNamespace = ancestorKey.namespace || "";
            if (ancestorNamespace !== this._namespace) {
                throw new DatastoreOrmOperationError(`(${this.constructor.name}) The ancestor namespace (${ancestorNamespace}) is different with the entity namespace (${this._namespace}).`);
            }

            // if we don't need any ancestors
            if (!entityMeta.ancestor) {
                let errorMessage = `(${(target as any).name}) Entity does not require any ancestor, `;
                errorMessage += `but the current ancestor kind is (${ancestorKey.kind}).`;
                throw new DatastoreOrmOperationError(errorMessage);
            }

            let isValid = false;
            const ancestorEntityMeta = datastoreOrm.getEntityMeta(entityMeta.ancestor);
            if (ancestorEntityMeta.kind === ancestorKey.kind) {
                isValid = true;
            }

            // check if ancestor is valid in schema
            if (!isValid) {
                const name = (entityMeta.ancestor as any).name;
                let errorMessage = `(${(target as any).name}) Entity requires ancestors of (${name}), `;
                errorMessage += `but the current ancestor kind is (${ancestorKey.kind}).`;
                throw new DatastoreOrmOperationError(errorMessage);
            }
        } else {
            // if we need ancestors while not exist
            if (entityMeta.ancestor) {
                const name = (entityMeta.ancestor as any).name;
                throw new DatastoreOrmOperationError(`(${(target as any).name}) Entity requires ancestors of (${name}).`);
            }
        }
    }

    private _castValue(type: any, newValue: any, oldValue: any): any {
        if (type === Date) {
            return new Date(newValue);

        } else if (typeof type === "function") {
            return type(newValue, oldValue);

        }

        return newValue;
    }

    // endregion

    // region private methods: value get / set

    private _get(column: string): any {
        if (column === "id") {
            return this._id;
        } else {
            return this._data[column];
        }
    }

    private _set(column: string, value: any) {
        const entityColumn = datastoreOrm.getEntityColumn(this.constructor, column);

        // we only have cast for non id since modifying id has some potential impact
        if (column !== "id" && entityColumn.cast) {
            value = this._castValue( entityColumn.cast, value, this._data[column]);
        }

        if (column === "id") {
            // if we already have id and this is now a new entity, block for updating
            if (this._id && this._id !== value && !this._isNew) {
                throw new DatastoreOrmOperationError(`(${this.constructor.name}) You cannot update id of an existing entity. id (${(this as any).id}).`);
            }

            this._id = value;

        } else {
            this._data[column] = value;
        }
    }

    // endregion
}
