import {BaseEntity} from "../../src/BaseEntity";
import {Entity} from "../../src/decorators/Entity";
import {Field} from "../../src/decorators/Field";

@Entity({kind: "User", namespace: "testing"})
export class User extends BaseEntity {
    @Field({generateId: true})
    public _id: number = 0;

    @Field()
    public date: Date = new Date();

    @Field({index: true})
    public string: string = "";

    @Field({index: true})
    public number: number = 10;

    @Field()
    public buffer: Buffer = Buffer.alloc(1);

    @Field()
    public array: number[] = [];

    @Field()
    public object: any = {};

    @Field()
    public undefined: undefined = undefined;

    @Field()
    public null: null = null;
}
