import {IKey} from "../types";

export const isSameNamespace = (key1: IKey, key2: IKey): boolean => {
    return key1.namespace === key2.namespace;
};

export const isSameKind = (key1: IKey, key2: IKey): boolean => {
    return key1.kind === key2.kind;
};

export const isSamePath = (key1: IKey, key2: IKey): boolean => {
    const path1 = key1.path;
    const path2 = key2.path;

    for (let i = 0; i <　Math.max(path1.length, path2.length); i++) {
        if (path1[i] !== path2[i]) {
            return false;
        }
    }

    return true;
};

export const isSameKey = (key1: IKey, key2: IKey): boolean => {
    return isSameNamespace(key1, key2) && isSameKind(key1, key2) && isSamePath(key1, key2);
};

