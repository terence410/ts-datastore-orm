import {decoratorMeta} from "../../decoratorMeta";

// tslint:disable-next-line:variable-name
export  const AfterLoad = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        decoratorMeta.addHookOfAfterLoad(target.constructor, propertyKey);
    };
};
