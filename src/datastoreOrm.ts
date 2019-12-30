// https://cloud.google.com/datastore/docs/concepts/stats
// https://cloud.google.com/datastore/docs/tools/indexconfig#Datastore_Updating_indexes

import * as Datastore from "@google-cloud/datastore";
import * as fs from "fs";
import {BaseEntity} from "./BaseEntity";
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
        this._dataStore = new Datastore.Datastore({projectId: config.projectId,
            credentials: {client_email: config.clientEmail, private_key: config.privateKey}});
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

    public exportCompositeIndexes<T extends typeof BaseEntity>(filename: string, entityTypes: T[]) {
        let yaml = "indexes:\n";
        for (const entityType of entityTypes) {
            const entityMeta = this.getEntityMeta(entityType);
            if (entityMeta.compositeIndexes.length) {
                for (const compositeIndex of entityMeta.compositeIndexes) {
                    yaml += "\n";
                    yaml += `  - kind: ${entityMeta.kind}\n`;
                    if (entityMeta.ancestor) {
                        yaml += `    ancestor: yes\n`;
                    } else {
                        yaml += `    ancestor: no\n`;
                    }

                    yaml += `    properties:\n`;
                    for (let [column, direction] of Object.entries(compositeIndex)) {
                        if (column === "id") {
                            column = "__key__";
                        }

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
}

export const datastoreOrm = new DatastoreOrm();
