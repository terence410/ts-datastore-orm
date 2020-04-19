import * as Datastore from "@google-cloud/datastore";
import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {EventEmitter} from "events";
import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmDatastoreError} from "./errors/DatastoreOrmDatastoreError";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {Transaction} from "./Transaction";
import {
    IArgvColumn,
    IArgvValue,
    IKey,
    IOperator,
    IOrderOptions,
    IQueryStreamEvent, IRequestResponse,
} from "./types";

type IQueryFilter = {column: string, operator: IOperator, value: string | number};
type IQueryOrder = {column: string, orderOptions?: IOrderOptions};

export class Query<T extends typeof BaseEntity> {
    private _lastRunQueryInfo: DatastoreQuery.RunQueryInfo | undefined;
    private _endCursor: string  = "";
    private _ancestor: IKey | undefined;
    private _isReadOnly: boolean = false;
    private _namespace = "";
    private _query: DatastoreQuery.Query;

    constructor(public readonly entityType: T, public readonly transaction?: Transaction) {
        const entityMeta = datastoreOrm.getEntityMeta(this.entityType);
        this._namespace = entityMeta.namespace;

        if (transaction) {
            this._query = transaction.datastoreTransaction.createQuery(entityMeta.namespace, entityMeta.kind);

        } else {
            this._query = datastoreOrm.getConnection(entityMeta.connection).createQuery(entityMeta.namespace, entityMeta.kind);
        }
    }

    public hasNextPage(): boolean {
        if (!this._lastRunQueryInfo) {
            return true;
        }

        if (this._lastRunQueryInfo.moreResults !== Datastore.Datastore.NO_MORE_RESULTS) {
            return true;
        }

        return false;
    }

    public getEndCursor(): string {
        return this._endCursor;
    }

    public setEndCursor(endCursor: string) {
        this._endCursor = endCursor;
        return this;
    }

    public selectKey() {
        this._query.select("__key__");
        this._isReadOnly = true;
        return this;
    }

    public setNamespace(value: string) {
        this._query.namespace = value;
        this._namespace = value;

        return this;
    }

    public setAncestor<R extends BaseEntity>(entity: R) {
        const ancestorKey = entity.getKey();

        // check namespace
        if (ancestorKey.namespace !== this._namespace) {
            throw new DatastoreOrmOperationError(`(${this.entityType.name}) The ancestor namespace (${ancestorKey.namespace}) is different with the query namespace (${this._namespace}).`);
        }

        this._ancestor = ancestorKey;
        this._query.hasAncestor(ancestorKey);

        const filters = this._query.filters;
        for (const filter of filters) {
            if (filter.name === "__key__" && filter.op !== "HAS_ANCESTOR") {
                (filter.val as IKey).parent = this._ancestor;
            }
        }

        return this;
    }

    public limit(value: number) {
        this._query.limit(value);
        return this;
    }

    public offset(value: number) {
        this._query.offset(value);
        return this;
    }

    public groupByAny(column: string) {
        this.groupBy(column as any);
        return this;
    }

    public groupBy<K extends IArgvColumn<InstanceType<T>>>(column: K) {
        this._query.groupBy(column as string);
        return this;
    }

    public filterAny(column: string, value: any): this;
    public filterAny(column: string, operator: IOperator, value: any): this;
    public filterAny(column: string, ...args: any[]) {
        // convert optional argument
        let operator: IOperator = "=";
        let value: any = args[0];
        if (args.length > 1) {
            operator = args[0];
            value = args[1];
        }

        this.filter(column as any, operator, value);
        return this;
    }

    public filterKey(key: IKey): this;
    public filterKey(operator: IOperator, key: IKey): this;
    public filterKey(...args: any[]) {
        // convert optional argument
        let operator: IOperator = "=";
        let key: IKey = args[0];
        if (args.length > 1) {
            operator = args[0];
            key = args[1];
        }

        this._query.filter("__key__", operator, key);
        return this;
    }

    public filter<K extends IArgvColumn<InstanceType<T>>>(column: K, value: IArgvValue<InstanceType<T>, K>): this;
    public filter<K extends IArgvColumn<InstanceType<T>>>(column: K, operator: IOperator, value: IArgvValue<InstanceType<T>, K>): this;
    public filter<K extends IArgvColumn<InstanceType<T>>>(column: K, ...args: any[]) {
        // convert optional argument
        let operator: IOperator = "=";
        let value: any = args[0];
        if (args.length > 1) {
            operator = args[0];
            value = args[1];
        }

        if (column === "id") {
            const key = datastoreOrm.createKey({namespace: this._namespace, path: [this.entityType, value]});

            if (this._ancestor) {
                key.parent = this._ancestor;
            }

            this._query.filter("__key__", operator, key);
        } else {
            this._query.filter(column as string, operator, value);
        }
        return this;
    }

