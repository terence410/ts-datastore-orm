// https://cloud.google.com/datastore/docs/concepts/stats

import * as Datastore from "@google-cloud/datastore";
import {configLoader} from "./configLoader";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {Transaction} from "./Transaction";
import {IEntityColumn, IEntityMeta, IKey, ISaveResult} from "./types";

class DatastoreOrm {
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entityColumns = new Map<object, {[key: string]: IEntityColumn}>();
    private _dataStore: Datastore.Datastore;

    constructor() {
        const configFile = configLoader.getConfig();
        this._dataStore = new Datastore.Datastore({keyFilename: configFile.keyFilename});
    }

    // region public methods

    public getDatastore(): Datastore.Datastore {
        return this._dataStore;
    }

    public useFriendlyErrorStack(): string | undefined {
        if (configLoader.getConfig().friendlyError) {
            return new Error().stack;
        }
    }

    public createKey(...argv: any[]): IKey {
        const path: Array<string | number> = [];
        let namespace: string = "";

        if (Array.isArray(argv[0])) {
            argv = argv[0];
        }

        for (let i = 0; i < argv.length; i++) {
            const target = argv[i++];
            const entityMeta = datastoreOrm.getEntityMeta(target);
            namespace = entityMeta.namespace;

            // add kind
            path.push(entityMeta.kind);

            // add id if we have
            if (i <= argv.length - 1) {
                const id = argv[i];
                if (!id) {
                    throw new DatastoreOrmOperationError(`(${target.name}) id must be non zero and non empty.`);
                }

                const idType = typeof id;
                if (idType !== "number" && idType !== "string") {
                    throw new DatastoreOrmOperationError(`(${target.name}) id must be string or number. Current type (${idType}).`);
                }

                path.push(id);
            }
        }

        // create key with namespace
        const datastore = this.getDatastore();
        const key = datastore.key(path);
        if (namespace) {
            key.namespace = namespace;
        }

        return key;
    }

    // endregion

    // region public internal methods

