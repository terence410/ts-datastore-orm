import "reflect-metadata";
import {datastoreOrm} from "../datastoreOrm";
import {IEntityCompositeIndex} from "../types";

export function CompositeIndex(compositeIndex: IEntityCompositeIndex = {}) {
    return (target: object) => {
        datastoreOrm.addCompositeIndex(target, compositeIndex);
    };
}
