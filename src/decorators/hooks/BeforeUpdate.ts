import {decoratorMeta} from "../../decoratorMeta";

// tslint:disable-next-line:variable-name
export  const BeforeUpdate = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        decoratorMeta.addHookOfBeforeUpdate(target.constructor, propertyKey);
    };
};
