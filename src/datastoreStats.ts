import {datastoreOrm} from "./datastoreOrm";
import {namespaceStats} from "./enums/namespaceStats";
import {stats} from "./enums/stats";
import {IArgvNamespace, IStats} from "./types";

class DatastoreStats {
    // region admin methods

    public async getNamespaces(connection?: string): Promise<string[]> {
        const datastore = datastoreOrm.getConnection(connection);
        const query = datastore
            .createQuery(["__namespace__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY].name || "");
    }

    public async getKinds(namespace?: string, connection?: string): Promise<string[]> {
        const datastore = datastoreOrm.getConnection(connection);
        const query = datastore
            .createQuery(namespace || "", ["__kind__"])
            .select("__key__");
        const [results] = await datastore.runQuery(query);
        return results.map(x => x[datastore.KEY].name);
    }

    public async getEntityProperties(entityType: object) {
        const entityMeta = datastoreOrm.getEntityMeta(entityType);
        return this.getProperties({namespace: entityMeta.namespace, kind: entityMeta.kind}, entityMeta.connection);
    }

    public async getTotal(options: IArgvNamespace = {}, connection?: string): Promise<IStats | undefined> {
        if (options.namespace) {
            const results = await this.getStats({namespace: options.namespace, stats: namespaceStats.total}, connection);
            return results.length ? results[0] as IStats : undefined;

        } else {
            const results = await this.getStats({stats: stats.total});
            return results.length ? results[0] as IStats : undefined;
        }
    }

    public async getEntityTotal(entityType: object): Promise<IStats | undefined> {
        const entityMeta = datastoreOrm.getEntityMeta(entityType);
        const results = await this.getStats({namespace: entityMeta.namespace, kind: entityMeta.kind, stats: namespaceStats.kind}, entityMeta.connection);
        return results.length ? results[0] as IStats : undefined;
    }

    public async getStats(options: {namespace?: string, kind?: string, stats: string}, connection?: string) {
        const datastore = datastoreOrm.getConnection(connection);

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

    public async getProperties(options: {namespace: string, kind: string}, connection?: string) {
        const datastore = datastoreOrm.getConnection(connection);

        const key = datastore.key(["__kind__", options.kind]);
        key.namespace = options.namespace;
        const query = datastore
            .createQuery(options.namespace, ["__property__"])
            .hasAncestor(key);
        const [results] = await datastore.runQuery(query);
        return results;
    }

    // endregion
}

export const datastoreStats = new DatastoreStats();
