import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class Post {
    @Field()
    @PrimaryKey()
    id!: number;

    @Field()
    @Property()
    title!: string;
    
    @Field(() => String)
    @Property({ type: 'date', default: 'NOW()' })
    createdAt = new Date();

    @Field(() => String)
    @Property({ onUpdate: () => new Date(), type: 'date', default: 'NOW()' })
    updatedAt = new Date();
}