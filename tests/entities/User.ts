import {BaseEntity} from "../../src/BaseEntity";
import {Column} from "../../src/decorators/Column";
import {Entity} from "../../src/decorators/Entity";

@Entity({namespace: "testing", kind: "user"})
export class User extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public date: Date = new Date();

    @Column({index: true})
    public string: string = "";

    @Column()
    public number: number = 10;

    @Column()
    public buffer: Buffer = Buffer.alloc(1);

    @Column()
    public array: number[] = [];

    @Column()
    public object: any = {};
}
