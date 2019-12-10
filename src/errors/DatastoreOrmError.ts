export class DatastoreOrmError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmError.prototype);
    }
}
