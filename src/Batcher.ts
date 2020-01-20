import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmDatastoreError} from "./errors/DatastoreOrmDatastoreError";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {eventEmitters} from "./eventEmitters";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {IRequestResponse, ISaveResult} from "./types";

export class Batcher {
    constructor() {
        //
    }

    public async save(entities: BaseEntity[]): Promise<[number, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        const datastore = datastoreOrm.getDatastore();
        const insertEntities = entities.filter(x => x.isNew);
        const updateEntities = entities.filter(x => !x.isNew);

        // check any thing are just read only
        const readyOnlyEntity = entities.find(x => x.isReadOnly);
        if (readyOnlyEntity) {
            throw new DatastoreOrmOperationError(`(${readyOnlyEntity.constructor.name}) Entity is read only. id (${(readyOnlyEntity as any).id}).`);
        }

        // insert
        if (insertEntities.length) {
            // set isNew to false
            const insertSaveDataList = insertEntities.map(x => x.getSaveData());
            insertEntities.forEach(x => x.isNew = false);

            // friendly error
            const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
            try {
                const [insertResult] = await datastore.insert(insertSaveDataList);

                // below should be the same as Base Entity
                for (let i = 0; i < insertSaveDataList.length; i++) {
                    const newKey = insertSaveDataList[i].key;
                    const entity = insertEntities[i];
                    // if we have no ide
                    if (!(entity as any)._id) {
                        (entity as any)._set("id", Number(newKey.id));
                    }
                }

            } catch (err) {
                const error = new DatastoreOrmDatastoreError(`Batcher Save Error for insert. Error: ${err.message}.`,
                    err.code,
                    err);
                if (friendlyErrorStack) {
                    error.stack = friendlyErrorStack;
                }

                throw error;
            }
        }

        // update
        if (updateEntities.length) {
            const updateSaveDataList = updateEntities.map(x => x.getSaveData());
            updateEntities.forEach(x => x.isNew = false);

            // friendly error
            const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
            try {
                const [updateResult] = await datastore.update(updateSaveDataList);

            } catch (err) {
                const error = new DatastoreOrmDatastoreError(`Batcher Save Error for update. Error: ${err.message}.`,
                    err.code,
                    err);
                if (friendlyErrorStack) {
                    error.stack = friendlyErrorStack;
                }

                throw error;
            }
        }

        // emit events
        insertEntities.forEach(x => eventEmitters.emit("create", x));
        updateEntities.forEach(x => eventEmitters.emit("update", x));

        return [entities.length, performanceHelper.readResult()];
    }

    public async delete(entities: BaseEntity[]): Promise<[number, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // mass delete
        const datastore = datastoreOrm.getDatastore();

        // friendly error
        const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
        try {
            const [result] = await datastore.delete(entities.map(x => x.getKey()));

            // emit events
            entities.forEach(x => eventEmitters.emit("delete", x));

        } catch (err) {
            const error = new DatastoreOrmDatastoreError(`Batcher Delete Error. Error: ${err.message}.`,
                err.code,
                err);
            if (friendlyErrorStack) {
                error.stack = friendlyErrorStack;
            }

            throw error;
        }

        return [entities.length, performanceHelper.readResult()];
    }
}
