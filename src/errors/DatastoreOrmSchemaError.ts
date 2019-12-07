export class DatastoreOrmSchemaError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DatastoreOrmSchemaError.prototype);
    }
}
