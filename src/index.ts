import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
import express from 'express'
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
// import redis from "redis";
import Redis from 'ioredis';
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { createConnection } from "typeorm";

import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import path from "path";


const main = async () => {
    const conn = await createConnection({
        type: "postgres",
        database: "lerddit2",
        username: "power",
        password: "power",
        logging: true,
        migrations: [path.join(__dirname, "./migrations/*")],
        synchronize: true,
        entities: [User, Post],
    });
    await conn.runMigrations();
    // await Post.delete({});

    const app = express();

    let RedisStore = connectRedis(session);
    let redis = new Redis();

    app.use(
        cors({
            origin: "http://localhost:3000",
            credentials: true,
        })
    );
    app.use(
        session({
            name: COOKIE_NAME,
            store: new RedisStore({
                client: redis,
                disableTouch: true,
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
                httpOnly: true,
                sameSite: "lax", // csrf
                secure: __prod__, // cookie only works in https
            },
            secret: "awerzjxerlkhqwilejhrjklasehriluh",
            resave: false,
            saveUninitialized: false,
        })
    );

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false,
        }),
        context: ({ req, res }): MyContext => ({
            req,
            res,
            redis,
        }),
    });
    apolloServer.applyMiddleware({
        app,
        cors: false,
    });
    app.listen(4000, () => {
        console.log(`Server running on port 4000`);
    });
    // const post = orm.em.create(Post, { title: 'my first post' });
    // await orm.em.persistAndFlush(post);
    // console.log('---------------sql 2--------------------');
    // await orm.em.nativeInsert(Post, { title: 'my post 2' });
    // const posts = await orm.em.find(Post, {});
    // console.log(posts);
}

main().catch(err => {
    console.log(err);
});