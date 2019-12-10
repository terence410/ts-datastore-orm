import { assert, expect } from "chai";
import {datastoreOrm} from "../src";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";
import {stats} from "../src/enums/stats";
// @ts-ignore
import {User} from "./entities/User";

@Entity({namespace: "testing", kind: "adminTest"})
export class AdminTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({index: true})
    public total1: number = 0;

    @Column()
    public total2: number = 0;
}

describe("Admin Test", () => {
    it("truncate", async () => {
        const [total, requestResponse] = await AdminTest.truncate();
    });

    it("namespaces", async () => {
        const namespaces = await datastoreOrm.getNamespaces();
        console.log(namespaces);
    });

    it("create entity", async () => {
        const total = 100;
        for (let i = 0; i < total; i++) {
            const [entity] = await AdminTest.create({total1: total}).save();
        }

        // __Stat_Total__ (reference to all namespace)
        // __Stat_Ns_Total__ (refere to single namespace)

        const totalResults = await datastoreOrm.getStats("", "", stats.kindIsRootEntity);
        console.log("", totalResults);

        const totalResults2 = await datastoreOrm.getStats("testing", "", stats.total);
        console.log("testing", totalResults2);

        const results = await datastoreOrm.getStatsByType(User, stats.kindIsRootEntity);
        console.log(results);
    });

    it("namespaces", async () => {
        return;
        const namespaces = await datastoreOrm.getNamespaces();

        for (const namespace of namespaces) {
            const kinds = await datastoreOrm.getKinds(namespace.name);
            for (const kind of kinds) {
                console.log("kind", kind.name);
                const properties = await datastoreOrm.getProperties(kind);
            }

            for (const statsName of [stats.kind, stats.kindIsNotRootEntity, stats.kindIsRootEntity, stats.total]) {
                // const results = await datastoreOrm.getStats(namespace.name, statsName);
                // console.log(results);
            }
        }
    });

});
