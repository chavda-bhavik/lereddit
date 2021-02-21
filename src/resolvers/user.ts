import { User } from "../entities/User";
import { MyContext } from "src/types";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver } from "type-graphql";
import argon2 from 'argon2';
import { addErrorLoggingToSchema } from "apollo-server-express";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()
class FieldError {
    @Field()
    field: string;
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[]
    @Field( () => User, { nullable: true })
    user?: User
}

@Resolver()
export class UserResolver {
    @Mutation( () => UserResponse )
    async register(
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        if (options.username.length <= 3) {
            // username length error
            return {
                errors: [{
                    field: 'username',
                    message: 'length must be greater than 3'
                }]
            }
        }
        if (options.password.length <= 3) {
            // password length error
            return {
                errors: [{
                    field: 'pasword',
                    message: 'length must be greater than 3'
                }]
            }
        }

        const hashedPassword = await argon2.hash(options.password);
        let user = em.create(User, { 
            username: options.username,
            password: hashedPassword
        });
        try {
            await em.persistAndFlush(user);    
        } catch (error) {
            if (error.code === "23505" || error.detail.includes('User already exists')) {
                // duplicate username error
                return {
                    errors: [{
                        field: 'username',
                        message: 'username already exists'
                    }]
                }
            }
        }
        return {user};
    }

    @Mutation( () => UserResponse )
    async login(
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        if (options.username.length <= 2) {
            return {
                errors: [{
                    field: 'username',
                    message: 'length must be greater than 2'
                }]
            }
        }
        if (options.password.length <= 3) {
            return {
                errors: [{
                    field: 'password',
                    message: 'length must be greater than 3'
                }]
            }
        }
        let user = await em.findOne(User, {
            username: options.username
        });
        if (!user) {
            return {
                errors: [{
                    field: 'username',
                    message: "that username doesn't exist"
                }]
            }
        }
        const valid = await argon2.verify(user.password, options.password);
        if (!valid) {
            return {
                errors: [{
                    field: 'password',
                    message: "incorrect password"
                }]
            }
        }
        return { user };
    }
}