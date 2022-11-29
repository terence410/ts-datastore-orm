import {Datastore, Key} from "@google-cloud/datastore/build/src/";
import {Query} from "@google-cloud/datastore/build/src";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {BaseEntity} from "./BaseEntity";

// region general

export type IKey = Key;
export type IOrderOptions = DatastoreQuery.OrderOptions;
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
export type IClassObject = new (...args: any[]) => any;

// endregion

// region decorator

export type IEntityMetaOptions = {kind: string, namespace: string | undefined, excludeFromIndexes: string[], enumerable: boolean};
export type IEntityFieldMetaOptions = {generateId: boolean, index: boolean, excludeFromIndexes: string[]};
export type IEntityKeyType<T extends typeof BaseEntity> = InstanceType<T> | InstanceType<T>["_id"] | Key ;
export type IEntityFieldIndex = {_id: "asc" | "desc"} | {[key: string]: "asc" | "desc"};
export type IEntityCompositeIndex = {fields: IEntityFieldIndex, hasAncestor: boolean};
export type IEntityCompositeIndexList = IEntityCompositeIndex[];

// endregion

// region repository

export type IRepositoryParams<T> = {datastore: Datastore, classObject: T, namespace: string | undefined, kind: string};
export type IDatastoreSaveData = { key: Key, excludeFromIndexes: string[], data: any };
export type IGetInsertData = { insertData: IDatastoreSaveData, isGenerateId: boolean };
export type IGetUpdateData = { updateData: IDatastoreSaveData };

// endregion

// region class params & options
export type IConnectionOptions = {keyFilename: string } | {clientEmail: string, privateKey: string };
export type ICreateValues<T extends BaseEntity> = {[P in Exclude<keyof T, "getKey">]?: T[P]};
export type IFieldName<T extends BaseEntity> = Exclude<keyof T, keyof BaseEntity>;
export type IFieldNames<T extends BaseEntity> = IFieldName<T>[];
export type ITransactionManagerOptions = {maxRetry: number, retryDelay: number, readOnly: boolean};
export type ITransactionManagerParams = {datastore: Datastore, maxRetry: number, retryDelay: number, readOnly: boolean};
export type ILockManagerOptions = {namespace?: string, kind?: string, expiresIn: number, retryDelay?: number, maxRetry?: number};
export type ILockManagerParams = {datastore: Datastore, namespace?: string, kind?: string, expiresIn: number, maxRetry: number, retryDelay: number};
export type ILockParams<T> = IRepositoryParams<T> & {lockKey: string, expiresIn: number, maxRetry: number, retryDelay: number};
export type ILockCallback<T extends any> = () => Promise<T>;
export type ILockResult<T> = { value: T };
export type IIndexResaveHelperParams<T> = IRepositoryParams<T>;
export type IIncrementHelperOptions = {maxRetry?: number, retryDelay?: number};
export type IIncrementHelperParams<T> = IRepositoryParams<T> & {maxRetry: number, retryDelay: number};

// endregion

// region query

export type IBaseQueryParams = {datastore: Datastore, namespace: string | undefined, kind: string, query: Query};
export type IQueryParams<T> = { classObject: T } & IBaseQueryParams;
export type IStrongTypeQueryOptions = {};
export type IWeakTypeQueryOptions = {weakType: true};
export type IFilterValue<T> = T extends Array<infer U> ? (U | U[])  : T;

// endregion
