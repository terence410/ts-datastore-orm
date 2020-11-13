import {BaseEntity} from "../../src/BaseEntity";
import {Entity} from "../../src/decorators/Entity";
import {Field} from "../../src/decorators/Field";

@Entity({namespace: "testing"})
export class TaskGroup extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public name: string = "";
}
