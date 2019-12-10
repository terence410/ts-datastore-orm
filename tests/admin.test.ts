import { assert, expect } from "chai";
import {datastoreOrm} from "../src";
// @ts-ignore
import {User} from "./entities/User";

describe("Admin Test", () => {
    it("namespaces and kinds", async () => {
        const namespaces = await datastoreOrm.getNamespaces();
        assert.isAtLeast(namespaces.length, 1);

        for (const namespace of namespaces) {
            const kinds = await datastoreOrm.getKinds(namespace);
            assert.isAtLeast(kinds.length, 1);
        }
    });

    it("get stats", async () => {
        const stats1 = await datastoreOrm.getStatsTotal();
        const stats2 = await datastoreOrm.getNamespaceStatsTotal("");
        const stats3 = await datastoreOrm.getEntityStatsTotal(User);
        const properties1 = await datastoreOrm.getEntityProperties(User);
        const properties2 = await datastoreOrm.getProperties({namespace: "testing", kind: "user"});
    });
});
