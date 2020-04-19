import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, Transaction} from "../src";
// @ts-ignore
import {beforeCallback} from "./share";

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

// before test
before(beforeCallback);

describe("Namespace Test", () => {
    it("truncate", async () => {
        await Namespace.truncate();
        await Namespace.truncate({namespace: newNamespace});
        await NamespaceChild.truncate();
        await NamespaceChild.truncate({namespace: newNamespace});
    });

    it("Transaction", async () => {

    });

    it("Ancestor", async () => {

    });
});
