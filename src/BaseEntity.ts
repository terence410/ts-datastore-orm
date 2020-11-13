import * as DatastoreEntity from "@google-cloud/datastore/build/src/entity";
import {decoratorMeta} from "./decoratorMeta";
import {IEntityMetaOptions} from "./types";

export class BaseEntity {
    public _id: any;

    public _namespace: string | undefined;

    public _kind: string;

    public _ancestorKey?: DatastoreEntity.entity.Key;

    constructor() {
        const entityMeta = decoratorMeta.entityMetaMap.get(this.constructor) as IEntityMetaOptions;

        // we need to pre-fill the followings
        this._kind = entityMeta.kind;
        this._namespace = entityMeta.namespace;

        Object.defineProperty(this, "_kind", {
            value: entityMeta.kind,
            enumerable: entityMeta.enumerable,
            writable: true,
            configurable: true,
        });

        Object.defineProperty(this, "_namespace", {
            value: entityMeta.namespace,
            enumerable: entityMeta.enumerable,
            writable: true,
            configurable: true,
        });

        Object.defineProperty(this, "_ancestorKey", {
            value: undefined,
            enumerable: entityMeta.enumerable,
            writable: true,
            configurable: true,
        });
    }

    public getKey(): DatastoreEntity.entity.Key {
        const key = new DatastoreEntity.entity.Key({namespace: this._namespace, path: [this._kind]});

        if (typeof this._id === "number") {
            key.id = this._id.toString();
        } else if (typeof this._id === "string") {
            key.name = this._id;
        }

        if (this._ancestorKey) {
            key.parent = this._ancestorKey;
        }

        return key;
    }
}
