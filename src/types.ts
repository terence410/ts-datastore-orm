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

export type IKey = DatastoreEntity.entity.Key;
export type IOperator = DatastoreQuery.Operator;
export type IOrderOptions = DatastoreQuery.OrderOptions;
export type IEntityData = {key: IKey, data: any, excludeFromIndexes: string[]};
export type ISaveResult = {
    mutationResults?: Array<{
        key?: {path?: Array<{id: string, name: string, kind: string}>};
    }>;
};

// endregion

// region response

export type ITransactionResponse = {
    hasCommit: boolean;
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

export interface IQueryStreamEvent<T> {
    on(type: "data", callback: (entity: T) => void): this;
    on(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    on(type: "error", callback: (error: Error) => void): this;
    on(type: "end", callback: () => void): this;

    addListener(type: "data", callback: (entity: T) => void): this;
    addListener(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    addListener(type: "error", callback: (error: Error) => void): this;
    addListener(type: "end", callback: () => void): this;

    removeListener(type: "data", callback: (entity: T) => void): this;
    removeListener(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    removeListener(type: "error", callback: (error: Error) => void): this;
    removeListener(type: "end", callback: () => void): this;

    once(type: "data", callback: (entity: T) => void): this;
    once(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    once(type: "error", callback: (error: Error) => void): this;
    once(type: "end", callback: () => void): this;

    off(type: "data", callback: (entity: T) => void): this;
    off(type: "info", callback: (info: DatastoreQuery.RunQueryInfo) => void): this;
    off(type: "error", callback: (error: Error) => void): this;
    off(type: "end", callback: () => void): this;

    emit(type: "data", entity: T): void;
    emit(type: "info", info: DatastoreQuery.RunQueryInfo): void;
    emit(type: "error", error: Error): void;
    emit(type: "end"): void;
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
