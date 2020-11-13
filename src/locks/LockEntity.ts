import {BaseEntity} from "../BaseEntity";
import {Entity} from "../decorators/Entity";
import {Field} from "../decorators/Field";

@Entity({namespace: "Lock"})
export class LockEntity extends BaseEntity {
    @Field()
    public _id: string = "";

    @Field()
    public randomId: string = "";

    @Field({index: true})
    public lockKey: string = "";

    @Field()
    public expiredAt: Date = new Date();
}
