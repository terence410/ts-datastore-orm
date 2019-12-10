import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmDatastoreError extends DatastoreOrmError {
    constructor(message: string, public readonly code: number = 0) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmDatastoreError.prototype);
    }
}
