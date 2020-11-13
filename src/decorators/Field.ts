import {decoratorMeta} from "../decoratorMeta";
import {IEntityFieldMetaOptions} from "../types";

export function Field(options: Partial<IEntityFieldMetaOptions>  = {}) {
    return (target: object, fieldName: string) => {
        decoratorMeta.addEntityFieldMeta(target.constructor, fieldName, {
            generateId: false,
            index: false,
            excludeFromIndexes: [],
            ...options,
        });
    };
}
