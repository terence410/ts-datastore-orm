// https://cloud.google.com/datastore/docs/concepts/stats
// https://cloud.google.com/datastore/docs/tools/indexconfig#Datastore_Updating_indexes

import * as Datastore from "@google-cloud/datastore";
import * as fs from "fs";
import {BaseEntity} from "./BaseEntity";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {
    IArgvCreateKey,
    IArgvId,
    IConnectionOptions,
    IEntityColumn,
    IEntityCompositeIndex,
    IEntityCompositeIndexes,
    IEntityMeta,
    IKey,
} from "./types";

class DatastoreOrm {
    public friendlyError: boolean = true;
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entityCompositeIndexes = new Map<object, IEntityCompositeIndexes>();
    private _entityColumns = new Map<object, {[key: string]: IEntityColumn}>();
    private _kindToEntity = new Map<string, object>();
    private _datastoreMap = new Map<string, Datastore.Datastore>();
    private _defaultNamespaceMap = new Map<string, string>();
    private _dummyDataStore: Datastore.Datastore = new Datastore.Datastore();

    constructor() {
        // do nothing
    }

    // region public methods

    public addConnection(connection: string, options: IConnectionOptions) {
        if (!this._datastoreMap.has(connection)) {
            if (options.keyFilename) {
                this._datastoreMap.set(connection,
                    new Datastore.Datastore({keyFilename: options.keyFilename}));

            } else if (options.clientEmail && options.privateKey) {
                this._datastoreMap.set(connection,
                    new Datastore.Datastore({credentials: {client_email: options.clientEmail, private_key: options.privateKey}}));

            }

            // return error if the connection options is invalid
            if (!this._datastoreMap.has(connection)) {
                throw new DatastoreOrmOperationError(`Invalid Datastore connection options.`);
            }

            // if we have default namespace, add it
            if (options.defaultNamespace) {
                this._defaultNamespaceMap.set(connection, options.defaultNamespace);

            }
        }
    }

    public getConnection(connection: string = "default"): Datastore.Datastore {
        if (this._datastoreMap.has(connection)) {
            return this._datastoreMap.get(connection) as Datastore.Datastore;
        }

        throw new DatastoreOrmOperationError(`Datastore connection not exist for "${connection}". ` +
            `Please add a new connection by: datastoreOrm.addConnection("${connection}", {keyFilename: "serviceAccount.json"});`);
    }

    public getDefaultNamespace(connection: string): string | undefined {
        if (this._defaultNamespaceMap.has(connection)) {
            return this._defaultNamespaceMap.get(connection);
        }
    }

    // public getDatastore(): Datastore.Datastore {
    //     return this._dataStore;
    // }

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
            if (namespace === undefined) {
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

        // create key with namespace (use default connection)
        const key = this._dummyDataStore.key({namespace, path: keyPaths});
        if (ancestorKey) {
            key.parent = ancestorKey;
        }

        return key;
    }

    public exportCompositeIndexes<T extends typeof BaseEntity>(filename: string, entityTypes: T[]) {
        let yaml = "indexes:\n";
        for (const entityType of entityTypes) {
            const entityMeta = this.getEntityMeta(entityType);
            const compositeIndexes = this.getEntityCompositeIndexes(entityType);
            for (const compositeIndex of compositeIndexes) {
                yaml += "\n";
                yaml += `  - kind: ${entityMeta.kind}\n`;
                if (entityMeta.ancestor && (compositeIndex.__ancestor__ || compositeIndex.__ancestor__ === undefined)) {
                    yaml += `    ancestor: yes\n`;
                } else {
                    yaml += `    ancestor: no\n`;
                }

                yaml += `    properties:\n`;
                for (let [column, direction] of Object.entries(compositeIndex)) {
                    if (column === "id") {
                        column = "__key__";
                    }

                    if (column !== "__ancestor__") {
                        yaml += `    - name: ${column}\n`;
                        yaml += `      direction: ${direction}\n`;
                    }
                }
            }
        }

        fs.writeFileSync(filename, yaml);
    }

    // endregion

    // region public internal methods

    /** @internal */
    public useFriendlyErrorStack(): string | undefined {
        if (this.friendlyError) {
            return new Error().stack;
        }
    }

    /** @internal */
    public mapIdsToKeys(entityType: object, ids: IArgvId[], namespace?: string, ancestorKey?: IKey) {
        return ids.map(x => {
            if (typeof x === "string" || typeof x === "number") {
                return datastoreOrm.createKey({namespace, ancestorKey, path: [entityType, x]});

            } else {
                if (namespace) {
                    x.namespace = namespace;
                }

                if (ancestorKey) {
                    x.parent = ancestorKey;
                }

                return x;
            }
        });
    }

    /** @internal */
    public getEntityByKind(connection: string, kind: string): object | undefined {
        return this._kindToEntity.get(`${connection}/${kind}`);
    }

    /** @internal */
    public addEntity(target: object, entityMeta: IEntityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
            this._kindToEntity.set(`${entityMeta.connection}/${entityMeta.kind}`, target);
        }

        // also add composite indexes default if not exist
        if (!this._entityCompositeIndexes.has(target)) {
            this._entityCompositeIndexes.set(target, []);
        }
    }

    /** @internal */
    public addCompositeIndex(target: object, compositeIndex: IEntityCompositeIndex) {
        if (!this._entityCompositeIndexes.has(target)) {
            this._entityCompositeIndexes.set(target, []);
        }

        if (Object.keys(compositeIndex).length) {
            const compositeIndexes = this._entityCompositeIndexes.get(target) as IEntityCompositeIndexes;
            compositeIndexes.push(compositeIndex);
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
    public getEntityCompositeIndexes(target: object): IEntityCompositeIndexes {
        return this._entityCompositeIndexes.get(target) as IEntityCompositeIndexes;
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
}

export const datastoreOrm = new DatastoreOrm();
