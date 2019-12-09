import * as Datastore from "@google-cloud/datastore";
import {Batcher} from "./Batcher";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmEntityError} from "./errors/DatastoreOrmEntityError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {Query} from "./Query";
import {
    IArgvColumn,
    IArgvId,
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

    public static createKey(id: string | number) {
        return datastoreOrm.createKey(this, id);
    }

    public static query<T extends typeof BaseEntity>(this: T): Query<T> {
        return new Query(this);
    }

    public static async find<T extends typeof BaseEntity>(this: T, id: IArgvId): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        const [entities, requestResponse] = await this.findMany([id]);
        return [entities.length ? entities[0] : undefined, requestResponse];
    }

    public static async findMany<T extends typeof BaseEntity>(this: T, ids: IArgvId[]): Promise<[Array<InstanceType<T>>, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // get the keys
        const keys = ids.map(x => datastoreOrm.createKey(this, x));
        const datastore = datastoreOrm.getDatastore();
        const [results] = await datastore.get(keys);

        // convert into entities
        let entities: any[] = [];
        if (Array.isArray(results)) {
            entities = results.map(x => this.newFromEntityData(x));
        }

        return [entities, performanceHelper.readResult()];
    }

    public static async allocateIds<T extends typeof BaseEntity>(this: T, total: number = 1): Promise<[number[], IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const datastore = datastoreOrm.getDatastore();
        const key = datastoreOrm.createKey(this);
        const [keys] =  await datastore.allocateIds(key, {allocations: total});
        const ids = keys.map(x => Number(x.id));

        return [ids, performanceHelper.readResult()];
    }

    public static async truncate<T extends typeof BaseEntity>(this: T): Promise<[number, IRequestResponse]> {
        const batch = 100;
        const query = this.query().selectKey().limit(batch);
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
            entity.setAncestorKey(key.parent);
        }
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

    constructor() {
        //
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
        datastoreOrm.isValidAncestorKey(this.constructor, this._ancestorKey);

        let key: IKey;

        if (!this._id) {
            // if this is not new or no auto generate id
            const idSchema = datastoreOrm.getEntityColumn(this.constructor, "id");
            if (!this.isNew || !idSchema.generateId) {
                throw new DatastoreOrmEntityError(`(${this.constructor.name}) Please provide an id for this entity. id must be non zero and non empty. Example: public id: number = 0;`);
            }

            key = datastoreOrm.createKey(this.constructor);
        } else {
            key = datastoreOrm.createKey(this.constructor, this._id);
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
            throw new DatastoreOrmEntityError(`(${this.constructor.name}) Please provide an id for this entity. id must be non zero and non empty.`);
        }

        const key = datastoreOrm.createKey(this.constructor, this._id);
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

    // we only validate ancestor during save, in case the schema is changed
    public setAncestor<R extends BaseEntity>(ancestor: R) {
        this._ancestorKey = ancestor.getKey();
        return this;
    }

    public setAncestorKey(key: IKey) {
        this._ancestorKey = key;
        return this;
    }

    public async save(): Promise<[this, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        if (this.isReadOnly) {
            throw new DatastoreOrmEntityError(`(${this.constructor.name}) This entity is read only. id (${(this as any).id}).`);
        }

        // save
        try {
            const datastore = datastoreOrm.getDatastore();
            const saveData = this.getSaveData();

            // update isNew = false no matter what
            if (this.isNew) {
                this.isNew = false;
                const [insertResult] = await datastore.insert(saveData);
                const newKeys = datastoreOrm.extractMutationKeys(insertResult as ISaveResult);
                if (newKeys.length) {
                    const newKey = newKeys[0];
                    if (!this._id) {
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
        // TODO: validate by schema
        const schema = datastoreOrm.getEntityColumn(this.constructor, column);
        if (column === "id") {
            this._id = value;

        } else {
            this._data[column] = value;
        }
    }

    // endregion
}
