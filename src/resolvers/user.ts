import { User } from "../entities/User";
import { MyContext } from "src/types";
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2 from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";
import { COOKIE_NAME } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { FieldError } from "./FieldError";
import { validateRegister } from "../util/validateRegister";

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[]
    @Field( () => User, { nullable: true })
    user?: User
}

@Resolver()
export class UserResolver {
    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() { em }: MyContext
    ): Promise<Boolean> {
        const user = await em.find(User, { email });
        return true;
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const errorResponse = validateRegister(options);
        if (errorResponse.length > 0) return {
            errors: errorResponse
        }

        const hashedPassword = await argon2.hash(options.password);
        let user;
        try {
            const result = await (em as EntityManager)
                .createQueryBuilder(User)
                .getKnexQuery()
                .insert({
                    email: options.email,
                    username: options.username,
                    password: hashedPassword,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returning("*");
            user = result[0];
            user.createdAt = user.created_at;
            user.updatedAt = user.updated_at;
        } catch (error) {
            if (error.detail.includes("email")) {
                // duplicate email error
                return {
                    errors: [
                        {
                            field: "email",
                            message: "Email already exists",
                        },
                    ],
                };
            }
            else if (
                error.detail.includes("username")
            ) {
                // duplicate username error
                return {
                    errors: [
                        {
                            field: "username",
                            message: "username already exists",
                        },
                    ],
                };
            }
        }

        req.session.userId = user.id;
        return { user };
    }

    @Query(() => User, { nullable: true })
    async me(@Ctx() { em, req }: MyContext) {
        // you're not logged in
        if (!req.session.userId) {
            return null;
        }
        return await em.findOne(User, {
            id: req.session.userId,
        });
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("usernameOrEmail") usernameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        if (usernameOrEmail.includes('@')) {
            // email is provided
        } else {
            // username is provided
            if (usernameOrEmail.length <= 2) {
                return {
                    errors: [
                        {
                            field: "usernameOrEmail",
                            message: "length must be greater than 2",
                        },
                    ],
                };
            }
        }
        if (password.length <= 3) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "length must be greater than 3",
                    },
                ],
            };
        }
        let user = await em.findOne(User,
            usernameOrEmail.includes('@') ? { email: usernameOrEmail }: { username: usernameOrEmail }
        );
        if (!user) {
            return {
                errors: [
                    {
                        field: `usernameOrEmail`,
                        message: `That Username Or Email doesn't exist`,
                    },
                ],
            };
        }
        const valid = await argon2.verify(user.password, password);
        if (!valid) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "Incorrect Password",
                    },
                ],
            };
        }

        req.session.userId = user.id;
        return { user };
    }

    @Mutation(() => Boolean)
    async logout(@Ctx() { req, res }: MyContext) {
        return new Promise(resolve =>
            req.session.destroy(err => {
                res.clearCookie(COOKIE_NAME);
                if (err) {
                    console.log(err);
                    resolve(false);
                    return;
                }
                resolve(true);
            })
        );
    }
}