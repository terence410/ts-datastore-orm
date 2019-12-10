import {BaseEntity} from "../BaseEntity";
import {datastoreOrm} from "../datastoreOrm";
import {DatastoreOrmDecoratorError} from "../errors/DatastoreOrmDecoratorError";
import {IEntityMeta, IEntityMetaBase} from "../types";

export function Entity(entityMeta: Partial<IEntityMetaBase> = {}) {
    return (target: object) => {
        // set default values
        let newEntityMeta: IEntityMeta = {
            namespace: "",
            kind: "",
            ancestors: [],
            excludeFromIndexes: [],
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);

        // it has a subclass, add all it's column
        const subClassTarget = Object.getPrototypeOf(target);
        if (subClassTarget !== BaseEntity) {
            const subClassEntityMeta = datastoreOrm.getEntityMeta(subClassTarget);
            if (subClassEntityMeta) {
                throw new DatastoreOrmDecoratorError(`(${(target as any).name}) This entity is subclassing (${subClassTarget.name}) which already defined as an Entity.`);
            }

            const subClassColumns = datastoreOrm.getEntityColumns(subClassTarget);
            for (const [column, entityColumn] of Object.entries(subClassColumns)) {
                datastoreOrm.addColumn(target, column, entityColumn);
            }
        }

        // get existing entity columns
        const entityColumns = datastoreOrm.getEntityColumns(target);

        // check if we have a id column
        const idColumn = Object.keys(entityColumns).find(x => x === "id");
        if (!idColumn) {
            throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity must define an id column.`);
        }

        if (!newEntityMeta.kind) {
            throw new DatastoreOrmDecoratorError(`(${(target as any).name}) Entity must specific a kind.`);
        }

        // create exclude from indexes
        const excludeFromIndexes: string[] = [];
        for (const [column, entityColumn] of Object.entries(entityColumns)) {
            if (!entityColumn.index) {
                excludeFromIndexes.push(column);

            } else if (entityColumn.excludeFromIndexes.length) {
                for (const subColumn of entityColumn.excludeFromIndexes ) {
                    excludeFromIndexes.push(`${subColumn}`);
                }
            }
        }

        // update the meta
        newEntityMeta.excludeFromIndexes = excludeFromIndexes;
        newEntityMeta.ancestors = Array.isArray(entityMeta.ancestors) ? entityMeta.ancestors :
            (entityMeta.ancestors ? [entityMeta.ancestors] : []);
        datastoreOrm.addEntity(target, newEntityMeta);
    };
}
