function mergeObjectStrictRecursive(value: any, newValue: any) {
    for (const key of Object.keys(value)) {
        if (typeof value[key] === "object" && typeof newValue[key] === "object") {
            mergeObjectStrictRecursive(value[key], newValue[key]);
        } else if (key in newValue) {
            value[key] = newValue[key];
        }
    }
}

function mergeObjectRecursive(value: any, newValue: any) {
    const keys = Array.from(new Set([...Object.keys(value), ...Object.keys(newValue)]));
    for (const key of keys) {
        if (typeof value[key] === "object" && typeof newValue[key] === "object") {
            mergeObjectRecursive(value[key], newValue[key]);
        } else if (key in newValue) {
            value[key] = newValue[key];
        }
    }
}

function mergeObjectStrict(newValue: any, oldValue: any) {
    if (typeof oldValue === "object" && typeof newValue === "object") {
        mergeObjectStrictRecursive(oldValue, newValue);
        return oldValue;

    } else if (typeof oldValue === "object") {
        return oldValue;
    }

    return newValue;
}

function mergeObject(newValue: any, oldValue: any) {
    if (typeof oldValue === "object" && typeof newValue === "object") {
        mergeObjectRecursive(oldValue, newValue);
        return oldValue;

    } else if (typeof oldValue === "object") {
        return oldValue;
    }

    return newValue;
}

export const casts = {
    mergeObject,
    mergeObjectStrict,
};
