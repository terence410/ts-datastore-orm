import * as fs from "fs";
import * as path from "path";
import {DatastoreOrmOperationError} from "./errors/DatastoreOrmOperationError";
import {IConfig} from "./types";

class ConfigLoader {
    private _initialized = false;
    private _config: IConfig = {keyFilename: "", friendlyError: false, namespace: ""};

    public getConfig() {
        if (!this._initialized) {
            const file = this._getConfigFile();
            const rawData = fs.readFileSync(file);
            try {
                const config = JSON.parse(rawData.toString()) as IConfig;
                this._config = Object.assign(this._config, config);
                this._initialized = true;
            } catch (err) {
                throw new DatastoreOrmOperationError(`Config file (${file}) is found, but it could not be parsed into json.`);
            }
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
