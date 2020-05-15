import {BaseEntity} from "../BaseEntity";
import {datastoreOrm} from "../datastoreOrm";
import {DatastoreOrmDecoratorError} from "../errors/DatastoreOrmDecoratorError";
import {IEntityMeta, IEntityMetaBase} from "../types";

export function Entity(entityMeta: Partial<IEntityMetaBase> = {}) {
    return (target: object) => {
        // set default values
        let newEntityMeta: IEntityMeta = {
            connection: "default",
            namespace: entityMeta.namespace || "",
            kind: (target as any).name,
            ancestor: null,
            excludeFromIndexes: [],
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);

        // check if has existing kind
        const existEntityType = datastoreOrm.getEntityByKind(newEntityMeta.connection, newEntityMeta.kind);
        if (existEntityType) {
            throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity with kind (${newEntityMeta.kind}) is already used by another Entity (${(existEntityType as any).name}).`);
        }

        // check ancestor are having the same connection
        if (newEntityMeta.ancestor) {
            const ancestorEntityMeta = datastoreOrm.getEntityMeta(newEntityMeta.ancestor);
            if (ancestorEntityMeta.connection !== newEntityMeta.connection) {
                throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity's connection "${newEntityMeta.connection}" is different with ancestor's connection: "${ancestorEntityMeta.connection}".`);
            }
        }

        // it has a subclass, add all it's column
        let subClassTarget = Object.getPrototypeOf(target);
        while (true) {
            // no more sub class
            if (!(subClassTarget instanceof Function)) {
                break;
            }

            if (subClassTarget !== BaseEntity) {
                const subClassEntityMeta = datastoreOrm.getEntityMeta(subClassTarget);
                if (subClassEntityMeta) {
                    throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity is subclassing (${subClassTarget.name}) which is already defined as an Entity.`);
                }

                const subClassColumns = datastoreOrm.getEntityColumns(subClassTarget);
                for (const [column, entityColumn] of Object.entries(subClassColumns)) {
                    datastoreOrm.addColumn(target, column, entityColumn);
                }
            }

            // continue to find sub class
            subClassTarget = Object.getPrototypeOf(subClassTarget);
        }

        // get existing entity columns
        const entityColumns = datastoreOrm.getEntityColumns(target);

        // check if we have a id column
        const idColumn = Object.keys(entityColumns).find(x => x === "id");
        if (!idColumn) {
            throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity must define an id column.`);
        }

        if (!newEntityMeta.kind) {
            throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity must define a kind.`);
        }

        // create exclude from indexes
        const excludeFromIndexes: string[] = [];
        for (const [column, entityColumn] of Object.entries(entityColumns)) {
            if (!entityColumn.index) {
                // we don't have to exclude id, it's always indexed in ASC
                if (column !== "id") {
                    excludeFromIndexes.push(column);
                }

            } else if (entityColumn.excludeFromIndexes.length) {
                for (const subColumn of entityColumn.excludeFromIndexes ) {
                    excludeFromIndexes.push(`${subColumn}`);
                }
            }
        }

        // update the meta
        newEntityMeta.excludeFromIndexes = excludeFromIndexes;
        datastoreOrm.addEntity(target, newEntityMeta);
    };
}
