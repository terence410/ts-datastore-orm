import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmOperationError extends DatastoreOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmOperationError.prototype);
    }
}
