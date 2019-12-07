export class DatastoreOrmEntityError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmEntityError.prototype);
    }
}
