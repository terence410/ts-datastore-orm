import { assert, expect } from "chai";
import {BaseEntity} from "../src/BaseEntity";
import {CompositeIndexExporter} from "../src/CompositeIndexExporter";
import {CompositeIndex} from "../src/decorators/CompositeIndex";
import {Entity} from "../src/decorators/Entity";
import {Field} from "../src/decorators/Field";
import {Repository} from "../src/Repository";
// @ts-ignore
import {initializeConnection, connection} from "./share";

@CompositeIndex({_id: "desc"})
@CompositeIndex({date1: "desc", string1: "asc"})
@CompositeIndex({string1: "asc", ["object1.string"]: "desc"}, true)
@Entity()
export class Index1 extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;
}

@CompositeIndex({number: "desc", string: "desc"})
@CompositeIndex({number: "desc"})
@Entity()
export class Index2 extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public string: string = "";

    @Field()
    public number: number = 0;

    @Field()
    public boolean: boolean = false;

    @Field()
    public custom: any = "";
}

// before test
before(initializeConnection);
describe("Performance Test", () => {
    let repository1: Repository<typeof Index1>;
    let repository2: Repository<typeof Index2>;

    before(() => {
        repository1 = connection.getRepository(Index1);
        repository2 = connection.getRepository(Index2);
    });
    after(async () => {
        await repository1.truncate();
        await repository2.truncate();
    });

    it("create composite index yaml", async () => {
        const filename = "./index.yaml";
        const exporter = new CompositeIndexExporter();
        exporter.addEntity(Index1, {kind: "Kind1"});
        exporter.addEntity(Index2, {kind: "Kind2"});
        exporter.addEntity([Index1, Index2]);

        const yaml = exporter.getYaml();
        assert.match(yaml, /indexes/);
        exporter.exportTo(filename);
    });
});
