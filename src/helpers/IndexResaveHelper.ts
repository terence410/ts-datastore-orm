import {DatastoreOrmDatastoreError, DatastoreOrmOperationError} from "..";
import {BaseEntity} from "../BaseEntity";
import {datastoreOrm} from "../datastoreOrm";
import {IArgvColumns, IArgvNamespace, IRequestResponse} from "../types";
import {PerformanceHelper} from "./PerformanceHelper";

export class IndexResaveHelper<T extends typeof BaseEntity> {
    constructor(public readonly entityType: T) {

    }

    public async resave(columns: IArgvColumns<InstanceType<T>>, options: IArgvNamespace = {}): Promise<[number, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        for (const column of columns) {
            const entityColumn = datastoreOrm.getEntityColumn(this.entityType, column as string);
            if (!entityColumn || !entityColumn.index) {
                throw new DatastoreOrmOperationError(`(IndexResaveHelper, ${this.entityType.name}) Column (${column}) is not set to index`);
            }
        }

        const batch = 500;
        const query = this.entityType.query().limit(batch);
        const namespace = options.namespace || "";

        // set namespace if we have
        if (namespace) {
            query.setNamespace(namespace);
        }

        // we do batch delete to optimize performance
        const datastore = datastoreOrm.getDatastore();
        let totalUpdated = 0;

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        while (query.hasNextPage()) {
            const updateDataList = [];

            // query
            const [entities] = await query.run();
            totalUpdated += entities.length;

            // prepare update data
            for (const entity of entities) {
                const data = columns.reduce((a, b) => Object.assign(a, {[b]: entity.get(b)}), {});
                updateDataList.push({
                    key: entity.getKey(),
                    data,
                });
            }

            // update the only selected columns
            try {
                await datastore.merge(updateDataList);
            } catch (err) {
                const error = new DatastoreOrmDatastoreError(`(IndexResaveHelper, ${this.entityType.name}) Datastore update error. Error: ${err.message}.`,
                    err.code,
                    err);
                if (friendlyErrorStack) {
                    error.stack = friendlyErrorStack;
                }

                throw error;
            }
        }

        return [totalUpdated, performanceHelper.readResult()];
    }
}
