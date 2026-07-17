'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."enum_mdm_devices_enrollment_type" AS ENUM('device', 'user');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "public"."mdm_devices"
      ADD COLUMN "enrollment_type" "public"."enum_mdm_devices_enrollment_type"
      DEFAULT NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX "mdm_devices_enrollment_type_idx"
      ON "public"."mdm_devices" ("enrollment_type");
    `);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "public"."mdm_devices_enrollment_type_idx";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "public"."mdm_devices" DROP COLUMN IF EXISTS "enrollment_type";
    `);
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "public"."enum_mdm_devices_enrollment_type";
    `);
  },
};
