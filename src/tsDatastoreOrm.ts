import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import {BaseEntity} from "./BaseEntity";
import {decoratorMeta} from "./decoratorMeta";
import {TsDatastoreOrmError} from "./errors/TsDatastoreOrmError";
import {IEntityKeyType, IGetInsertData, IGetUpdateData} from "./types";

class TsDatastoreOrm {
    public useFriendlyErrorStack = true;

    /** @internal */
    public getFriendlyErrorStack(): string | undefined {
        if (this.useFriendlyErrorStack) {
            return new Error().stack;
        }
    }

    /** @internal */
    public getInsertData<T extends BaseEntity>(entity: T): IGetInsertData {
        const key = entity.getKey();
        const data = this.getData(entity);

        // make the key able to have auto generate
        let isGenerateId = decoratorMeta.isGenerateId(entity.constructor);

        // if we not generate id, we need to make sure key is not empty
        if (this.isEmptyKey(key)) {
            if (isGenerateId) {
                // we set this to undefined since it may be 0 or ""
                key.id = undefined;
            } else {
                throw new TsDatastoreOrmError(`_id must not be 0, empty string or undefined.`);
            }
        } else {
            // set the flag to false if key is not empty
            isGenerateId = false;
        }

        const excludeFromIndexes = decoratorMeta.getExcludeFromIndexes(entity.constructor);
        const insertData = {
            key,
            excludeFromIndexes,
            data,
        };

        return {insertData, isGenerateId};
    }

    /** @internal */
    public getUpdateData<T extends BaseEntity>(entity: T): IGetUpdateData {
        const key = entity.getKey();
        const data = this.getData(entity);

        const excludeFromIndexes = decoratorMeta.getExcludeFromIndexes(entity.constructor);
        const updateData = {
            key,
            excludeFromIndexes,
            data,
        };

        return {updateData};
    }

    /** @internal */
    public getData<T extends BaseEntity>(entity: T) {
        const fieldNames = decoratorMeta.getEntityFieldNames(entity.constructor);
        const data: any = {};

        for (const fieldName of fieldNames) {
            if (fieldName !== "_id") {
                data[fieldName] = (entity as any)[fieldName];
            }
        }

        return data;
    }

    /** @internal */
    public async loadEntity<T extends typeof BaseEntity>(classObject: T, data: any): Promise<InstanceType<T>> {
        const key = data[DatastoreEntity.entity.KEY_SYMBOL] as DatastoreEntity.entity.Key;
        const entityFields = decoratorMeta.getEntityFieldMetaList(classObject);
        const entity = new classObject() as InstanceType<T>;

        entity._namespace = key.namespace;
        entity._kind = key.kind;

        for (const [fieldName, options] of entityFields.entries()) {
            if (fieldName in data) {
                (entity as any)[fieldName] = data[fieldName];
            }
        }

        // fill up the _id
        if (key.id) {
            entity._id = Number(key.id);
        } else if (key.name) {
            entity._id = key.name;
        }

        if (key.parent) {
            entity._ancestorKey = key.parent;
        }

        await this.runHookOfAfterLoad(entity);

        return entity;
    }

    /** @internal */
    public normalizeAndValidateKeys(values: Array<IEntityKeyType<any>>, namespace: string | undefined, kind: string) {
        const keys = values.map(x => this.normalizeAsKey(x, namespace, kind));
        this.validateKey(keys, namespace, kind);
        return keys;
    }

    /** @internal */
    public normalizeAndValidateKey(value: IEntityKeyType<any>, namespace: string | undefined, kind: string) {
        const key = this.normalizeAsKey(value, namespace, kind);
        this.validateKey(key, namespace, kind);
        return key;
    }

    /** @internal */
    public normalizeAsKey(value: IEntityKeyType<any>, namespace: string | undefined, kind: string) {
        if (value instanceof BaseEntity) {
            return value.getKey();

        } else if (value instanceof DatastoreEntity.entity.Key) {
            return value;

        } else {
            return new DatastoreEntity.entity.Key({namespace, path: [kind, value as any]});

        }
    }

    /** @internal */
    public isEmptyKey(key: DatastoreEntity.entity.Key) {
        if (key.id === "0" || key.name === "" || (key.id === undefined && key.name === undefined)) {
            return true;
        }

        return false;
    }

    /** @internal */
    public validateKey(keys: DatastoreEntity.entity.Key | DatastoreEntity.entity.Key[],
                       namespace: string | undefined, kind: string, checkEmptyKey = true) {
        for (const key of (Array.isArray(keys) ? keys : [keys])) {
            if (key.namespace !== namespace) {
                throw new TsDatastoreOrmError(`Namespace not match. Entity namespace is "${key.namespace}". While the expected namespace is "${namespace}".`);
            }

            if (key.kind !== kind) {
                throw new TsDatastoreOrmError(`Kind not match. Entity kind is "${key.kind}". While the expected kind is "${kind}".`);
            }

            if (checkEmptyKey && this.isEmptyKey(key)) {
                throw new TsDatastoreOrmError(`_id must not be 0, empty string or undefined.`);

            }
        }
    }

    /** @internal */
    public validateEntity(entities: BaseEntity | BaseEntity[],
                          namespace: string | undefined, kind: string, checkEmptyKey = true) {
        for (const entity of (Array.isArray(entities) ? entities : [entities])) {
            this.validateKey(entity.getKey(), namespace, kind, checkEmptyKey);
        }
    }

    /** @internal */
    public async runHookOfBeforeInsert(entities: BaseEntity | BaseEntity[]) {
        for (const entity of (Array.isArray(entities) ? entities : [entities])) {
            const hook = decoratorMeta.getHookOfBeforeInsert(entity.constructor);
            if (hook) {
                await (entity as any)[hook]("beforeInsert");
            }
        }
    }

    /** @internal */
    public async runHookOfBeforeUpsert(entities: BaseEntity | BaseEntity[]) {
        for (const entity of (Array.isArray(entities) ? entities : [entities])) {
            const hook = decoratorMeta.getHookOfBeforeUpsert(entity.constructor);
            if (hook) {
                await (entity as any)[hook]("beforeUpsert");
            }
        }
    }

    /** @internal */
    public async runHookOfBeforeUpdate(entities: BaseEntity | BaseEntity[]) {
        for (const entity of (Array.isArray(entities) ? entities : [entities])) {
            const hook = decoratorMeta.getHookOfBeforeUpdate(entity.constructor);
            if (hook) {
                await (entity as any)[hook]("beforeUpdate");
            }
        }
    }

    /** @internal */
    public async runHookOfBeforeDelete(entities: BaseEntity | BaseEntity[]) {
        for (const entity of (Array.isArray(entities) ? entities : [entities])) {
            const hook = decoratorMeta.getHookOfBeforeDelete(entity.constructor);
            if (hook) {
                await (entity as any)[hook]("beforeDelete");
            }
        }
    }

    /** @internal */
    public async runHookOfAfterLoad(entity: BaseEntity) {
        const hook = decoratorMeta.getHookOfAfterLoad(entity.constructor);
        if (hook) {
            await (entity as any)[hook]("afterLoad");
        }
    }
}

export const tsDatastoreOrm = new TsDatastoreOrm();
