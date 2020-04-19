import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmLockHelperError extends DatastoreOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmLockHelperError.prototype);
    }
}
