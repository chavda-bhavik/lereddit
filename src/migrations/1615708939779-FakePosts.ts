import { MigrationInterface, QueryRunner } from "typeorm";

export class FakePosts1615708939779 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        insert into post (title, text, "creatorId", "createdAt") values ('Python', 'Aenean fermentum. Donec ut mauris eget massa tempor convallis. Nulla neque libero, convallis eget, eleifend luctus, ultricies eu, nibh.
        Quisque id justo sit amet sapien dignissim vestibulum. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Nulla dapibus dolor vel est. Donec odio justo, sollicitudin ut, suscipit a, feugiat et, eros.', 1, '2020-03-25T12:56:13Z');
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {}
}
