import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, Transaction} from "../src";

@Entity({namespace: "testing", kind: "namespace"})
export class Namespace extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total: number = 0;
}

@Entity({namespace: "testing", kind: "namespaceChild", ancestor: Namespace})
export class NamespaceChild extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total: number = 0;
}

const newNamespace = "testing1";

describe("Namespace Test", () => {
    it("truncate", async () => {
        await Namespace.truncate();
        await Namespace.truncate({namespace: newNamespace});
        await NamespaceChild.truncate();
        await NamespaceChild.truncate({namespace: newNamespace});
    });

    it("create entity", async () => {
        const id = 1;
        const total = 10;
        const [entity] = await Namespace
            .create({id})
            .setNamespace(newNamespace)
            .save();
        assert.equal(entity.getNamespace(), newNamespace);
        assert.equal(entity.getKey().namespace, newNamespace);
        entity.total = 10;
        await entity.save();

        // found by query
        const [foundEntity1] = await Namespace
            .query()
            .setNamespace(newNamespace)
            .filterKey("=", entity.getKey())
            .runOnce();
        assert.isDefined(foundEntity1);
        if (foundEntity1) {
            assert.equal(foundEntity1.id, id);
            assert.equal(foundEntity1.total, total);
            assert.equal(foundEntity1.getNamespace(), newNamespace);
            assert.equal(foundEntity1.getKey().namespace, newNamespace);
        }

        // found by query
        const [foundEntity2] = await Namespace
            .query()
            .setNamespace(newNamespace)
            .filter("id", "=", id)
            .runOnce();
        assert.isDefined(foundEntity2);

        // found directly
        const [foundEntity3] = await Namespace.find(entity.id);
        assert.isUndefined(foundEntity3);

        const [foundEntity4] = await Namespace.find({namespace: newNamespace, id: entity.id});
        assert.isDefined(foundEntity4);
    });

    it("create entity in transaction", async () => {
        const id = 2;
        const totalAllocate = 5;
        const [entity] = await Namespace
            .create({id})
            .setNamespace(newNamespace)
            .save();

        const [ids, transactionResponse] = await Transaction.execute(async transaction => {
            const [users, requestResponse1] = await transaction.findMany(Namespace, {namespace: newNamespace, ids: [id]});

            if (users.length) {
                const user1 = users[0];
                const [ids1] = await transaction.allocateIds(Namespace, {namespace: newNamespace, total: totalAllocate});
                transaction.save(user1);
                return ids1;
            } else {
                transaction.rollback();
            }
        });
        assert.isTrue(transactionResponse.hasCommitted);
        assert.isArray(ids);
        if (ids) {
            assert.equal(ids.length, totalAllocate);
        }
    });

    it("create entity with ancestor", async () => {
        const id = 3;
        const [entity] = await Namespace
            .create({id})
            .setNamespace(newNamespace)
            .save();

        // must need to be in same namespace
        try {
            const [child1] = await NamespaceChild
                .create()
                .setAncestor(entity)
                .save();
        } catch (err) {
            assert.match(err.message, /.*The ancestor namespace.*/);
        }

        // save again
        const [child2] = await NamespaceChild
            .create()
            .setNamespace(newNamespace)
            .setAncestor(entity)
            .save();
        assert.equal(child2.getNamespace(), newNamespace);
        assert.equal(child2.getKey().namespace, newNamespace);

        try {
            const [children1] = await NamespaceChild
                .query()
                .setAncestor(entity)
                .run();
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /.*The ancestor namespace.*/);
        }

        // get the ancestor
        const [parent] = await child2.getAncestor<Namespace>();
        assert.isDefined(parent);
        if (parent) {
            assert.equal(parent.getNamespace(), newNamespace);
        }
    });
});
