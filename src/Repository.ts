import * as Datastore from "@google-cloud/datastore";
import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import {BaseEntity} from "./BaseEntity";
import {MAX_ENTITIES} from "./constants";
import {TsDatastoreOrmError} from "./errors/TsDatastoreOrmError";
import {IncrementHelper} from "./helpers/IncrementHelper";
import {IndexResaveHelper} from "./helpers/IndexResaveHelper";
import {Query} from "./queries/Query";
import {SelectKeyQuery} from "./queries/SelectKeyQuery";
import {Session} from "./transactions/Session";
import {tsDatastoreOrm} from "./tsDatastoreOrm";
import {
    ICreateValues,
    IEntityKeyType, IIncrementHelperOptions,
    IRepositoryParams,
    IStrongTypeQueryOptions,
    IWeakTypeQueryOptions,
} from "./types";
import {updateStack} from "./utils";

export class Repository<T extends typeof BaseEntity> {
    public readonly datastore: Datastore.Datastore;
    public readonly classObject: T;
    public readonly namespace: string | undefined;
    public readonly kind: string;

    constructor(options: IRepositoryParams<T>) {
        this.datastore = options.datastore;
        this.classObject = options.classObject;
        this.namespace = options.namespace;
        this.kind = options.kind;
    }

    public create(values: ICreateValues<InstanceType<T>> = {}): InstanceType<T> {
        const entity = new this.classObject() as InstanceType<T>;
        (entity as any)._kind = this.kind;
        (entity as any)._namespace = this.namespace;

        Object.assign(entity, values);
        return entity;
    }

    public async findOne(id: IEntityKeyType<T>) {
        const key = tsDatastoreOrm.normalizeAndValidateKey(id, this.namespace, this.kind);

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [response] = await this.datastore.get(key);
            if (response) {
                return await tsDatastoreOrm.loadEntity(this.classObject, response);
            }
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async findOneWithSession(id: IEntityKeyType<T>, session: Session) {
        const key = tsDatastoreOrm.normalizeAndValidateKey(id, this.namespace, this.kind);
        return await session.findOne(this.classObject, key);
    }

    public async findMany(ids: Array<IEntityKeyType<T>>): Promise<Array<InstanceType<T>>> {
        const keys = tsDatastoreOrm.normalizeAndValidateKeys(ids, this.namespace, this.kind);

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const entities: Array<InstanceType<T>> = [];
            const [response] = await this.datastore.get(keys);
            for (const data of response) {
                const entity = await tsDatastoreOrm.loadEntity(this.classObject, data);
                entities.push(entity);
            }

            return entities;
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async findManyWithSessions(ids: Array<IEntityKeyType<T>>, session: Session): Promise<Array<InstanceType<T>>> {
        const keys = tsDatastoreOrm.normalizeAndValidateKeys(ids, this.namespace, this.kind);
        return await session.findMany(this.classObject, keys);
    }

    public query(options?: IStrongTypeQueryOptions): Query<T, InstanceType<T>>;
    public query(options?: IWeakTypeQueryOptions): Query<T, any>;
    public query(options?: any) {
        const query = this.datastore.createQuery();
        query.namespace = this.namespace;
        query.kinds = [this.kind];

        return new Query({datastore: this.datastore,
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
            query,
        });
    }

    public queryWithSession(session: Session, options?: IStrongTypeQueryOptions): Query<T, InstanceType<T>>;
    public queryWithSession(session: Session, options?: IWeakTypeQueryOptions): Query<T, any>;
    public queryWithSession(session: Session, options?: any) {
        const query = session.transaction.createQuery();
        query.namespace = this.namespace;
        query.kinds = [this.kind];

        return new Query({datastore: this.datastore,
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
            query,
        });
    }

    public selectKeyQuery(options?: IStrongTypeQueryOptions): SelectKeyQuery<InstanceType<T>>;
    public selectKeyQuery(options?: IWeakTypeQueryOptions): SelectKeyQuery<any>;
    public selectKeyQuery(options?: any) {
        const query = this.datastore.createQuery();
        query.namespace = this.namespace;
        query.kinds = [this.kind];

        return new SelectKeyQuery({datastore: this.datastore,
            namespace: this.namespace,
            kind: this.kind,
            query,
        });
    }

    public selectKeyQueryWithSession(session: Session, options?: IStrongTypeQueryOptions): SelectKeyQuery<InstanceType<T>>;
    public selectKeyQueryWithSession(session: Session, options?: IWeakTypeQueryOptions): SelectKeyQuery<any>;
    public selectKeyQueryWithSession(session: Session, options?: any) {
        const query = session.transaction.createQuery();
        query.namespace = this.namespace;
        query.kinds = [this.kind];

        return new SelectKeyQuery({datastore: this.datastore,
            namespace: this.namespace,
            kind: this.kind,
            query,
        });
    }

    public async allocateIds(total: number): Promise<number[]> {
        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const key = this.datastore.key({namespace: this.namespace, path: [this.kind]});
            const [ids] = await this.datastore.allocateIds(key, total);
            return ids.map(x => Number(x.id));
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public async allocateIdsWithSession(total: number, session: Session): Promise<number[]> {
        const key = this.datastore.key({namespace: this.namespace, path: [this.kind]});
        return await session.allocateIds(key, total);
    }

    public async insert<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P): Promise<P> {
        return await this._internalInsert(entities, false);
    }

    public insertWithSession<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P, session: Session): void {
        tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind, false);
        session.insert(entities);
    }

