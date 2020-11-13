import * as Datastore from "@google-cloud/datastore";
import {errorCodes} from "../enums/errorCodes";
import {tsDatastoreOrm} from "../tsDatastoreOrm";
import {ITransactionManagerParams} from "../types";
import {timeout, updateStack} from "../utils";
import {Session} from "./Session";

type ITransactionResult<T> = {value: T, hasCommitted: boolean, totalRetry: number};
export class TransactionManager {
    public readonly datastore: Datastore.Datastore;
    public readonly maxRetry: number;
    public readonly retryDelay: number;
    public readonly readOnly: boolean;

    constructor(options: ITransactionManagerParams) {
        this.datastore = options.datastore;
        this.maxRetry = options.maxRetry;
        this.retryDelay = options.retryDelay;
        this.readOnly = options.readOnly;
    }

    public async start<T extends any>(callback: (session: Session) => Promise<T>): Promise<ITransactionResult<T>> {
        let retry = 0;
        let value: any;
        let totalRetry = 0;
        let hasCommitted = false;

        const friendlyErrorStack = tsDatastoreOrm.getFriendlyErrorStack();

        do {
            // start transaction
            const transaction = this.datastore.transaction({readOnly: this.readOnly});
            const session = new Session({transaction});

            try {
                // start transaction
                await session.run();

                // execute callback
                value = await callback(session);

                // commit
                await session.commit();

                // provided by datastore
                hasCommitted = !(session.transaction.skipCommit);

                // break the retry loop
                break;

            } catch (err) {
                // if we don't rollback, it will be faster
                hasCommitted = false;

                // rollback for any type of error
                try {
                    await session.rollback();
                } catch (err) {
                    // ignore rollback error here
                }

                // retry transaction only if aborted
                if (err.code === errorCodes.ABORTED) {
                    if (retry < this.maxRetry) {
                        totalRetry = retry;

                        // wait for a while
                        if (this.retryDelay) {
                            await timeout(this.retryDelay);
                        }

                        // this will skip throwing error
                        continue;
                    }
                }

                throw Object.assign(err, friendlyErrorStack && {stack: updateStack(friendlyErrorStack, err)});
            }
        } while (retry++ < this.maxRetry);

        return {value, hasCommitted, totalRetry};
    }
}
