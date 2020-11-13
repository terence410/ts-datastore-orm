export class TsDatastoreOrmError extends Error {
    public name = "TsDatastoreOrmError";

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, TsDatastoreOrmError.prototype);
    }
}
