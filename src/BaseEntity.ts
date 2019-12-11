import * as Datastore from "@google-cloud/datastore";
import {Batcher} from "./Batcher";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {Query} from "./Query";
import {
    IArgvAllocateIds,
    IArgvColumn, IArgvFind, IArgvFindMany,
    IArgvId, IArgvTruncate,
    IArgvValue,
    IArgvValues,
    IEntityData,
    IKey,
    IRequestResponse,
    ISaveResult,
} from "./types";

export class BaseEntity {

    // region static methods

    public static create<T extends typeof BaseEntity>(this: T, values: Partial<IArgvValues<InstanceType<T>>> = {}): InstanceType<T> {
        return (new this() as InstanceType<T>).setValues(values);
    }

    public static query<T extends typeof BaseEntity>(this: T): Query<T> {
        return new Query(this);
    }

    public static async find<T extends typeof BaseEntity>(this: T, argv: IArgvId | IArgvFind): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        // parse argv
        let id: IArgvId = argv as IArgvId;
        let namespace: string | undefined;
        let ancestor: BaseEntity | undefined;
        if (typeof argv === "object") {
            namespace = argv.namespace;
            ancestor = argv.ancestor;
            id = argv.id;
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

        // get the keys
        const keys = ids.map(x => datastoreOrm.createKey({namespace, ancestorKey, path: [this, x]}));
        const datastore = datastoreOrm.getDatastore();
        const [results] = await datastore.get(keys);

        // convert into entities
        let entities: any[] = [];
        if (Array.isArray(results)) {
            entities = results.map(x => this.newFromEntityData(x));
        }

        return [entities, performanceHelper.readResult()];
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

        const datastore = datastoreOrm.getDatastore();
        const key = datastoreOrm.createKey({namespace, path: [this]});
        const [keys] =  await datastore.allocateIds(key, {allocations: total});
        const ids = keys.map(x => Number(x.id));

        return [ids, performanceHelper.readResult()];
    }

    public static async truncate<T extends typeof BaseEntity>(this: T, argv?: IArgvTruncate): Promise<[number, IRequestResponse]> {
        const batch = 100;
        const query = this.query().selectKey().limit(batch);
        const namespace = argv ? argv.namespace : "";

        // set namespace if we have
        if (namespace) {
            query.setNamespace(namespace);
        }

        // we do batch delete to optimize performance
        const batcher = new Batcher();
        const requestResponse: IRequestResponse = {executionTime: 0};
        let total = 0;

        while (query.hasNextPage()) {
            const [entities, requestResponse1] = await query.run();
            const [batchResponse] = await batcher.deleteMany(entities);
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

    // this will validate the ancestor
    /** @internal */
    public getSaveDataKey(): IKey {
        this._validateAncestorKey();

        // get the key
        let key: IKey;
        if (!this._id) {
            // if this is not new or no auto generate id
            const entityColumn = datastoreOrm.getEntityColumn(this.constructor, "id");
            if (!this.isNew || !entityColumn.generateId) {
                throw new DatastoreOrmOperationError(`(${this.constructor.name}) Please provide an id for this entity. id must be non zero and non empty.`);
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
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) Please provide an id for this entity. id must be non zero and non empty.`);
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

    /** @deprecated */
    public set<T extends BaseEntity, K extends IArgvColumn<T>>(this: T, column: K, value: IArgvValue<T, K>) {
        return this._set(column as string, value);
    }

    /** @deprecated */
    public get<T extends BaseEntity, K extends IArgvColumn<T>>(this: T, column: K): IArgvValue<T, K> {
        return this._get(column as string);
    }

    // we only validate ancestor during save
    public setAncestor<R extends BaseEntity>(ancestor: R) {
        const ancestorKey = ancestor.getKey();

        // check namespace
        if (ancestorKey.namespace !== this._namespace) {
            throw new DatastoreOrmOperationError(`(${this.constructor.name}) The ancestor namespace (${ancestorKey.namespace}) is different with the entity namespace (${this._namespace}). `);
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
        try {
            const datastore = datastoreOrm.getDatastore();
            const saveData = this.getSaveData();

            // update isNew = false no matter what
            if (this.isNew) {
                this.isNew = false;

                const [insertResult] = await datastore.insert(saveData);

                // if we do not have id, this is an auto generated id, we will try to get it
                if (!this._id) {
                    const newKeys = datastoreOrm.extractMutationKeys(insertResult as ISaveResult);
                    if (newKeys.length) {
                        const newKey = newKeys[0];
                        this._set("id", Number(newKey.id));
                    }
                }

            } else {
                const [updateResult] = await datastore.update(saveData);

            }
        } catch (err) {
            throw err;
        }

        return [this, performanceHelper.readResult()];
    }

    public async delete(): Promise<[this, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const datastore = datastoreOrm.getDatastore();
        const key = this.getKey();
        try {
            await datastore.delete(key);
        } catch (err) {
            throw err;
        }

        return [this, performanceHelper.readResult()];
    }

    public toJSON() {
        return this.getValues();
    }

    // endregion

    // region private methods

    /** @internal */
    private _validateAncestorKey() {
        const target = this.constructor;
        const entityMeta = datastoreOrm.getEntityMeta(target);
        // if we need ancestor
        if (entityMeta.ancestors.length) {
            if (!this._ancestorKey) {
                const names = entityMeta.ancestors.map(x => (x as any).name).join(", ");
                throw new DatastoreOrmOperationError(`(${(target as any).name}) Entity requires ancestors of (${names}).`);

            } else {
                let isValid = false;
                for (const ancestor of entityMeta.ancestors) {
                    const ancestorEntityMeta = datastoreOrm.getEntityMeta(ancestor);
                    if (ancestorEntityMeta.kind === this._ancestorKey.kind) {
                        isValid = true;
                        break;
                    }
                }

                if (!isValid) {
                    const names = entityMeta.ancestors.map(x => (x as any).name).join(", ");
                    let errorMessage = `(${(target as any).name}) Entity requires ancestors of (${names}), `;
                    errorMessage += `but the current ancestor kind is (${this._ancestorKey.kind}).`;
                    throw new DatastoreOrmOperationError(errorMessage);
                }
            }
        } else {
            // if we don't have ancestor, but an ancestor key is provided
            if (this._ancestorKey) {
                let errorMessage = `(${(target as any).name}) Entity does not require any ancestor, `;
                errorMessage += `but the current ancestor kind is (${this._ancestorKey.kind}).`;
                throw new DatastoreOrmOperationError(errorMessage);
            }
        }
    }

    private _castValue(value: any, type: any): any {
        if (type === Date) {
            return new Date(value);

        } else if (typeof type === "function") {
            return type(value);

        }

        return value;
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
        if (entityColumn.cast) {
            value = this._castValue(value, entityColumn.cast);
        }

        if (column === "id") {
            // if we already have id and this is now a new entity, block for updating
            if (this._id && !this._isNew) {
                throw new DatastoreOrmOperationError(`(${this.constructor.name}) You cannot update id of an existing entity. id (${(this as any).id}).`);
            }

            this._id = value;

        } else {
            this._data[column] = value;
        }
    }

    // endregion
}
