import * as Datastore from "@google-cloud/datastore";
import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import {BaseEntity} from "../BaseEntity";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {updateStack} from "../utils";

interface IAsyncIterator<T> {
    next(value?: any): Promise<IteratorResult<T[]>>;
}

export class SelectKeyQueryAsyncIterator<T extends typeof BaseEntity> {
    public readonly query: Datastore.Query;
    public isClosed: boolean = false;

    constructor(options: { query: Datastore.Query}) {
        this.query = options.query;
    }

    public close() {
        this.isClosed = true;
    }

    public [Symbol.asyncIterator](): IAsyncIterator<DatastoreEntity.entity.Key> {
        return {
            next: async () => {
                const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();
                try {
                    // if we haven't manually paused it
                    if (!this.isClosed) {
                        // try to fetch results
                        const [results, queryInfo] = await this.query.run();

                        // update end cursor for next round
                        if (queryInfo && queryInfo.endCursor) {
                            this.query.start(queryInfo.endCursor);
                        }

                        // if we have results
                        if (results.length) {
                            const keys: DatastoreEntity.entity.Key[] = [];
                            for (const data of results) {
                                const key = data[DatastoreEntity.entity.KEY_SYMBOL] as DatastoreEntity.entity.Key;
                                keys.push(key);
                            }

                            return {value: keys, done: false};

                        } else {
                            this.isClosed = true;
                        }
                    }

                    return {value: undefined as any, done: true};

                } catch (err) {
                    throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
                }
            },
        };
    }
}
