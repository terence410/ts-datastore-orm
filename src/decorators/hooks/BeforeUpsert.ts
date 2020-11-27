import {decoratorMeta} from "../../decoratorMeta";

// tslint:disable-next-line:variable-name
export  const BeforeUpsert = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        decoratorMeta.addHookOfBeforeUpsert(target.constructor, propertyKey);
    };
};
