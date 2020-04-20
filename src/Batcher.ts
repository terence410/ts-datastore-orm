import {BaseEntity} from "./BaseEntity";
import {datastoreOrm} from "./datastoreOrm";
import {DatastoreOrmDatastoreError} from "./errors/DatastoreOrmDatastoreError";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {eventEmitters} from "./eventEmitters";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {IRequestResponse, ISaveResult} from "./types";

type IBatcherOptions = {maxBatch: number};

export class Batcher {
    private _options: IBatcherOptions;

    constructor(options: Partial<IBatcherOptions> = {}) {
        this._options = Object.assign({maxBatch: 500}, options);
    }

    public async save(entities: BaseEntity[]): Promise<[number, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();
        // if we have nothing, return
        if (!entities.length) {
            return [0, performanceHelper.readResult()];
        }

        // preparation
        this._validateEntities(entities);
        const entityMeta = datastoreOrm.getEntityMeta(entities[0].constructor);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const insertEntities = entities.filter(x => x.isNew);
        const updateEntities = entities.filter(x => !x.isNew);
        const maxBatch = this._options.maxBatch;

        // check any thing are just read only
        const readyOnlyEntity = entities.find(x => x.isReadOnly);
        if (readyOnlyEntity) {
            throw new DatastoreOrmOperationError(`(${readyOnlyEntity.constructor.name}) Entity is read only. id (${(readyOnlyEntity as any).id}).`);
        }

        // mass insert
        if (insertEntities.length) {
            for (let i = 0; i < entities.length; i += maxBatch) {
                const insertSaveDataList = insertEntities.slice(i, maxBatch).map(x => x.getSaveData());
                // set isNew to false
                insertEntities.forEach(x => x.isNew = false);

                // friendly error
                const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
                try {
                    const [insertResult] = await datastore.insert(insertSaveDataList);

                    // below should be the same as Base Entity
                    for (let j = 0; j < insertSaveDataList.length; j++) {
                        const newKey = insertSaveDataList[j].key;
                        const entity = insertEntities[j];
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
        }

        // mass update
        if (updateEntities.length) {
            for (let i = 0; i < entities.length; i += maxBatch) {
                const updateSaveDataList = updateEntities.slice(i, maxBatch).map(x => x.getSaveData());
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
        }

        // emit events
        insertEntities.forEach(x => eventEmitters.emit("create", x));
        updateEntities.forEach(x => eventEmitters.emit("update", x));

        return [entities.length, performanceHelper.readResult()];
    }

    public async delete(entities: BaseEntity[]): Promise<[number, IRequestResponse]> {
        const performanceHelper = new PerformanceHelper().start();

        // if we have nothing, return
        if (!entities.length) {
            return [0, performanceHelper.readResult()];
        }

        // preparation
        this._validateEntities(entities);
        const entityMeta = datastoreOrm.getEntityMeta(entities[0].constructor);
        const datastore = datastoreOrm.getConnection(entityMeta.connection);
        const maxBatch = this._options.maxBatch;

        // mass delete
        for (let i = 0; i < entities.length; i += maxBatch) {
            // friendly error
            const friendlyErrorStack = datastoreOrm.useFriendlyErrorStack();
            try {
                const [result] = await datastore.delete(entities.slice(i, maxBatch).map(x => x.getKey()));

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
        }

        return [entities.length, performanceHelper.readResult()];
    }

    // we make sure entities are all of the same type
    private _validateEntities(entities: BaseEntity[]) {
        const set = new Set(entities.map(x => x.constructor));
        if (set.size > 1) {
            throw new DatastoreOrmOperationError(`You can only use Batcher for same type of entities only.`);
        }
    }
}
