import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {IRequestResponse, ISaveResult} from "./types";

export class Batcher {
    constructor() {
        //
    }

    public async saveMany<T extends BaseEntity>(entities: T[]): Promise<[IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const datastore = datastoreOrm.getDatastore();
        const insertEntities = entities.filter(x => x.isNew);
        const updateEntities = entities.filter(x => !x.isNew);

        // check any thing are just read only
        const readyOnlyEntity = entities.find(x => x.isReadOnly);
        if (readyOnlyEntity) {
            throw new DatastoreOrmOperationError(`(${readyOnlyEntity.constructor.name}) This entity is read only. id (${(readyOnlyEntity as any).id}).`);
        }

        // insert
        if (insertEntities.length) {
            // set isNew to false
            const insertSaveDataList = insertEntities.map(x => x.getSaveData());
            insertEntities.forEach(x => x.isNew = false);
            const [insertResult] = await datastore.insert(insertSaveDataList);

            // below should be the same as Base Entity
            const newKeys = datastoreOrm.extractMutationKeys(insertResult as ISaveResult);
            for (let i = 0; i < newKeys.length; i++) {
                const newKey = newKeys[i];
                const entity = insertEntities[i];
                if (!(entity as any)._id) {
                    (entity as any)._set("id", Number(newKey.id));
                }
            }
        }

        // update
        if (updateEntities.length) {
            const updateSaveDataList = updateEntities.map(x => x.getSaveData());
            const [updateResult] = await datastore.update(updateSaveDataList);
        }

        return [performanceHelper.readResult()];
    }

    public async deleteMany<T extends BaseEntity>(entities: T[]): Promise<[IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // mass delete
        const datastore = datastoreOrm.getDatastore();
        await datastore.delete(entities.map(x => x.getKey()));

        return [performanceHelper.readResult()];
    }
}
