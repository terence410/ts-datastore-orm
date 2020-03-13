import { assert, expect } from "chai";
import {BaseEntity, Column, datastoreOrm, Entity} from "../src";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";

function customCast(value: any) {
    return 1;
}

@Entity({kind: "performanceTest1"})
export class PerformanceTest1 extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;
}

@Entity({kind: "performanceTest2"})
export class PerformanceTest2 extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public string: string = "";

    @Column()
    public number: number = 0;

    @Column()
    public boolean: boolean = false;

    @Column()
    public custom: any = "";
}

@Entity({kind: "performanceTest3"})
export class PerformanceTest3 extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column({cast: String})
    public string: string = "";

    @Column({cast: Number})
    public number: number = 0;

    @Column({cast: Boolean})
    public boolean: boolean = false;

    @Column({cast: customCast})
    public custom: any = "";
}

const values = {
    string: 12345,
    number: Math.random().toString(),
    date: new Date().getTime(),
    boolean: 10,
    custom: [1, 3, 3],
};

const total = 1000;
const batch = 1000;

describe("Performance Test", () => {
    it("truncate", async () => {
        const [total1] = await PerformanceTest1.truncate();
        const [total2] = await PerformanceTest2.truncate();
        const [total3] = await PerformanceTest3.truncate();
        console.log(`Truncate: PerformanceTest1: ${total1}, PerformanceTest2: ${total2}, PerformanceTest3: ${total3}`);
    });

    // 45ms
    it(`create empty entity: ${total * batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let i = 0; i < batch; i++ ) {
            for (let j = 0; j < total; j++) {
                const entity = new PerformanceTest1();
            }
        }

        console.log(performanceHelper.readResult());
    });

    // 200ms, around 160ms generated from getEntityColumn
    it(`create empty entity with default values:  ${total * batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let i = 0; i < batch; i++ ) {
            for (let j = 0; j < total; j++) {
                const entity = new PerformanceTest2();
            }
        }

        console.log(performanceHelper.readResult());
    });

    // 266ms, around 80ms overhead generated from parser
    it(`create empty entity with parser: ${total * batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let i = 0; i < batch; i++ ) {
            for (let j = 0; j < total; j++) {
                const entity = new PerformanceTest3();
            }
        }

        console.log(performanceHelper.readResult());
    });

    // 1100ms, around 100ms from internal overhead, around 800ms from datastore.key call
    it(`create empty entity with save operation:  ${total * batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let i = 0; i < batch; i++ ) {
            for (let j = 0; j < total; j++) {
                const entity = new PerformanceTest3();
                const datastore = datastoreOrm.getDatastore();
                const saveData = entity.getSaveData();
            }
        }

        console.log(performanceHelper.readResult());
    });

    it(`create entity sequentially: ${total}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let j = 0; j < total; j++) {
            const entity = new PerformanceTest1();
            await entity.save();
        }

        console.log(performanceHelper.readResult());
    }).timeout(60 * 1000);
});
