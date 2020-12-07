import {BaseEntity} from "../BaseEntity";
import {decoratorMeta} from "../decoratorMeta";
import {TsDatastoreOrmError} from "../errors/TsDatastoreOrmError";
import {IEntityMetaOptions} from "../types";

export function Entity(options: Partial<IEntityMetaOptions> = {}) {
    return (target: any) => {

        // we search the subclass decorators as well
        let subClassTarget = Object.getPrototypeOf(target);
        while (true) {
            // no more sub class
            if (!(subClassTarget instanceof Function)) {
                break;
            }

            if (subClassTarget !== BaseEntity) {
                // copy the fields from subclass
                if (decoratorMeta.hasEntityFieldMetaList(subClassTarget)) {
                    const subClassEntityFieldMeta = decoratorMeta.getEntityFieldMetaList(subClassTarget);
                    for (const [fieldName, entityFieldMetaOptions] of subClassEntityFieldMeta.entries()) {
                        if (!decoratorMeta.hasEntityFieldMeta(target, fieldName)) {
                            decoratorMeta.addEntityFieldMeta(target, fieldName, entityFieldMetaOptions);
                        }
                    }
                }

                // copy the hooks from subclass
                decoratorMeta.mergeHooks(target, subClassTarget);
            }

            // continue to find sub class
            subClassTarget = Object.getPrototypeOf(subClassTarget);
        }

        // check if has id
        if (!decoratorMeta.hasEntityFieldMetaList(target)) {
            throw new TsDatastoreOrmError(`(${(target as any).name}) Entity must define an _id field with property decorator @Field().`);
        }

        const entityFieldMeta = decoratorMeta.getEntityFieldMetaList(target);
        const fieldNames = Array.from(entityFieldMeta.keys());

        // check if we have a id column
        if (!fieldNames.includes("_id")) {
            throw new TsDatastoreOrmError(`(${(target as any).name}) Entity must define an _id field with property decorator @Field().`);
        }

        // create exclude from indexes
        const excludeFromIndexes: string[] = [];
        for (const [fieldName, entityFieldMetaOptions] of entityFieldMeta.entries()) {
            if (!entityFieldMetaOptions.index) {
                // we don't have to exclude id, it's always indexed in ASC
                if (fieldName !== "_id") {
                    excludeFromIndexes.push(fieldName);
                }

            } else if (entityFieldMetaOptions.excludeFromIndexes.length) {
                for (const subColumn of entityFieldMetaOptions.excludeFromIndexes ) {
                    excludeFromIndexes.push(`${subColumn}`);
                }
            }
        }

        // add entity meta
        decoratorMeta.addEntityMeta(target, {
            kind: options.kind || target.name,
            namespace: options.namespace === "" ? undefined : options.namespace,
            excludeFromIndexes,
            enumerable: options.enumerable || false,
        });
    };
}
