import {DatastoreOrmOperationError, Transaction} from "..";
import {BaseEntity} from "../BaseEntity";
import {errorCodes} from "../enums/errorCodes";
import {IArgvValues, IRequestResponse} from "../types";
import {timeout} from "../utils";
import {PerformanceHelper} from "./PerformanceHelper";

// not design to work for transaction
export class EntityHelper<T extends typeof BaseEntity> {
    constructor(public readonly entityType: T) {

    }

    public async findOrCreate<R extends BaseEntity>(values: Partial<IArgvValues<InstanceType<T>>>, ancestor?: R):
        Promise<[InstanceType<T>, IRequestResponse]> {
        const id: number | string = (values as any).id;
        if (!id) {
            throw new DatastoreOrmOperationError(`(${this.entityType.constructor.name}) Please provide an id for values. id must be non zero and non empty.`);
        }
        const performanceHelper = new PerformanceHelper().start();

        // we find if entity exist
        const query1 = this.entityType.query();
        if (ancestor) {
            query1.setAncestor(ancestor);
        }
        let [entity] = await query1.filterAny("id", "=", id).runOnce();
        if (!entity) {
            entity = this.entityType.create(values);
            if (ancestor) {
                entity.setAncestor(ancestor);
            }
            
            // try to save and see if any error
            let currentError: Error | undefined;
            try {
                await entity.save();
            } catch (err) {
                currentError = err;
            }

            if (currentError) {
                await timeout(1000);

                // if error is entity exists, we try to load again
                if ((currentError as any).code === errorCodes.ALREADY_EXISTS) {
                    const query2 = this.entityType.query();
                    if (ancestor) {
                        query2.setAncestor(ancestor);
                    }
                    [entity] = await query2.filterAny("id", "=", id).runOnce();
                    if (!entity) {
                        throw new DatastoreOrmOperationError(`(${this.entityType.constructor.name}) We could not find or create the entity.`);
                    }

                } else {
                    throw currentError;
                }
            }
        }

        return [entity as InstanceType<T>, performanceHelper.readResult()];
    }
}
