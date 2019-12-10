import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {BaseEntity} from "./BaseEntity";

// region basic

export type IConfig = {
    keyFilename: string;
    friendlyError: boolean;
    transaction: {delay: number};
};

// endregion

// region datastore related structure

export type IKeyType = number | string;
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
    savedEntities: BaseEntity[];
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
}
export interface IEntityColumn extends IEntityColumnBase{
    type: any;
}
export interface IEntityMetaBase {
    namespace: string;
    kind: string;
    ancestors: object | object[];
}
export interface IEntityMeta extends  IEntityMetaBase {
    excludeFromIndexes: string[]; // for caching
    ancestors: object[];
}

// endregion

// region query

export type IQueryStreamEventType = "data" | "info" | "error" | "end";
export interface IQueryStreamEvent<T> {
    on(type: IQueryStreamEventType, callback: (entity: T) => void): this;
    addListener(type: IQueryStreamEventType, callback: (entity: T) => void): this;
    removeListener(type: IQueryStreamEventType, callback: (entity: T) => void): this;
    once(type: IQueryStreamEventType, callback: (entity: T) => void): this;
    off(type: IQueryStreamEventType, callback: (entity: T) => void): this;
    emit(type: IQueryStreamEventType, entity: T): void;
}

// endregion

// region arguments
export type IArgvValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]: T[P]};
export type IArgvId = string | number;
export type IArgvColumn<T extends BaseEntity> = Exclude<keyof T, keyof BaseEntity>;
export type IArgvValue<T extends BaseEntity, K extends keyof IArgvValues<T>> = IArgvValues<T>[K];
export type ITransactionOptions = {
    quickRollback: boolean;
    readOnly: boolean;
    maxRetry: number;
    delay: number;
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
