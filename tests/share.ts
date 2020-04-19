import {datastoreOrm} from "../src";

let hasInit = false;

export const beforeCallback = () => {
    if (!hasInit) {
        datastoreOrm.friendlyError = true;
        datastoreOrm.addConnection("default", {keyFilename: "./datastoreServiceAccount.json"});
        hasInit = true;
    }
};
