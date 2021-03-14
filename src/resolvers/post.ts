import { Post } from "../entities/Post";
import {
    Arg,
    Ctx,
    Field,
    FieldResolver,
    InputType,
    Int,
    Mutation,
    ObjectType,
    Query,
    Resolver,
    Root,
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

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[]
    @Field(() => Boolean)
    hasMore: Boolean
}

@Resolver(Post)
export class PostResolver {
    @FieldResolver(() => String)
    textSnippet(
        @Root() post:Post
    ) {
        return post.text.slice(0, 50)
    }

    @Query(() => PaginatedPosts)
    async posts(
        @Arg('limit', () => Int) limit: number,
        @Arg('cursor', () => String, { nullable: true }) cursor: string | null
    ): Promise<PaginatedPosts> {
        const realLimit = Math.min(50, limit);
        const realLimitPlusOne = realLimit + 1;
        let qb = getConnection()
            .getRepository(Post)
            .createQueryBuilder("p")
            .orderBy('"createdAt"', 'DESC')
            .take(realLimitPlusOne)
        if (cursor) {
            qb.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
        }
        const posts = await qb.getMany();
        return {
            posts: posts.slice(0, realLimit),
            hasMore: posts.length === realLimitPlusOne
        };
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