import {decoratorMeta} from "../../decoratorMeta";

// tslint:disable-next-line:variable-name
export  const BeforeInsert = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        decoratorMeta.addHookOfBeforeInsert(target.constructor, propertyKey);
    };
};
