import * as Datastore from "@google-cloud/datastore";
import {BaseEntity} from "../BaseEntity";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {updateStack} from "../utils";

interface IAsyncIterator<T> {
    next(value?: any): Promise<IteratorResult<T[]>>;
}

export class QueryAsyncIterator<T extends typeof BaseEntity> {
    public readonly query: Datastore.Query;
    public readonly classObject: T;
    public isClosed: boolean = false;

    constructor(options: { classObject: T, query: Datastore.Query}) {
        this.query = options.query;
        this.classObject = options.classObject;
    }

    public close() {
        this.isClosed = true;
    }

    public [Symbol.asyncIterator](): IAsyncIterator<InstanceType<T>> {
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
                            const entities: Array<InstanceType<T>> = [];
                            for (const data of results) {
                                const entity = tsDatastoreOrm.createEntity(this.classObject, data);
                                entities.push(entity);
                            }

                            return {value: entities, done: false};

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
