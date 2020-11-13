import * as Datastore from "@google-cloud/datastore";
import {BaseEntity} from "../BaseEntity";
import {TsDatastoreOrmError} from "../errors/TsDatastoreOrmError";
import {TransactionManager} from "../transactions/TransactionManager";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {
    IEntityKeyType,
    IFieldName, IIncrementHelperParams,
} from "../types";

export class IncrementHelper<T extends typeof BaseEntity> {
    private datastore: Datastore.Datastore;
    private classObject: T;
    private namespace: string | undefined;
    private kind: string;
    private maxRetry: number;
    private retryDelay: number;

    constructor(options: IIncrementHelperParams<T>) {
        this.datastore = options.datastore;
        this.classObject = options.classObject;
        this.namespace = options.namespace;
        this.kind = options.kind;
        this.maxRetry = options.maxRetry;
        this.retryDelay = options.retryDelay;
    }

    public async increment(id: IEntityKeyType<T>, fieldName: IFieldName<InstanceType<T>>, increment: number = 1): Promise<number> {
        const key = tsDatastoreOrm.normalizeAndValidateKey(id, this.namespace, this.kind);

        const transactionManager = new TransactionManager({
            datastore: this.datastore,
            maxRetry: this.maxRetry,
            retryDelay: this.retryDelay,
            readOnly: false,
        });

        const result = await transactionManager.start(async session => {
            const [data] = await session.transaction.get(key);

            if (!data) {
                throw new TsDatastoreOrmError("(IncrementHelper) Entity not exist.");
            }

            if (data[fieldName] !== undefined && typeof data[fieldName] !== "number") {
                throw new TsDatastoreOrmError("(IncrementHelper) Current Entity field is not a number.");
            }

            // update back to the entity
            const oldValue: number = data[fieldName] || 0;
            const newValue = oldValue + 1;
            data[fieldName] = newValue;
            const updateData = {
                key,
                data,
            };

            // update
            session.transaction.update(updateData);

            return newValue;
        });

        return result.value;
    }
}
