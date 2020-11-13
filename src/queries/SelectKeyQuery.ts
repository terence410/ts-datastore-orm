import * as Datastore from "@google-cloud/datastore";
import {Query} from "@google-cloud/datastore/build/src";
import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import {BaseEntity} from "../BaseEntity";
import {MAX_ENTITIES} from "../constants";
import {BaseQuery} from "./BaseQuery";
import {SelectKeyQueryAsyncIterator} from "./SelectKeyQueryAsyncIterator";

export class SelectKeyQuery<KT extends BaseEntity> extends BaseQuery<KT> {
    constructor(options: {datastore: Datastore.Datastore, namespace: string | undefined, kind: string, query: Query}) {
        super({datastore: options.datastore, namespace: options.namespace, kind: options.kind, query: options.query})
        this.query.select("__key__");
    }

    public getAsyncIterator() {
        if (this.query.limitVal === -1) {
            this.query.limit(MAX_ENTITIES);
        }

        return new SelectKeyQueryAsyncIterator({query: this.query});
    }

    public async findOne() {
        const data = await super.findOne();
        if (data) {
            return data[DatastoreEntity.entity.KEY_SYMBOL] as DatastoreEntity.entity.Key;
        }
    }

    public async findMany() {
        const results = await super.findMany();
        const keys: DatastoreEntity.entity.Key[] = [];

        for (const data of results) {
            const key = data[DatastoreEntity.entity.KEY_SYMBOL] as DatastoreEntity.entity.Key;
            keys.push(key);
        }

        return keys;
    }
}
