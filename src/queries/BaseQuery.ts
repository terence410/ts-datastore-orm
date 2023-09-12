import * as Datastore from "@google-cloud/datastore";
import {Query} from "@google-cloud/datastore/build/src";
import {entity} from "@google-cloud/datastore/build/src/entity";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {BaseEntity} from "../BaseEntity";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {IBaseQueryParams, IFilterValue, IKey, IOrderOptions} from "../types";
import {updateStack} from "../utils";
import {QueryOperator} from "./QueryOperator";

export class BaseQuery<KT extends BaseEntity> {
    public readonly datastore: Datastore.Datastore;
    public readonly namespace: string | undefined;
    public readonly kind: string;
    public readonly query: Query;
    public lastRunQueryInfo: DatastoreQuery.RunQueryInfo | undefined;
    private _ancestorKey?: IKey;
    private _endCursor: string | undefined;

    constructor(options: IBaseQueryParams) {
        this.datastore = options.datastore;
        this.namespace = options.namespace;
        this.kind = options.kind;
        this.query = options.query;
    }

    public hasNextPage(): boolean {
        if (!this.lastRunQueryInfo) {
            return true;
        }

        if (this.lastRunQueryInfo.moreResults !== Datastore.Datastore.NO_MORE_RESULTS) {
            return true;
        }

        return false;
    }

    public filter<K extends keyof KT>(fieldName: K, expression: (query: QueryOperator<IFilterValue<KT[K]>>) => any): this;
    // tslint:disable-next-line:unified-signatures
    public filter<K extends keyof KT>(fieldName: K, value: IFilterValue<KT[K]>): this;
    public filter(...args: any[]): this {
        const fieldName = args[0];
        const queryOperator = new QueryOperator({
            fieldName,
            query: this.query,
            datastore: this.datastore,
            namespace: this.namespace,
            kind: this.kind,
            ancestorKey: this._ancestorKey,
        });

        if (typeof args[1] === "function") {
            const callback = args[1];
            callback(queryOperator);

        } else {
            const value = args[1];
            queryOperator.eq(value);
        }

        return this;
    }
    public filterKey(expression: (query: QueryOperator<IKey>) => any): this;
    // tslint:disable-next-line:unified-signatures
    public filterKey(value: IKey): this;
    public filterKey(value: any): this {
        const queryOperator = new QueryOperator({
            fieldName: "__key__",
            query: this.query,
            datastore: this.datastore,
            namespace: this.namespace,
            kind: this.kind,
            ancestorKey: this._ancestorKey,
        });

        if (typeof value === "function") {
            value(queryOperator);

        } else {
            queryOperator.eq(value);
        }

        return this;
    }

    public getEndCursor() {
        return this._endCursor;

    }

    public setEndCursor(endCursor: string) {
        this._endCursor = endCursor;
        this.query.start(endCursor);
        return this;
    }

    public setAncestorKey(key: IKey) {
        this._ancestorKey = key;
        this.query.hasAncestor(key);
        return this;
    }

    public limit(value: number) {
        this.query.limit(value);
        return this;
    }

    public offset(value: number) {
        this.query.offset(value);
        return this;
    }

    public groupBy<K extends keyof KT>(fieldName: K) {
        this.query.groupBy(fieldName as string);
        return this;
    }

    public order<K extends keyof KT>(fieldName: K, orderOptions?: IOrderOptions) {
        if (fieldName === "_id") {
            this.query.order("__key__", orderOptions);

        } else {
            this.query.order(fieldName as string, orderOptions);
        }

        return this;
    }

    public async findOne(): Promise<any | undefined> {
        this.limit(1);

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [results, queryInfo] = await this.query.run();
            const data = results[0];

            // update last run query info and endcursor
            this.lastRunQueryInfo = queryInfo;
            if (this.lastRunQueryInfo && this.lastRunQueryInfo.endCursor) {
                this.setEndCursor(this.lastRunQueryInfo.endCursor);
            }

            if (data) {
                return data;
            }

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }

    }

    public async findMany(): Promise<any[]> {
        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
        try {
            const [results, queryInfo] = await this.query.run();

            // update last run query info and endcursor
            this.lastRunQueryInfo = queryInfo;
            if (this.lastRunQueryInfo && this.lastRunQueryInfo.endCursor) {
                this.setEndCursor(this.lastRunQueryInfo.endCursor);
            }

            if (Array.isArray(results)) {
                return results;
            }

            return [];

        } catch (err) {
            throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
        }
    }

    public getSql(): string {
        const kind = this.kind;
        let select = "*";

        if (this.query.selectVal.length) {
            select = this.query.selectVal.join(", ");
        }

        for (const groupBy of this.query.groupByVal) {
            select = ` DISTINCT ON (${this.query.groupByVal.join(", ")}) ${select}`;
        }

        let sql =  `SELECT ${select} from \`${kind}\``;

        if (this.query.filters.length) {
            const wheres: string[] = [];
            for (const filter of this.query.filters) {
                if (filter.val instanceof entity.Key) {
                    const key = filter.val as IKey;
                    const op = filter.op === "HAS_ANCESTOR" ? "HAS ANCESTOR" : filter.op;

                    const keyParams = [];
                    for (let i = 0; i < key.path.length; i++ ) {
                        const path = key.path[i];
                        if (i % 2 === 0 || typeof path === "number") {
                            keyParams.push(path);
                        } else {
                            keyParams.push(`"${path}"`);
                        }
                    }

                    const namespace = this.namespace || "";
                    const keyName = `Key(Namespace("${namespace}"), ${keyParams.join(", ")})`;
                    wheres.push(`__key__ ${op} ${keyName}`);

                } else if (typeof filter.val === "string") {
                    wheres.push(`${filter.name} ${filter.op} "${filter.val}"`);

                } else if (filter.val instanceof Date) {
                    const value = `DATETIME("${filter.val.toISOString()}")`;
                    wheres.push(`${filter.name} ${filter.op} ${value}`);

                } else if (filter.val instanceof Buffer) {
                    const value = `BLOB("${filter.val.toString("base64").replace(/==$/, "")}")`;
                    wheres.push(`${filter.name} ${filter.op} ${value}`);

                } else {
                    wheres.push(`${filter.name} ${filter.op} ${filter.val}`);
                }

            }
            sql += ` WHERE ${wheres.join(" AND ")}`;
        }

        for (const order of this.query.orders) {
            sql += ` ORDER BY ${order.name} ${order.sign === '-' ? "DESC" : "ASC"}`;
        }

        if (this.query.limitVal > 0) {
            sql += ` LIMIT ${this.query.limitVal}`;
        }

        if (this.query.offsetVal > 0) {
            sql += ` OFFSET ${this.query.offsetVal}`;
        }

        return sql;
    }
}
