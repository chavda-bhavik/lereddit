import { User } from "../entities/User";
import { MyContext } from "src/types";
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { FieldError } from "./FieldError";
import { validateRegister } from "../util/validateRegister";
import sendEmail from "../util/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[]
    @Field( () => User, { nullable: true })
    user?: User
}

@Resolver()
export class UserResolver {
    @Mutation(() => UserResponse)
    async changePassword(
        @Ctx() { redis, req }: MyContext,
        @Arg("token") token: string,
        @Arg("newPassword") newPassword: string
    ): Promise<UserResponse> {
        if (newPassword.length <= 3) {
            return {
                errors: [
                    {
                        field: "newPassword",
                        message: "length must be greater than 3",
                    },
                ],
            };
        }
        // get userId from redis
        const userId = await redis.get(FORGOT_PASSWORD_PREFIX + token);
        if (!userId) {
            return {
                errors: [
                    {
                        field: "token",
                        message: "token expired",
                    },
                ],
            };
        }
        const user = await User.findOne(parseInt(userId));
        // user not found
        if (!user) {
            return {
                errors: [
                    {
                        field: "token",
                        message: "user no longer exists",
                    },
                ],
            };
        }
        // user is valid, so updating password
        let hashedPassword = await argon2.hash(newPassword);
        await User.update(parseInt(userId), {
            password: hashedPassword,
        });
        // returning user and logging in
        req.session.userId = user.id;
        return { user };
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() { redis }: MyContext
    ): Promise<Boolean> {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return false;
        }
        const token = v4();
        await redis.set(
            FORGOT_PASSWORD_PREFIX + token,
            user.id,
            "ex",
            1000 * 60 * 60 * 24 * 3
        );
        sendEmail(
            email,
            `<a href='http://localhost:3000/change-password/${token}'>reset password</a>`
        );
        return true;
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { req }: MyContext
    ): Promise<UserResponse> {
        const errorResponse = validateRegister(options);
        if (errorResponse.length > 0)
            return {
                errors: errorResponse,
            };

        const hashedPassword = await argon2.hash(options.password);
        let user;
        try {
            const result = await getConnection()
                .createQueryBuilder()
                .insert()
                .into(User)
                .values({ 
                    email: options.email,
                    username: options.username,
                    password: hashedPassword
                })
                .returning('*')
                .execute();
            user = result.raw[0];
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
            } else if (error.detail.includes("username")) {
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

        req.session.userId = user.id
        return { user };
    }

    @Query(() => User, { nullable: true })
    me(@Ctx() { req }: MyContext) {
        // you're not logged in
        if (!req.session.userId) {
            return null;
        }
        return User.findOne(req.session.userId);
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("usernameOrEmail") usernameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { req }: MyContext
    ): Promise<UserResponse> {
        if (usernameOrEmail.includes("@")) {
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
        let user = await User.findOne({
            where: usernameOrEmail.includes("@")
                    ? { email: usernameOrEmail }
                    : { username: usernameOrEmail }
        });
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