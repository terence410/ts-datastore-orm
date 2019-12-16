import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmDatastoreError extends DatastoreOrmError {
    constructor(message: string, public readonly code: number | undefined, public readonly originalError: Error) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmDatastoreError.prototype);
    }
}
