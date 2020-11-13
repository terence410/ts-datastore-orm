import * as Datastore from "@google-cloud/datastore";
import {Query} from "@google-cloud/datastore/build/src";
import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";

export class QueryOperator<V extends any> {
    private fieldName: string;
    private query: Query;
    private datastore: Datastore.Datastore;
    private namespace: string | undefined;
    private kind: string;
    private ancestorKey?: DatastoreEntity.entity.Key;

    constructor(options: {fieldName: string, query: Query, datastore: Datastore.Datastore, namespace: string | undefined, kind: string, ancestorKey?: DatastoreEntity.entity.Key}) {
        this.query = options.query;
        this.fieldName = options.fieldName;
        this.datastore = options.datastore;
        this.namespace = options.namespace;
        this.kind = options.kind;
        this.ancestorKey = options.ancestorKey;
    }

    public eq(value: V) {
        this._operation("=", value);
    }

    public le(value: V) {
        this._operation("<=", value);
        return this;
    }

    public lt(value: V) {
        this._operation("<", value);
        return this;
    }

    public ge(value: V) {
        this._operation(">=", value);
        return this;
    }

    public gt(value: V) {
        this._operation(">", value);
        return this;
    }

    private _operation(operator: "=" | ">=" | ">" | "<=" | "<", value: any) {
        if (this.fieldName === "_id") {
            const key = this.datastore.key({namespace: this.namespace, path: [this.kind, value]});
            
            if (this.ancestorKey) {
                key.parent = this.ancestorKey;
            }

            this.query.filter("__key__", operator, key);
        } else {
            this.query.filter(this.fieldName, operator, value);
        }

    }
}
