import "reflect-metadata";
import {datastoreOrm} from "../datastoreOrm";
import {DatastoreOrmDecoratorError} from "../errors/DatastoreOrmDecoratorError";
import {IEntityColumn, IEntityColumnBase} from "../types";

export function Column(entityColumn: Partial<IEntityColumnBase> = {}) {
    return (target: object, propertyKey: string) => {
        const propertyType = Reflect.getMetadata("design:type", target, propertyKey);

        // set default values
        let newEntityColumn: IEntityColumn = {
            generateId: false,
            index: false,
            excludeFromIndexes: [],
            type: propertyType,
        };
        newEntityColumn = Object.assign(newEntityColumn, entityColumn);

        // validate id type
        if (propertyKey === "id") {
            if (propertyType !== Number && propertyType !== String) {
                throw new DatastoreOrmDecoratorError(`(${target.constructor.name}) id must in the type of string or number. Current type is (${propertyType}).`);
            }

            if (newEntityColumn.generateId) {
                if (propertyType !== Number) {
                    throw new DatastoreOrmDecoratorError(`(${target.constructor.name}) generateId must in the type of number. Current type is (${propertyType}).`);
                }
            }
        }

        // everything ok, add the schema
        datastoreOrm.addColumn(target.constructor, propertyKey, newEntityColumn);

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
