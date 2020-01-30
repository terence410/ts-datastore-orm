import {BaseEntity} from "../../src/BaseEntity";
import {Column} from "../../src/decorators/Column";
import {Entity} from "../../src/decorators/Entity";

@Entity({kind: "Guild"})
export class Guild extends BaseEntity {
    @Column()
    public id: string = "";

    @Column()
    public date: Date = new Date();

    @Column()
    public name: string = "";
}
