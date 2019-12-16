// https://cloud.google.com/datastore/docs/concepts/stats

import * as Datastore from "@google-cloud/datastore";
import {configLoader} from "./configLoader";
import {namespaceStats} from "./enums/namespaceStats";
import {stats} from "./enums/stats";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {IArgvCreateKey, IEntityColumn, IEntityMeta, IKey, ISaveResult, IStats} from "./types";

class DatastoreOrm {
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entityColumns = new Map<object, {[key: string]: IEntityColumn}>();
    private _kindToEntity = new Map<string, object>();
    private _dataStore: Datastore.Datastore;

    constructor() {
        const config = configLoader.getConfig();
        this._dataStore = new Datastore.Datastore({keyFilename: config.keyFilename});
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

    public createKey(argv: any[] | IArgvCreateKey): IKey {
        const keyPaths: Array<string | number> = [];

        let path: any[] = argv as any[];
        let namespace: string | undefined;
        let ancestorKey: IKey | undefined;
        if (!Array.isArray(argv)) {
            namespace = argv.namespace;
            ancestorKey = argv.ancestorKey;
            path = argv.path;
        }

        for (let i = 0; i < path.length; i++) {
            const target = path[i++];
            const entityMeta = datastoreOrm.getEntityMeta(target);
            if (!namespace) {
                namespace = entityMeta.namespace;
            }

            // add kind
            keyPaths.push(entityMeta.kind);

            // add id if we have
            if (i <= path.length - 1) {
                const id = path[i];
                if (!id) {
                    throw new DatastoreOrmOperationError(`(${target.name}) id must be non zero and non empty.`);
                }

                const idType = typeof id;
                if (idType !== "number" && idType !== "string") {
                    throw new DatastoreOrmOperationError(`(${target.name}) id must be string or number. Current type (${idType}).`);
                }

                keyPaths.push(id);
            }
        }

        // create key with namespace
        const datastore = this.getDatastore();
        const key = datastore.key({namespace, path: keyPaths});
        if (ancestorKey) {
            key.parent = ancestorKey;
        }

        return key;
    }

    // endregion

    // region public internal methods

    /** @internal */
    public getEntityByKind(kind: string): object | undefined {
        return this._kindToEntity.get(kind);
    }

    /** @internal */
    public addEntity(target: object, entityMeta: IEntityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
            this._kindToEntity.set(entityMeta.kind, target);
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

    // endregion
    
    // region admin methods
    
    public async getNamespaces(): Promise<string[]> {
        const datastore = this.getDatastore();
        const query = datastore
            .createQuery(["__namespace__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY].name || "");
    }

    public async getKinds(namespace?: string): Promise<string[]> {
        const datastore = this.getDatastore();
        const query = datastore
            .createQuery(namespace || "", ["__kind__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY].name);
    }

    public async getEntityProperties(entityType: object) {
        const entityMeta = this.getEntityMeta(entityType);
        return this.getProperties({namespace: entityMeta.namespace, kind: entityMeta.kind});
    }

    public async getStatsTotal(): Promise<IStats | undefined> {
        const results = await this.getStats({stats: stats.total});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getNamespaceStatsTotal(namespace: string): Promise<IStats | undefined> {
        const results = await this.getStats({namespace, stats: namespaceStats.total});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getEntityStatsTotal(entityType: object): Promise<IStats | undefined> {
        const entityMeta = this.getEntityMeta(entityType);
        const results = await this.getStats({namespace: entityMeta.namespace, kind: entityMeta.kind, stats: namespaceStats.kind});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getStats(options: {namespace?: string, kind?: string, stats: string}) {
        const datastore = this.getDatastore();

        // prepare query
        const query = datastore .createQuery( options.namespace as string, [options.stats]);

        // if we have kind, then we query the kind with key
        if (typeof options.kind === "string") {
            const key = datastore.key([options.stats, options.kind]);
            key.namespace = options.namespace;
            query.filter("__key__", "=", key);
        }

        const [results] = await datastore.runQuery(query);
        return results;

    }

    public async getProperties(options: {namespace: string, kind: string}) {
        const datastore = this.getDatastore();

        const key = datastore.key(["__kind__", options.kind]);
        key.namespace = options.namespace;
        const query = datastore
            .createQuery(options.namespace, ["__property__"])
            .hasAncestor(key);
        const [results] = await datastore.runQuery(query);
        return results;
    }
    
    // endregion

    // region private methods

    // endregion
}

export const datastoreOrm = new DatastoreOrm();
