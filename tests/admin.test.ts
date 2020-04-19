import { assert, expect } from "chai";
import {datastoreStats} from "../src";
// @ts-ignore
import {User} from "./entities/User";
// @ts-ignore
import {beforeCallback} from "./share";

// before test
before(beforeCallback);

describe("Admin Test", () => {
    it("namespaces and kinds", async () => {
        const namespaces = await datastoreStats.getNamespaces();
        assert.isAtLeast(namespaces.length, 1);

        for (const namespace of namespaces) {
            const kinds = await datastoreStats.getKinds(namespace);
            assert.isAtLeast(kinds.length, 1);
        }
    });

    it("get stats", async () => {
        const total1 = await datastoreStats.getTotal();
        const total2 = await datastoreStats.getTotal({namespace: "testing"});
        const total3 = await datastoreStats.getEntityTotal(User);
        const properties1 = await datastoreStats.getEntityProperties(User);
        const properties2 = await datastoreStats.getProperties({namespace: "testing", kind: "user"});
    });
});
