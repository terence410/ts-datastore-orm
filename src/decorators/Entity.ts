import {datastoreOrm} from "../datastoreOrm";
import {DatastoreOrmEntityError} from "../errors/DatastoreOrmEntityError";
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

        const entityColumns = datastoreOrm.getEntityColumns(target);

        // check if we have a id column
        const idColumn = Object.keys(entityColumns).find(x => x === "id");
        if (!idColumn) {
            throw new DatastoreOrmEntityError(`(${(target as any).name}) Entity must consist an id column.`);
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
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);
        newEntityMeta.excludeFromIndexes = excludeFromIndexes;
        newEntityMeta.ancestors = Array.isArray(entityMeta.ancestors) ? entityMeta.ancestors :
            (entityMeta.ancestors ? [entityMeta.ancestors] : []);
        datastoreOrm.addEntity(target, newEntityMeta);
    };
}
