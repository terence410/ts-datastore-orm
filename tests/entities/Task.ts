import {BaseEntity} from "../../src/BaseEntity";
import {Entity} from "../../src/decorators/Entity";
import {Field} from "../../src/decorators/Field";

@Entity({kind: "Task", namespace: "testing"})
export class Task extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";

    @Field()
    public deadline: Date = new Date();
}
