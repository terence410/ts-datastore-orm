import { assert, expect } from "chai";
import {Field} from "../src/decorators/Field";
import {Entity} from "../src/decorators/Entity";
import {PerformanceHelper} from "../src/helpers/PerformanceHelper";
import {BaseEntity} from "../src/BaseEntity";
import {Repository} from "../src/Repository";
// @ts-ignore
import {beforeCallback, connection, beforeCallback} from "./share";

@Entity()
export class PerformanceTest1 extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;
}

@Entity()
export class PerformanceTest2 extends BaseEntity {
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

const values = {
    string: 12345,
    number: Math.random().toString(),
    date: new Date().getTime(),
    boolean: 10,
    custom: [1, 3, 3],
};

const total = 1000;
const batch = 500;

// before test
before(beforeCallback);
describe("Performance Test", () => {
    let repository1: Repository<typeof PerformanceTest1>;
    let repository2: Repository<typeof PerformanceTest2>;

    before(() => {
        repository1 = connection.getRepository(PerformanceTest1);
        repository2 = connection.getRepository(PerformanceTest2);
    });
    after(async () => {
        await repository1.truncate();
        await repository2.truncate();
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

    it(`create entity sequentially: ${batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        for (let i = 0; i < batch; i++) {
            const entity = new PerformanceTest1();
            await repository1.insert(entity);
        }

        console.log(performanceHelper.readResult());
    }).timeout(60 * 1000);

    it(`create entity in batch: ${batch}`, async () => {
        const performanceHelper = new PerformanceHelper().start();

        const entities: PerformanceTest1[] = [];
        for (let j = 0; j < batch; j++) {
            const entity = new PerformanceTest1();
            entities.push(entity);
        }
        await repository1.insert(entities);

        console.log(performanceHelper.readResult());
    }).timeout(60 * 1000);
});
