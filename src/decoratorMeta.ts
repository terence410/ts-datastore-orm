import {TsDatastoreOrmError} from "./errors/TsDatastoreOrmError";
import {
    IEntityCompositeIndexList,
    IEntityFieldIndex,
    IEntityFieldMetaOptions,
    IEntityMetaOptions
} from "./types";

class DecoratorMeta {
    public entityMetaMap = new Map<object, IEntityMetaOptions>();
    public entityFieldMetaListMap = new Map<object, Map<string, IEntityFieldMetaOptions>>();
    public compositeIndexListMap = new Map<object, IEntityCompositeIndexList>();
    public entityHookOfBeforeInsertMap = new Map<object, string | symbol>();
    public entityHookOfBeforeUpsertMap = new Map<object, string | symbol>();
    public entityHookOfBeforeUpdateMap = new Map<object, string | symbol>();
    public entityHookOfBeforeDeleteMap = new Map<object, string | symbol>();
    public entityHookOfAfterLoadMap = new Map<object, string | symbol>();

    public addEntityMeta(classObject: object, options: IEntityMetaOptions) {
        this.entityMetaMap.set(classObject, options);
    }

    public hasEntityMeta(classObject: object) {
        return this.entityMetaMap.has(classObject);
    }

    public getEntityMeta(classObject: object): IEntityMetaOptions {
        const entityMeta = this.entityMetaMap.get(classObject);
        if (!entityMeta) {
            throw new TsDatastoreOrmError(`(${(classObject as any).name}) Entity must define with class decorator @Entity().`);
        }

        return entityMeta;
    }

    public addEntityCompositeIndex(classObject: object, fields: IEntityFieldIndex, hasAncestor: boolean) {
        if (!this.compositeIndexListMap.has(classObject)) {
            this.compositeIndexListMap.set(classObject, []);
        }
        
        const compositeIndexList = this.compositeIndexListMap.get(classObject)!;
        compositeIndexList.push({
            fields,
            hasAncestor,
        });
    }

    public getEntityCompositeIndexList(classObject: object): IEntityCompositeIndexList {
        const entityCompositeIndexes = this.compositeIndexListMap.get(classObject);
        return entityCompositeIndexes || [];
    }

    // this allow overriding of settings
    public addEntityFieldMeta(classObject: object, fieldName: string, options: IEntityFieldMetaOptions) {
        let map = this.entityFieldMetaListMap.get(classObject);
        if (!map) {
            map = new Map();
            this.entityFieldMetaListMap.set(classObject, map);

        }
        map.set(fieldName, options);
    }

    public hasEntityFieldMetaList(classObject: object) {
        return this.entityFieldMetaListMap.has(classObject);
    }

    public hasEntityFieldMeta(classObject: object, fieldName: string) {
        const entityFieldMeta = this.entityFieldMetaListMap.get(classObject);
        return entityFieldMeta ? entityFieldMeta.has(fieldName) : false;
    }

    public getEntityFieldMetaList(classObject: object): Map<string, IEntityFieldMetaOptions> {
        return this.entityFieldMetaListMap.get(classObject)!;
    }

    public getEntityFieldNames(classObject: object): string[] {
        const map = this.entityFieldMetaListMap.get(classObject)!;
        return Array.from(map.keys());
    }

    public addHookOfBeforeInsert(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeInsertMap.set(classObject, propertyKey);
    }

    public getHookOfBeforeInsert(classObject: object) {
        return this.entityHookOfBeforeInsertMap.get(classObject);
    }

    public addHookOfBeforeUpsert(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeUpsertMap.set(classObject, propertyKey);
    }

    public getHookOfBeforeUpsert(classObject: object) {
        return this.entityHookOfBeforeUpsertMap.get(classObject);
    }

    public addHookOfBeforeUpdate(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeUpdateMap.set(classObject, propertyKey);
    }

    public getHookOfBeforeUpdate(classObject: object) {
        return this.entityHookOfBeforeUpdateMap.get(classObject);
    }

    public addHookOfBeforeDelete(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfBeforeDeleteMap.set(classObject, propertyKey);
    }

    public getHookOfBeforeDelete(classObject: object) {
        return this.entityHookOfBeforeDeleteMap.get(classObject);
    }

    public addHookOfAfterLoad(classObject: object, propertyKey: string | symbol) {
        this.entityHookOfAfterLoadMap.set(classObject, propertyKey);
    }

    public getHookOfAfterLoad(classObject: object) {
        return this.entityHookOfAfterLoadMap.get(classObject);
    }

    public isGenerateId(classObject: object) {
        const map = this.entityFieldMetaListMap.get(classObject)!;
        const fieldMap = map.get("_id");
        return !!(fieldMap!.generateId);
    }

    public getExcludeFromIndexes(target: object): string[] {
        const entityMeta = this.getEntityMeta(target);
        return entityMeta.excludeFromIndexes;
    }
}

export const decoratorMeta = new DecoratorMeta();
