import * as Datastore from "@google-cloud/datastore";
import {BaseEntity} from "../BaseEntity";
import {MAX_ENTITIES} from "../constants";
import {decoratorMeta} from "../decoratorMeta";
import {TsDatastoreOrmError} from "../errors/TsDatastoreOrmError";
import {Query} from "../queries/Query";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {IFieldName, IFieldNames, IIndexResaveHelperParams} from "../types";
import {updateStack} from "../utils";

export class IndexResaveHelper<T extends typeof BaseEntity> {
    private datastore: Datastore.Datastore;
    private classObject: T;
    private namespace: string | undefined;
    private kind: string;

    constructor(options: IIndexResaveHelperParams<T>) {
        this.datastore = options.datastore;
        this.classObject = options.classObject;
        this.namespace = options.namespace;
        this.kind = options.kind;
    }

    public async resave(fieldNames: IFieldName<InstanceType<T>> | IFieldNames<InstanceType<T>>): Promise<number> {
        const entityFieldMetaList = decoratorMeta.getEntityFieldMetaList(this.classObject);
        fieldNames = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

        for (const fieldName of fieldNames) {
            const entityFieldMea = entityFieldMetaList.get(fieldName as string);
            if (!entityFieldMea || !entityFieldMea.index) {
                throw new TsDatastoreOrmError(`(IndexResaveHelper) Field "${fieldName}" is not set as index.`);
            }
        }

        const batch = 500;

        const datastoreQuery = this.datastore.createQuery();
        datastoreQuery.namespace = this.namespace;
        datastoreQuery.kinds = [this.kind];

        const query = new Query({
            datastore: this.datastore,
            classObject: this.classObject,
            namespace: this.namespace,
            kind: this.kind,
            query: datastoreQuery,
        });
        query.limit(MAX_ENTITIES);

        // we do batch delete to optimize performance
        let totalUpdated = 0;

        for await (const entities of query.getAsyncIterator()) {
            const updateDataList = [];

            // query
            totalUpdated += entities.length;

            // prepare update data
            for (const entity of entities) {
                const data = fieldNames.reduce((a, b) => Object.assign(a, {[b]: (entity as any)[b]}), {});
                updateDataList.push({
                    key: entity.getKey(),
                    data,
                });
            }

            // update the only selected columns
            const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
            try {
                const [mergeResult] = await this.datastore.merge(updateDataList);
            } catch (err) {
                throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
            }
        }

        return totalUpdated;
    }
}
