import "reflect-metadata";
import {datastoreOrm} from "../datastoreOrm";
import {DatastoreOrmSchemaError} from "../errors/DatastoreOrmSchemaError";
import {IEntityColumn, IEntityColumnBase} from "../types";

export function Column(schema: Partial<IEntityColumnBase> = {}) {
    return (target: object, propertyKey: string) => {
        const propertyType = Reflect.getMetadata("design:type", target, propertyKey);

        // set default values
        let newSchema: IEntityColumn = {
            generateId: false,
            index: false,
            excludeFromIndexes: [],
            type: propertyType,
        };
        newSchema = Object.assign(newSchema, schema);

        // validate id type
        if (propertyKey === "id") {
            if (propertyType !== Number && propertyType !== String) {
                throw new DatastoreOrmSchemaError(`(${target.constructor.name}) id must in the type of string or number.`);
            }
        }

        // everything ok, add the schema
        datastoreOrm.addColumn(target.constructor, propertyKey, newSchema);

        // define getter / setter
        if (!Object.getOwnPropertyDescriptor(target.constructor.prototype, propertyKey)) {
            Object.defineProperty(target.constructor.prototype, propertyKey, {
                get() {
                    return this._get(propertyKey);
                },
                set(value) {
                    return this._set(propertyKey, value);
                },
            });
        }
    };
}
