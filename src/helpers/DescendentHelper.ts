import {BaseEntity} from "../BaseEntity";
import {Query} from "../Query";
import {Transaction} from "../Transaction";
import {IRequestResponse} from "../types";

export class DescendentHelper<T extends BaseEntity> {
    constructor(public readonly entity: T, public readonly transaction?: Transaction) {
        //
    }

    public async findOne<R extends typeof BaseEntity>(entityType: R):
        Promise<[InstanceType<R> | undefined, IRequestResponse]> {

        let query!: Query<R>;
        if (this.transaction) {
            query = this.transaction.query(entityType);
        } else {
            query = new Query(entityType);
        }

        const [entity, requestResponse] = await query
            .setAncestor(this.entity)
            .runOnce();
        return [entity, requestResponse];
    }

    public async findMany<R extends typeof BaseEntity>(entityType: R): Promise<[Array<InstanceType<R>>, IRequestResponse]> {
        let query!: Query<R>;
        if (this.transaction) {
            query = this.transaction.query(entityType);
        } else {
            query = new Query(entityType);
        }

        const [results, requestResponse] = await query.setAncestor(this.entity).run();
        return [results, requestResponse];
    }
}
