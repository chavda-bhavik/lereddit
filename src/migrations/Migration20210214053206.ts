import { Migration } from '@mikro-orm/migrations';

export class Migration20210214053206 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "post" ("id" serial primary key, "title" varchar(255) not null, "created_at" timestamptz(0) not null default \'NOW()\', "updated_at" timestamptz(0) not null default \'NOW()\');');
  }

}
