import * as Datastore from "@google-cloud/datastore";
import {Connection} from "./Connection";
import {IConnectionOptions} from "./types";

export async function createConnection(options: IConnectionOptions) {
    let datastore: Datastore.Datastore;
    const {keyFilename, clientEmail, privateKey} = options as any;

    if (keyFilename) {
        datastore = new Datastore.Datastore({keyFilename});
        return new Connection({datastore});
    } else {
        datastore = new Datastore.Datastore({credentials: {client_email: clientEmail, private_key: privateKey}});
        return new Connection({datastore});
    }
}
