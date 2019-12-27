import * as fs from "fs";
import * as path from "path";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {IConfig} from "./types";
import {readJsonFile} from "./utils";

class ConfigLoader {
    private _initialized = false;
    private _config: IConfig = {keyFilename: "", friendlyError: false, namespace: ""};

    public getConfig() {
        if (!this._initialized) {
            const filename = this._getConfigFile();
            let config!: IConfig;
            try {
                config = readJsonFile(filename) as IConfig;
            } catch (err) {
                throw new DatastoreOrmOperationError(`Datastrom Orm config (${filename}) is not found or it could not be parsed into json.`);
            }

            // read the key file and see any problem
            try {
                const keyFile = readJsonFile(config.keyFilename);
            } catch (err) {
                throw new DatastoreOrmOperationError(`KeyFilename (${config.keyFilename}) in config (${filename}) is not found or it could not be parsed into json.`);
            }

            this._config = Object.assign(this._config, config);
            this._initialized = true;
        }

        return this._config;
    }

    /** @internal */
    private _getConfigFile(): string {
        let configFiles = [`datastoreorm.default.json`];

        if (process.env.NODE_ENV) {
            const name = process.env.NODE_ENV || "default";
            configFiles.splice(0, 0, `datastoreorm.${name}.json`);
        }

        if (process.env.DATASTOREORM_CONFIG_PATH) {
            configFiles = [process.env.DATASTOREORM_CONFIG_PATH];
        }

        for (const configFile of configFiles) {
            try {
                const result = fs.accessSync(configFile, fs.constants.F_OK);
                return path.isAbsolute(configFile) ? configFile : path.join(process.cwd(), configFile);
            } catch (err) {
                //
            }
        }

        throw new DatastoreOrmOperationError(`Config file cannot not be found on the paths: ${configFiles.join(", ")}.`);
    }
}

export const configLoader = new ConfigLoader();
