import {DatastoreOrmError} from "./DatastoreOrmError";

export class DatastoreOrmDecoratorError extends DatastoreOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmDecoratorError.prototype);
    }
}
