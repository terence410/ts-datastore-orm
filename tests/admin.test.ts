import { assert, expect } from "chai";
import {datastoreOrm} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {stats} from "../src/enums/stats";

@Entity({namespace: "testing", kind: "errorTest"})
export class ErrorTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total1: number = 0;

    @Column()
    public total2: number = 0;
}

describe("Admin Test", () => {
    it("truncate", async () => {
        const [total, requestResponse] = await ErrorTest.truncate();
    });

    it("namespaces", async () => {
        const namespaces = await datastoreOrm.getNamespaces();

        for (const namespace of namespaces) {
            const kinds = await datastoreOrm.getKinds(namespace.name);
            for (const kind of kinds) {
                console.log("kind", kind.name);
                const properties = await datastoreOrm.getProperties(kind);
            }

            for (const statsName of [stats.kind, stats.kindIsNotRootEntity, stats.kindIsRootEntity, stats.total]) {
                const results = await datastoreOrm.getStats(namespace.name, statsName);
            }
        }
    });

});