    public orderAny(column: string, orderOptions?: IOrderOptions) {
        this.order(column as any, orderOptions);
        return this;
    }

    public order<K extends IArgvColumn<InstanceType<T>>>(column: K, orderOptions?: IOrderOptions) {
        if (column === "id") {
            this._query.order("__key__", orderOptions);
        } else {
            this._query.order(column as string, orderOptions);
        }
        return this;
    }

    public async runOnce(): Promise<[InstanceType<T> | undefined, IRequestResponse]> {
        const [entities, requestResponse] = await this.limit(1).run();
        return [entities.length ? entities[0] : undefined, requestResponse];
    }

    public async run(): Promise<[Array<InstanceType<T>>, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const entities: Array<InstanceType<T>> = [];

        // set cursor if has
        const endCursor = this.getEndCursor();
        if (endCursor) {
            this._query.start(endCursor);
        }

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            // get entities
            const [results, queryInfo] = await this._query.run();
            this._lastRunQueryInfo = queryInfo;

            for (const entityData of results) {
                const entity = this.entityType.newFromEntityData(entityData, this._isReadOnly);
                entities.push(entity);
            }

            // update the endCursor
            if (this._lastRunQueryInfo && this._lastRunQueryInfo.endCursor) {
                this.setEndCursor(this._lastRunQueryInfo.endCursor);
            }

            return [entities, performanceHelper.readResult()];

        } catch (err) {
            const error = new DatastoreOrmDatastoreError(`(${this.entityType.name}) Query Run Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }
    }

    public runStream(): IQueryStreamEvent<InstanceType<T>> {
        const streamEvent = new EventEmitter();

        // update endCursor
        const endCursor = this.getEndCursor();
        if (endCursor) {
            this._query.start(endCursor);
        }

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();

        // start stream
        const stream = this._query.runStream();
        stream.on("data", entityData => {
            const entity = this.entityType.newFromEntityData(entityData, this._isReadOnly);
            streamEvent.emit("data", entity);
        });

        stream.on("error", err => {
            const error = new DatastoreOrmDatastoreError(`(${this.entityType.name}) Query Run Stream Error. Error: ${err.message}.`,
                (err as any).code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            streamEvent.emit("error", error);
        });

        stream.on("info", (info) => {
            this._lastRunQueryInfo = info;
            if (this._lastRunQueryInfo && this._lastRunQueryInfo.endCursor) {
                this.setEndCursor(this._lastRunQueryInfo.endCursor);
            }

            streamEvent.emit("info", info);
        });

        stream.on("end", () => {
            streamEvent.emit("end");
        });

        return (streamEvent as any) as IQueryStreamEvent<InstanceType<T>>;
    }

    public getSQL(): string {
        const kind = this._query.kinds[0];
        let select = "*";

        if (this._query.selectVal.length) {
            select = this._query.selectVal.join(", ");
        }

        for (const groupBy of this._query.groupByVal) {
            select = ` DISTINCT ON (${this._query.groupByVal.join(", ")}) ${select}`;
        }

        let sql =  `SELECT ${select} from \`${kind}\``;

        if (this._query.filters.length) {
            const wheres: string[] = [];
            for (const filter of this._query.filters) {
                if (filter.val instanceof DatastoreEntity.entity.Key) {
                    const key = filter.val as DatastoreEntity.entity.Key;
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

                    const keyName = `Key(Namespace("${this._namespace}"), ${keyParams.join(", ")})`;
                    wheres.push(`__key__ ${op} ${keyName}`);

                } else if (typeof filter.val === "string") {
                    wheres.push(`${filter.name} ${filter.op} "${filter.val}"`);
                } else {
                    wheres.push(`${filter.name} ${filter.op} ${filter.val}`);
                }

            }
            sql += ` WHERE ${wheres.join(" AND ")}`;
        }

        for (const order of this._query.orders) {
            sql += ` ORDER BY ${order.name} ${order.sign ? "DESC" : "ASC"}`;
        }

        if (this._query.limitVal > 0) {
            sql += ` LIMIT ${this._query.limitVal}`;
        }

        if (this._query.offsetVal > 0) {
            sql += ` OFFSET ${this._query.offsetVal}`;
        }

        return sql;
    }
    
    // region private methods

    // endregion
}
