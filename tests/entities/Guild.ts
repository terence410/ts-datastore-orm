import {BaseEntity} from "../../src/BaseEntity";
import {Entity} from "../../src/decorators/Entity";
import {Field} from "../../src/decorators/Field";

@Entity({namespace: "testing", enumerable: true})
export class Guild extends BaseEntity {
    @Field()
    public _id: string = "";

    @Field()
    public date: Date = new Date();

    @Field()
    public name: string = "";
}
