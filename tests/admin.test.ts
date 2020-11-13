import { assert, expect } from "chai";
// @ts-ignore
import {beforeCallback, beforeCallback, connection} from "./share";

before(beforeCallback);
describe("Admin Test", () => {
    it("datastore stats", async () => {
        const meta = connection.getAdmin();
        const stats = await meta.getStats();
        assert.isTrue(stats.count > 0);

        const namespaces = await meta.getNamespaces();
        assert.isArray(namespaces);

        const kinds = await meta.getKinds();
        assert.isArray(kinds);

        for (const kind of kinds) {
            const kindStats = meta.getKindStats(kind);
            assert.isDefined(kindStats);
        }

        for (const namespace of namespaces) {
            const namespaceKinds = await meta.getNamespaceKinds(namespace);
            assert.isArray(namespaceKinds);

            for (const kind of namespaceKinds) {
                const namespaceKindStats = await meta.getNamespaceKindStats(namespace, kind);
                assert.isDefined(namespaceKindStats);
            }

            // get one of the properties
            const properties = await meta.getNamespaceKindProperties(namespace, kinds[0]);
            assert.isArray(properties);
        }
    });
});
