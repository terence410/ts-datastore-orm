import {BaseEntity} from "../BaseEntity";
import {Query} from "../Query";
import {Transaction} from "../Transaction";
import {IArgvValues, IRequestResponse} from "../types";

export class RelationshipHelper<T extends BaseEntity> {
    constructor(public readonly entity: T, public readonly transaction?: Transaction) {
        //
    }

    public async getOrCreate<R extends typeof BaseEntity>(entityType: R, defaultValues: IArgvValues<InstanceType<R>>):
        Promise<[InstanceType<R>, IRequestResponse]> {
        const result = await this.get(entityType);
        let entity = result[0];
        const queryResponse = result[1];

        if (!entity) {
            entity = entityType.create(defaultValues);
            entity.setAncestor(this.entity);
            const [_, response] = await entity.save();
            queryResponse.executionTime += response.executionTime;
        }

        return [entity, queryResponse];
    }

    public async get<R extends typeof BaseEntity>(entityType: R):
        Promise<[InstanceType<R> | undefined, IRequestResponse]> {
        const query = new Query(entityType);
        const [entity, queryResponse] = await query
            .setAncestor(this.entity)
            .runOnce();

        return [entity, queryResponse];
    }

    public async getMany<R extends typeof BaseEntity>(entityType: R): Promise<[Array<InstanceType<R>>, IRequestResponse]> {
        const query = new Query(entityType);
        const [results, queryResponse] = await query.setAncestor(this.entity).run();
        return [results, queryResponse];
    }
}
