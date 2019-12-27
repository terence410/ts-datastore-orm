import { assert, expect } from "chai";
import {BaseEntity, Column, datastoreOrm, Entity} from "../../src";
import {IndexResaveHelper} from "../../src/helpers/IndexResaveHelper";

@Entity({kind: "indexResave"})
export class IndexResave extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";

    @Column()
    public value: number = 0;
}

const total = 10;
describe("Index Resave Helper Test", () => {
    it("truncate", async () => {
        await IndexResave.truncate();
    });

    it("create entity", async () => {
        for (let i = 0; i < total; i++) {
            await IndexResave.create({
                name: Math.random().toString(),
                value: Math.random(),
            }).save();
        }
    });

    it("query will return nothing", async () => {
        const [results1] = await IndexResave.query().filter("name", ">", "").run();
        assert.equal(results1.length, 0);

        const [results2] = await IndexResave.query().filter("value", ">", 0).run();
        assert.equal(results2.length, 0);
    });

    it("resave with new index", async () => {
        const entityColumn1 = datastoreOrm.getEntityColumn(IndexResave, "name");
        entityColumn1.index = true;
        //
        const entityColumn2 = datastoreOrm.getEntityColumn(IndexResave, "value");
        entityColumn2.index = true;

        const indexResaveHelper = new IndexResaveHelper(IndexResave);
        const [totalResaved] = await indexResaveHelper.resave(["name", "value"]);
        assert.equal(totalResaved, total);

        const [results1] = await IndexResave.query().filter("name", ">", "").run();
        assert.equal(results1.length, totalResaved);

        const [results2] = await IndexResave.query().filter("value", ">", 0).run();
        assert.equal(results2.length, totalResaved);
    });
});
