import * as fs from "fs";
import * as path from "path";
import {IConfig} from "./types";

class ConfigLoader {
    private _config!: IConfig;

    public getConfigFile(): string {
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

        throw Error(`Config file cannot not be found on the paths: ${configFiles.join(", ")}.`);
    }

    public getConfig() {
        if (!this._config) {
            const rawData = fs.readFileSync(this.getConfigFile());
            this._config = JSON.parse(rawData.toString()) as IConfig;
        }

        return this._config;
    }
}

export const configLoader = new ConfigLoader();
