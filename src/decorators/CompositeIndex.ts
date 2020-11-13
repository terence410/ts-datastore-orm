import {decoratorMeta} from "../decoratorMeta";
import {IEntityFieldIndex} from "../types";

export function CompositeIndex(fields: IEntityFieldIndex = {}, hasAncestor: boolean = false) {
    return (target: object) => {
        decoratorMeta.addEntityCompositeIndex(target, fields, hasAncestor);
    };
}
