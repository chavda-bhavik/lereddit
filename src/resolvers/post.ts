import { Post } from "../entities/Post";
import {
    Arg,
    Ctx,
    Field,
    InputType,
    Int,
    Mutation,
    Query,
    Resolver,
    UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middleware/isAuth";
import { User } from "../entities/User";
import { getConnection } from "typeorm";

@InputType()
class PostInput {
    @Field()
    title: string;
    @Field()
    text: string;
}

@Resolver()
export class PostResolver {
    @Query(() => [Post])
    posts(
        @Arg('limit', () => Int) limit: number,
        @Arg('cursor', () => String, { nullable: true }) cursor: string | null
    ): Promise<Post[]> {
        const realLimit = Math.min(50, limit);
        let qb = getConnection()
            .getRepository(Post)
            .createQueryBuilder("p")
            .orderBy('"createdAt"', 'DESC')
            .take(realLimit)
        if (cursor) {
            qb.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
        }
        return qb.getMany();
    }

    @Query(() => Post, { nullable: true })
    post(@Arg("id") id: number): Promise<Post | undefined> {
        return Post.findOne(id);
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg("input") input: PostInput,
        @Ctx() { req }: MyContext
    ): Promise<Post> {
        let post = await Post.create({
            ...input,
            creator: await User.findOne(req.session.userId),
        }).save();
        return post;
    }

    @Mutation(() => Post)
    async updatePost(
        @Arg("id") id: number,
        @Arg("title") title: string
    ): Promise<Post | null> {
        const post = await Post.findOne(id);
        if (!post) return null;
        if (typeof title !== "undefined") {
            await Post.update(id, {
                title,
            });
        }
        return post;
    }

    @Mutation(() => Post)
    async deletePost(@Arg("id") id: number): Promise<Boolean> {
        await Post.delete(id);
        return true;
    }
}