    /** @internal */
    public addEntity(target: object, entityMeta: IEntityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
        }
    }

    /** @internal */
    public addColumn(target: object, column: string, schema: IEntityColumn) {
        let entityColumns = this._entityColumns.get(target);
        if (!entityColumns) {
            entityColumns = {};
            this._entityColumns.set(target, entityColumns);
        }
        entityColumns[column] = schema;
    }

    /** @internal */
    public getEntityMeta(target: object): IEntityMeta {
        return this._entityMetas.get(target) as IEntityMeta;
    }

    /** @internal */
    public getEntityColumns(target: object): {[key: string]: IEntityColumn} {
        return this._entityColumns.get(target) || {};
    }

    /** @internal */
    public getEntityColumn(target: object, column: string): IEntityColumn {
        const entityColumns = this.getEntityColumns(target);
        return entityColumns[column];
    }

    /** @internal */
    public getColumns(target: object): string[] {
        const entityColumns = this._entityColumns.get(target) || {};
        return Object.keys(entityColumns);
    }

    /** @internal */
    public getExcludeFromIndexes(target: object): string[] {
        const entityMeta = datastoreOrm.getEntityMeta(target);
        return entityMeta.excludeFromIndexes;
    }

    /** @internal */
    public createQuery(target: object, transaction?: Transaction) {
        const entityMeta = datastoreOrm.getEntityMeta(target);
        if (transaction) {
            return transaction.datastoreTransaction.createQuery(entityMeta.namespace, entityMeta.kind);

        } else {
            return datastoreOrm.getDatastore().createQuery(entityMeta.namespace, entityMeta.kind);
        }
    }

    /** @internal */
    public extractMutationKeys(saveResult: ISaveResult): IKey[] {
        const keys: IKey[] = [];

        if (saveResult.mutationResults) {
            for (const mutation of saveResult.mutationResults) {
                if (mutation.key && mutation.key.path) {
                    const paths = mutation.key.path.reduce((a, b) => {
                        a.push(b.kind);
                        a.push(b.name || Number(b.id));
                        return a;
                    }, [] as any[]);
                    const key = this.getDatastore().key(paths);
                    keys.push(key);
                }
            }
        }

        return keys;
    }

    /** @internal */
    public isValidAncestorKey(target: object, ancestorKey: IKey | undefined) {
        const entityMeta = datastoreOrm.getEntityMeta(target);
        // if we need ancestor
        if (entityMeta.ancestors.length) {
            if (!ancestorKey) {
                const names = entityMeta.ancestors.map(x => (x as any).name).join(", ");
                throw new DatastoreOrmOperationError(`(${(target as any).name}) This entity require ancestors of (${names}).`);

            } else {
                let isValid = false;
                for (const ancestor of entityMeta.ancestors) {
                    const ancestorEntityMeta = datastoreOrm.getEntityMeta(ancestor);
                    if (ancestorEntityMeta.kind === ancestorKey.kind) {
                        isValid = true;
                        break;
                    }
                }

                if (!isValid) {
                    const names = entityMeta.ancestors.map(x => (x as any).name).join(", ");
                    let errorMessage = `(${(target as any).name}) This entity require ancestors of (${names}), `;
                    errorMessage += `but the current ancestor kind is (${ancestorKey.kind}).`;
                    throw new DatastoreOrmOperationError(errorMessage);
                }
            }
        } else {
            // if we don't have ancestor, but an ancestor key is provided
            if (ancestorKey) {
                let errorMessage = `(${(target as any).name}) This entity does not require any ancestor, `;
                errorMessage += `but the current ancestor kind is (${ancestorKey.kind}).`;
                throw new DatastoreOrmOperationError(errorMessage);
            }
        }
    }

    // endregion
    
    // region admin methods
    
    public async getNamespaces(): Promise<IKey[]> {
        const datastore = this.getDatastore();
        const query = datastore
            .createQuery(["__namespace__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY]);
    }

    public async getKinds(namespaceName?: string): Promise<IKey[]> {
        const datastore = this.getDatastore();
        const query = datastore
            .createQuery(namespaceName || "", ["__kind__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY]);
    }

    public async getAllStats() {
        //
    }

    public async getStats(namespaceName: string | undefined, kind: string, statsName: string): Promise<IKey[]> {
        // if we have namespace, we modify the kindName
        // if (namespaceName) {
        //     statsName = statsName.replace("__Stat", "__Stat_Ns");
        // }

        const datastore = this.getDatastore();

        // prepare query
        const query = datastore
            .createQuery( namespaceName as string, [statsName]);

        // if we have kind, then we query the kind with key
        if (kind) {
            const key = datastore.key([statsName, kind as string]);
            key.namespace = namespaceName as string;
            query.filter("__key__", "=", key);
        }

        const [results] = await datastore.runQuery(query);
        return results;
    }

    public async getStatsByType(entityType: object, statsName: string): Promise<IKey[]> {
        // if we have namespace, we modify the kindName
        const entityMeta = this.getEntityMeta(entityType);
        return this.getStats(entityMeta.namespace, entityMeta.kind, statsName);
    }

    public async getProperties(kind: IKey): Promise<IKey[]> {
        const datastore = this.getDatastore();
        const query = datastore
            .createQuery(kind.namespace || "", ["__property__"])
            .hasAncestor(kind);
        const [results] = await datastore.runQuery(query);
        return results;
    }
    
    // endregion

    // region private methods

    private _createExcludeFromIndexes(target: object): string[] {
        const entityColumns = datastoreOrm.getEntityColumns(target);
        const excludeFromIndexes: string[] = [];
        for (const [column, entityColumn] of Object.entries(entityColumns)) {
            if (entityColumn.excludeFromIndexes.length) {
                for (const subColumn of entityColumn.excludeFromIndexes ) {
                    excludeFromIndexes.push(`${column}.${subColumn}`);
                }
            } else if (!entityColumn.index) {
                excludeFromIndexes.push(column);
            }
        }

        return excludeFromIndexes;
    }
    // endregion
}

export const datastoreOrm = new DatastoreOrm();
