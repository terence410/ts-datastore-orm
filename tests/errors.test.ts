import { assert, expect } from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {Column} from "../src/decorators/Column";
import {Entity} from "../src/decorators/Entity";

@Entity({namespace: "testing", kind: "errorTest"})
export class ErrorTest extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public total1: number = 0;

    @Column()
    public total2: number = 0;
}

describe("Errors Test", () => {
    it("truncate", async () => {
        const [total, requestResponse] = await ErrorTest.truncate();
    });
});
