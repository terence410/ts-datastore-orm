import * as Datastore from "@google-cloud/datastore";
import * as DatastoreQuery from "@google-cloud/datastore/build/src/query";
import {EventEmitter} from "events";
import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
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
    private _ancestor: IKey | undefined;
    private _selectKey: boolean = false;
    private _query: DatastoreQuery.Query;

    constructor(public readonly entityType: T, public readonly transaction?: Transaction) {
        this._query = datastoreOrm.createQuery(this.entityType, this.transaction);
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

    public selectKey() {
        this._query.select("__key__");
        this._selectKey = true;
        return this;
    }

    public setAncestor<R extends BaseEntity>(entity: R) {
        const key = entity.getKey();
        this._ancestor = key;
        this._query.hasAncestor(key);
        return this;
    }

    public setAncestorKey(key: IKey) {
        this._ancestor = key;
        this._query.hasAncestor(key);
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

    public filterAny(column: string, operator: IOperator, value: any) {
        this.filter(column as any, operator, value);
        return this;
    }

    public filterKey(operator: IOperator, key: IKey) {
        this._query.filter("__key__", operator, key);
        return this;
    }

    public filter<K extends IArgvColumn<InstanceType<T>>>(column: K, operator: IOperator, value: IArgvValue<InstanceType<T>, K>) {
        if (column === "id") {
            const key = datastoreOrm.createKey(this.entityType, value as any);
            if (this._ancestor) {
                key.parent = this._ancestor;
            }

            this._query.filter("__key__", operator, key);
        } else {
            this._query.filter(column as string, operator, value as any);
        }
        return this;
    }

    public orderAny(column: string, orderOptions?: IOrderOptions) {
        this.order(column as any, orderOptions);
        return this;
    }

    public order<K extends IArgvColumn<InstanceType<T>>>(column: K, orderOptions?: IOrderOptions) {
        this._query.order(column as string, orderOptions);
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
        if (this._lastRunQueryInfo && this._lastRunQueryInfo.endCursor) {
            this._query.start(this._lastRunQueryInfo.endCursor);
        }

        // get entities
        const [results, queryInfo] = await this._query.run();
        this._lastRunQueryInfo = queryInfo;

        for (const entityData of results) {
            const entity = this.entityType.newFromEntityData(entityData, this._selectKey);
            entities.push(entity);
        }

        return [entities, performanceHelper.readResult()];
    }

    public runStream(): IQueryStreamEvent<InstanceType<T>> {
        const streamEvent = new EventEmitter();

        if (this._lastRunQueryInfo && this._lastRunQueryInfo.endCursor) {
            this._query.start(this._lastRunQueryInfo.endCursor);
        }
        const stream = this._query.runStream();
        stream.on("data", entityData => {
            const entity = this.entityType.newFromEntityData(entityData, this._selectKey);
            streamEvent.emit("data", entity);
        });

        stream.on("error", error => {
            streamEvent.emit("error", error);
        });

        stream.on("info", (info) => {
            this._lastRunQueryInfo = info;
            streamEvent.emit("info", info);
        });

        stream.on("end", () => {
            streamEvent.emit("end");
        });

        return (streamEvent as any) as IQueryStreamEvent<InstanceType<T>>;
    }
    
    // region private methods

    // endregion
}
