'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ============================================
    // 1. Extend ade_enrollments.status ENUM
    // ============================================
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ade_enrollments_status"
      ADD VALUE IF NOT EXISTS 'profile_generated';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ade_enrollments_status"
      ADD VALUE IF NOT EXISTS 'profile_delivered';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ade_enrollments_status"
      ADD VALUE IF NOT EXISTS 'authenticated';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_ade_enrollments_status"
      ADD VALUE IF NOT EXISTS 'device_configured';
    `);

    // ============================================
    // 2. Extend enrollment_profiles table
    // ============================================
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "organization_display_name" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "department" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "checkin_url" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "topic" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "is_mandatory" BOOLEAN DEFAULT true;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "supervised" BOOLEAN DEFAULT true;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "allow_profile_removal" BOOLEAN DEFAULT false;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "await_device_configured" BOOLEAN DEFAULT true;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "language" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "region" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "support_contact" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "support_email" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "support_phone" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "identity_certificate_uuid" VARCHAR(255);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "anchor_certificates" JSON;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "enrollment_profiles"
      ADD COLUMN IF NOT EXISTS "skip_setup_assistant_items" JSON;
    `);

    // ============================================
    // 3. Extend ade_enrollments table
    // ============================================
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "profile_generated_at" TIMESTAMP WITH TIME ZONE;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "profile_delivered_at" TIMESTAMP WITH TIME ZONE;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "authenticated_at" TIMESTAMP WITH TIME ZONE;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "device_configured_at" TIMESTAMP WITH TIME ZONE;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "ade_enrollments"
      ADD COLUMN IF NOT EXISTS "last_error" TEXT;
    `);

    // ============================================
    // 4. Create ade_device_assignments table
    // ============================================
    await queryInterface.createTable('ade_device_assignments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      serial_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Device serial number from Apple Business Manager',
      },
      device_family: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Device family (e.g. iPhone, iPad)',
      },
      model: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Device model identifier',
      },
      os: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Operating system version',
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the device was assigned to this server',
      },
      assigned_server: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'MDM server the device is assigned to',
      },
      profile_uuid: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'UUID of the assigned DEP profile',
      },
      profile_status: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Status of the profile assignment',
      },
      organization: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Organization name from ABM',
      },
      sync_status: {
        type: Sequelize.ENUM('pending', 'synced', 'failed'),
        defaultValue: 'pending',
        comment: 'Synchronization status',
      },
      sync_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message from last sync attempt',
      },
      sync_message: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Status message from last sync',
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last synchronization',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Arbitrary metadata',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "ade_device_assignments_serial_number_index"
      ON "ade_device_assignments" ("serial_number");
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "ade_device_assignments_sync_status_index"
      ON "ade_device_assignments" ("sync_status");
    `);

    // ============================================
    // 5. Create certificate_metadata table
    // ============================================
    await queryInterface.createTable('certificate_metadata', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      certificate_type: {
        type: Sequelize.ENUM('identity', 'push', 'anchor'),
        allowNull: false,
        comment: 'Type of certificate',
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable certificate name',
      },
      uuid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Apple certificate UUID',
      },
      topic: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'APNs topic (for push certificates)',
      },
      issuer: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Certificate issuer name',
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Certificate subject name',
      },
      serial_number: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Certificate serial number',
      },
      not_valid_before: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Certificate validity start',
      },
      not_valid_after: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Certificate validity end',
      },
      thumbprint: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Certificate SHA-1 thumbprint',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether this certificate is currently active',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Arbitrary metadata',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "certificate_metadata_uuid_index"
      ON "certificate_metadata" ("uuid");
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "certificate_metadata_certificate_type_index"
      ON "certificate_metadata" ("certificate_type");
    `);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('certificate_metadata');
    await queryInterface.dropTable('ade_device_assignments');

    await queryInterface.removeColumn('ade_enrollments', 'last_error');
    await queryInterface.removeColumn('ade_enrollments', 'retry_count');
    await queryInterface.removeColumn('ade_enrollments', 'device_configured_at');
    await queryInterface.removeColumn('ade_enrollments', 'authenticated_at');
    await queryInterface.removeColumn('ade_enrollments', 'profile_delivered_at');
    await queryInterface.removeColumn('ade_enrollments', 'profile_generated_at');

    await queryInterface.removeColumn('enrollment_profiles', 'skip_setup_assistant_items');
    await queryInterface.removeColumn('enrollment_profiles', 'anchor_certificates');
    await queryInterface.removeColumn('enrollment_profiles', 'identity_certificate_uuid');
    await queryInterface.removeColumn('enrollment_profiles', 'support_phone');
    await queryInterface.removeColumn('enrollment_profiles', 'support_email');
    await queryInterface.removeColumn('enrollment_profiles', 'support_contact');
    await queryInterface.removeColumn('enrollment_profiles', 'region');
    await queryInterface.removeColumn('enrollment_profiles', 'language');
    await queryInterface.removeColumn('enrollment_profiles', 'await_device_configured');
    await queryInterface.removeColumn('enrollment_profiles', 'allow_profile_removal');
    await queryInterface.removeColumn('enrollment_profiles', 'supervised');
    await queryInterface.removeColumn('enrollment_profiles', 'is_mandatory');
    await queryInterface.removeColumn('enrollment_profiles', 'topic');
    await queryInterface.removeColumn('enrollment_profiles', 'checkin_url');
    await queryInterface.removeColumn('enrollment_profiles', 'department');
    await queryInterface.removeColumn('enrollment_profiles', 'organization_display_name');
  },
};
