import * as fs from "fs";
import * as path from "path";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {IConfig} from "./types";
import {readJsonFile} from "./utils";

class ConfigLoader {
    private _initialized = false;
    private _config: IConfig = {keyFilename: "", friendlyError: false, namespace: "", projectId: "", clientEmail: "", privateKey: ""};

    public getConfig() {
        if (!this._initialized) {
            const filename = this._getConfigFile();
            let config!: IConfig;
            try {
                config = readJsonFile(filename) as IConfig;
            } catch (err) {
                throw new DatastoreOrmOperationError(`Datastrom Orm config (${filename}) is not found or it could not be parsed into json.`);
            }

            // update the config
            this._config = Object.assign(this._config, config);

            // if we credientials from testing variable
            if (process.env.testingProjectId && process.env.testingClientEmail && process.env.testingPrivateKey) {
                this._config.projectId = process.env.testingProjectId;
                this._config.clientEmail = process.env.testingClientEmail;
                this._config.privateKey = process.env.testingPrivateKey;
            } else {
                // read the key file and see any problem
                try {
                    const keyFile = readJsonFile(config.keyFilename);
                    this._config.projectId = keyFile.project_id;
                    this._config.clientEmail = keyFile.client_email;
                    this._config.privateKey = keyFile.private_key;

                } catch (err) {
                    throw new DatastoreOrmOperationError(`KeyFilename (${config.keyFilename}) in config (${filename}) is not found or it could not be parsed into json.`);
                }
            }

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