    public async upsert<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P): Promise<P> {
        return await this._internalInsert(entities, true);
    }

    public upsertWithSession<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P, session: Session): void {
        tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind, false);
        session.upsert(entities);
    }

    public async update<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P): Promise<P> {
        tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind);

        // validate then run hook
        tsDatastoreOrm.runHookOfBeforeUpdate(entities);

        const updateDataList: any[] = [];
        for (const entity of Array.isArray(entities) ? entities : [entities]) {
            const {updateData} = tsDatastoreOrm.getUpdateData(entity);
            updateDataList.push(updateData);
        }

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [updateResult] = await this.datastore.update(updateDataList);
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

        return entities;
    }

    public updateWithSession<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P, session: Session): void {
        tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind);
        session.update(entities);
    }

    // Remarks: merge is not support to avoid confusion
    // public async merge<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P): Promise<P> {
    //     tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind);
    //
    //     const updateDataList: any[] = [];
    //     for (const entity of Array.isArray(entities) ? entities : [entities]) {
    //         const {updateData} = tsDatastoreOrm.getUpdateData(entity);
    //         updateDataList.push(updateData);
    //     }
    //
    //     const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
    //     try {
    //         const [updateResult] = await this.datastore.merge(updateDataList);
    //         return entities;
    //     } catch (err) {
    //         throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
    //     }
    // }

    public async delete<P extends IEntityKeyType<T> | Array<IEntityKeyType<T>>>(entities: P): Promise<P> {
        const keys: DatastoreEntity.entity.Key[] = [];

        const newEntities: Array<IEntityKeyType<T>> = Array.isArray(entities) ? entities : [entities];
        for (const entity of newEntities) {
            const key = tsDatastoreOrm.normalizeAndValidateKey(entity, this.namespace, this.kind);
            keys.push(key);
        }

        // validate then run hook
        for (const entity of newEntities) {
            if (entity instanceof BaseEntity) {
                tsDatastoreOrm.runHookOfBeforeDelete(entity);
            }
        }

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [deleteResult] = await this.datastore.delete(keys);
            return entities;
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public deleteWithSession<P extends IEntityKeyType<T> | Array<IEntityKeyType<T>>>(entities: P, session: Session): void {
        // validate the entities first
        const newEntities: Array<IEntityKeyType<T>> = Array.isArray(entities) ? entities : [entities];
        for (const entity of newEntities) {
            tsDatastoreOrm.normalizeAndValidateKey(entity, this.namespace, this.kind);
        }

        session.delete(entities);
    }

    public async truncate() {
        const iterator = this.selectKeyQuery()
            .limit(MAX_ENTITIES)
            .getAsyncIterator();

        let total = 0;
        for await (const keys of iterator) {
            await this.delete(keys);
            total += keys.length;
        }

        return total;
    }

    public async getUrl() {
        const namespace = this.namespace ? this.namespace : "__$DEFAULT$__/query/kind";
        const projectId = await this.datastore.auth.getProjectId();
        return `https://console.cloud.google.com/datastore/entities;kind=${this.kind};ns=${namespace}/query/kind?project=${projectId}`;
    }

    // region helper

    public getIndexResaveHelper() {
        return new IndexResaveHelper({
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
            datastore: this.datastore,
        });
    }

    public getIncrementHelper(options: IIncrementHelperOptions = {}) {
        return new IncrementHelper({
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
            datastore: this.datastore,
            maxRetry: options.maxRetry || 0,
            retryDelay: options.retryDelay || 0,
        });
    }

    // endregion

    // region private methods

    private async _internalInsert<P extends InstanceType<T> | Array<InstanceType<T>>>(entities: P, isUpsert: boolean): Promise<P> {
        tsDatastoreOrm.validateEntity(entities, this.namespace, this.kind, false);

        const insertDataList: any[] = [];
        const generateEntities: Map<BaseEntity, DatastoreEntity.entity.Key> = new Map();

        for (const entity of Array.isArray(entities) ? entities : [entities]) {
            const {isGenerateId, insertData} = tsDatastoreOrm.getInsertData(entity);

            // save the auto generate entities
            if (isGenerateId) {
                if (generateEntities.has(entity)) {
                    throw new TsDatastoreOrmError(`You cannot insert the same entity.`);
                }

                generateEntities.set(entity, insertData.key);
            }

            insertDataList.push(insertData);
        }

        if (isUpsert) {
            tsDatastoreOrm.runHookOfBeforeUpsert(entities);
        } else {
            tsDatastoreOrm.runHookOfBeforeInsert(entities);
        }

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            if (isUpsert) {
                const [response] = await this.datastore.upsert(insertDataList);
            } else {
                const [response] = await this.datastore.insert(insertDataList);
            }

            // update back the auto generate id
            for (const [entity, key] of generateEntities.entries()) {
                entity._id = Number(key.id);
            }

            return entities;

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    // endregion
}
