import {decoratorMeta} from "../../decoratorMeta";

// tslint:disable-next-line:variable-name
export  const BeforeDelete = (): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        decoratorMeta.addHookOfBeforeDelete(target.constructor, propertyKey);
    };
};
