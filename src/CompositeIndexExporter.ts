import fs from "fs";
import {BaseEntity} from "./BaseEntity";
import {decoratorMeta} from "./decoratorMeta";

type IEntity = {
    classObject: typeof BaseEntity,
    kind?: string,
};

export class CompositeIndexExporter {
    public entities: IEntity[] = [];

    public addEntity(classObjects: typeof BaseEntity, options?: {kind: string}): void;
    public addEntity(classObjects: Array<typeof  BaseEntity>): void;
    public addEntity(classObjects: typeof BaseEntity | Array<typeof  BaseEntity>, options?: {kind: string}) {
        for (const classObject of Array.isArray(classObjects) ? classObjects: [classObjects]) {
            this.entities.push({
                classObject,
                kind: options?.kind,
            });
        }
    }

    public getYaml() {
        let yaml = "indexes:\n";

        for (const entity of this.entities) {
            const entityMeta = decoratorMeta.getEntityMeta(entity.classObject);
            const compositeIndexList = decoratorMeta.getEntityCompositeIndexList(entity.classObject);
            const kind = entity.kind || entityMeta.kind;

            for (const compositeIndex of compositeIndexList) {
                yaml += "\n";
                yaml += `  - kind: ${kind}\n`;
                if (compositeIndex.hasAncestor) {
                    yaml += `    ancestor: yes\n`;
                } else {
                    yaml += `    ancestor: no\n`;
                }

                yaml += `    properties:\n`;
                for (let [fieldName, direction] of Object.entries(compositeIndex.fields)) {
                    if (fieldName === "_id") {
                        fieldName = "__key__";
                    }

                    yaml += `    - name: ${fieldName}\n`;
                    yaml += `      direction: ${direction}\n`;
                }
            }
        }

        return yaml;
    }

    public exportTo(filename: string) {
        const yaml = this.getYaml();
        fs.writeFileSync(filename, yaml);
    }
}
