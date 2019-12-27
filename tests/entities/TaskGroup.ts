import {BaseEntity} from "../../src/BaseEntity";
import {Column} from "../../src/decorators/Column";
import {Entity} from "../../src/decorators/Entity";
// @ts-ignore
import {User} from "./User";

@Entity({kind: "taskGroup", ancestor: User})
export class TaskGroup extends BaseEntity {
    @Column({generateId: true})
    public id: number = 0;

    @Column()
    public name: string = "";
}
