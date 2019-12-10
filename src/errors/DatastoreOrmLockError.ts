import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmLockError extends DatastoreOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmLockError.prototype);
    }
}
