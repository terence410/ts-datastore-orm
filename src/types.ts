import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {BaseEntity} from "./BaseEntity";
import {DatastoreOrmDatastoreError} from "./errors/DatastoreOrmDatastoreError";

// region basic

export type IPropType<TObject, TProp extends keyof TObject> = TObject[TProp];
export type IConfig = {
    keyFilename: string;
    friendlyError: boolean;
    namespace: string;
    trimId: boolean;
};

// endregion

// region datastore related structure

export type IKey = DatastoreEntity.entity.Key;
export type IOperator = DatastoreQuery.Operator;
export type IOrderOptions = DatastoreQuery.OrderOptions;
export type IEntityData = {key: IKey, data: any, excludeFromIndexes: string[]};
export type ISaveResult = {
    mutationResults?: Array<{
        key?: {path?: Array<{id: string, name: string, kind: string}>};
    }>;
};

export type IStats = {
    timestamp: Date,
    builtin_index_bytes: number,
    composite_index_bytes: number,
    count: number,
    bytes: number,
    entity_bytes: number,
    builtin_index_count: number,
    composite_index_count: number,
};

// endregion

// region response

export type ITransactionResponse = {
    hasCommitted: boolean;
    totalRetry: number;
    executionTime: number;
    createdEntities: BaseEntity[];
    updatedEntities: BaseEntity[];
    deletedEntities: BaseEntity[];
};

export type IRequestResponse = {
    executionTime: number;
};

export type ILockResponse = {
    totalRetry: number;
    executionTime: number;
};

// endregion

// region decorator

export type IColumns = {[key: string]: IEntityColumn};
export interface IEntityColumnBase {
    generateId: boolean;
    index: boolean;
    excludeFromIndexes: string[];
    cast: ((newValue: any, oldValue: any) => any) | null;
}
export interface IEntityColumn extends IEntityColumnBase {
    type: any;
}
export type IEntityCompositeIndex = {__ancestor__?: boolean} | {[key: string]: "asc" | "desc"};
export type IEntityCompositeIndexes = IEntityCompositeIndex[];
export interface IEntityMetaBase {
    namespace: string;
    kind: string;
    ancestor: object | null;
}
export interface IEntityMeta extends  IEntityMetaBase {
    excludeFromIndexes: string[]; // for caching
}

// endregion

// region events

export interface IQueryStreamEvent<T> {
    on(type: "data", callback: (entity: T) => void): this;
    on(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    on(type: "error", callback: (error: DatastoreOrmDatastoreError) => void): this;
    on(type: "end", callback: () => void): this;

    addListener(type: "data", callback: (entity: T) => void): this;
    addListener(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    addListener(type: "error", callback: (error: DatastoreOrmDatastoreError) => void): this;
    addListener(type: "end", callback: () => void): this;

    removeListener(type: "data", callback: (entity: T) => void): this;
    removeListener(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    removeListener(type: "error", callback: (error: DatastoreOrmDatastoreError) => void): this;
    removeListener(type: "end", callback: () => void): this;

    once(type: "data", callback: (entity: T) => void): this;
    once(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    once(type: "error", callback: (error: DatastoreOrmDatastoreError) => void): this;
    once(type: "end", callback: () => void): this;

    off(type: "data", callback: (entity: T) => void): this;
    off(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    off(type: "error", callback: (error: DatastoreOrmDatastoreError) => void): this;
    off(type: "end", callback: () => void): this;

    emit(type: "data", entity: T): void;
    emit(type: "info", info: DatastoreQuery.RunQueryInfo): void;
    emit(type: "error", error: DatastoreOrmDatastoreError): void;
    emit(type: "end"): void;
}

// event
export type IEventsType = "create" | "update" | "delete";
export interface IEvents<T> {
    on(type: IEventsType, callback: (entity: T) => void): this;
    addListener(type: IEventsType, callback: (entity: T) => void): this;
    removeListener(type: IEventsType, callback: (entity: T) => void): this;
    once(type: IEventsType, callback: (entity: T) => void): this;
    off(type: IEventsType, callback: (entity: T) => void): this;
    emit(type: IEventsType, entity: T): void;
}

// endregion

// region arguments
export type IArgvId = string | number | IKey;
export type IArgvValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]: T[P]};
export type IArgvColumn<T extends BaseEntity> = Exclude<keyof T, keyof BaseEntity>;
export type IArgvColumns<T extends BaseEntity> = Array<Exclude<keyof T, keyof BaseEntity>>;
export type IArgvValue<T extends BaseEntity, K extends keyof IArgvValues<T>> = IArgvValues<T>[K];
export type ITransactionOptions = {
    quickRollback: boolean;
    readOnly: boolean;
    maxRetry: number;
    delay: number;
};
export type IArgvCreateKey = {
    namespace?: string,
    ancestorKey?: IKey;
    path: any[];
};
export type IArgvFind = {
    namespace?: string,
    ancestor?: BaseEntity;
    id: IArgvId;
};
export type IArgvFindMany = {
    namespace?: string,
    ancestor?: BaseEntity;
    ids: IArgvId[];
};
export type IArgvAllocateIds = {
    total: number;
    namespace: string,
};
export type IArgvNamespace = {
    namespace?: string,
};
// endregion

// region helpers

export type ILockOptions = {
    expire: number;
    maxRetry: number;
    delay: number;
    quickRelease: boolean;
    throwReleaseError: boolean;
};

// endregion
