import {DatastoreOrmOperationError} from "..";
import {BaseEntity} from "../BaseEntity";
import {Transaction} from "../Transaction";
import {IArgvColumn, ITransactionExecuteOptions, ITransactionResponse} from "../types";

export class IncrementHelper<R extends typeof BaseEntity, T extends InstanceType<R>> {
    constructor(public readonly entity: T) {

    }

    public async increment(column: IArgvColumn<T>, increment: number = 1, options: Partial<ITransactionExecuteOptions> = {}):
        Promise<[number, ITransactionResponse]> {
        const [resultValue, transactionResponse] = await Transaction.execute(async transaction => {
            const [currentEntity, response] = await transaction
                .query(this.entity.constructor as any)
                .filter("__key__", "=", this.entity.getKey())
                .runOnce();

            if (currentEntity) {
                const newValue = (currentEntity as any)[column] + 1 as number;
                (currentEntity as any)[column] = newValue;
                transaction.save(currentEntity);

                return newValue;
            } else {
                await transaction.rollback();
            }
        }, options);

        if (transactionResponse.hasCommitted) {
            (this.entity as any)[column] = resultValue as number;
            return [resultValue as number, transactionResponse];
        } else {
            throw new DatastoreOrmOperationError(`(IncrementHelper, ${this.entity.constructor.name}) Fail to increment the value on column ${column}.`);

        }
    }
}
