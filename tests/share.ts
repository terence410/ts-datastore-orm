import {assert} from "chai";
import {Connection} from "../src/Connection";
import {createConnection} from "../src/createConnection";
import {TsDatastoreOrmError} from "../src/errors/TsDatastoreOrmError";

export let connection!: Connection;
export const beforeCallback = async () => {
    if (!connection) {
        connection = await createConnection({
            keyFilename: "./datastoreServiceAccount.json",
        });
    }
};

export async function assertAsyncError(callback: () => void, options: {message: RegExp, errorType?: any}) {
    const stack = new Error().stack;

    let error: Error | undefined;
    try {
        await callback();
    } catch (err) {
        error = err;
    }

    if (error === undefined) {
        const newError = new Error(`No error found. Expect to have an error with message: ${options.message}`);
        newError.stack = stack;
        throw newError;
    }

    if (options.errorType) {
        if (!(error instanceof options.errorType)) {
            const newError = new Error(`Expect to have an error with type ${options.errorType.name}`);
            newError.stack = stack;
            throw newError;
        }
    }

    assert.match(error.message, options.message);

    return error;
}

export async function assertTsDatastoreOrmError(callback: () => void, options: {message: RegExp}) {
    return assertAsyncError(callback, {message: options.message, errorType: TsDatastoreOrmError});
}
