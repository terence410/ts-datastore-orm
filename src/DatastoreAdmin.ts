import * as Datastore from "@google-cloud/datastore";
import {namespaceStats} from "./enums/namespaceStats";
import {stats} from "./enums/stats";
import {tsDatastoreOrm} from "./tsDatastoreOrm";
import {IStats} from "./types";
import {updateStack} from "./utils";

export class DatastoreAdmin {
    public datastore: Datastore.Datastore;

    constructor(options: {datastore: Datastore.Datastore}) {
        this.datastore = options.datastore;
    }

    public async getNamespaces() {
        const query = this.datastore
            .createQuery(["__namespace__"])
            .select("__key__");

        const results = await this._runQuery(query);
        return results.map(x => x[this.datastore.KEY].name || "");
    }

    public async getKinds(): Promise<string[]> {
        const query = this.datastore
            .createQuery([stats.kind])
            .select("__key__");

        const results = await this._runQuery(query);
        return results.map(x => x[this.datastore.KEY].name);
    }

    public async getNamespaceKinds(namespace: string): Promise<string[]> {
        const query = this.datastore
            .createQuery(namespace, [namespaceStats.kind])
            .select("__key__");

        const results = await this._runQuery(query);
        return results.map(x => x[this.datastore.KEY].name);
    }

    public async getStats() {
        const results = await this._getStats({namespace: "", stats: stats.total});
        return results[0] as IStats;
    }

    public async getKindStats(kind: string) {
        const results = await this._getStats({namespace: "", kind, stats: stats.kind});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getNamespaceKindStats(namespace: string, kind: string) {
        const results = await this._getStats({namespace, kind, stats: namespaceStats.kind});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getNamespaceTotal(namespace: string) {
        const results = await this._getStats({namespace, stats: namespaceStats.total});
        return results.length ? results[0] as IStats : undefined;
    }

    public async getNamespaceKindProperties(namespace: string, kind: string) {
        return this._getProperties({namespace, kind});
    }

    private async _getStats(options: {namespace: string, kind?: string, stats: string}, connection?: string) {
        // prepare query
        const query = this.datastore.createQuery( options.namespace, [options.stats]);

        // if we have kind, then we query the kind with key
        if (typeof options.kind === "string") {
            const key = this.datastore.key([options.stats, options.kind]);
            key.namespace = options.namespace;
            query.filter("__key__", "=", key);
        }

        return await this._runQuery(query);

    }

    private async _getProperties(options: {namespace: string, kind: string}) {
        const key = this.datastore.key(["__kind__", options.kind]);
        key.namespace = options.namespace;

        const query = this.datastore
            .createQuery(options.namespace, ["__property__"])
            .hasAncestor(key);

        return await this._runQuery(query);
    }

    private async _runQuery(query: Datastore.Query) {
        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [results] = await this.datastore.runQuery(query);
            return results;
        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }
}
