'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add fcm_message_id to notification_logs.
     *
     * Firebase Cloud Messaging returns a unique message ID for every
     * successfully accepted notification. Storing it enables:
     *   - Delivery tracking / reconciliation with Firebase console
     *   - Idempotency checks when retrying failed sends
     */
    await queryInterface.addColumn('notification_logs', 'fcm_message_id', {
      type: Sequelize.STRING(512),
      allowNull: true,
      comment: 'Firebase Cloud Messaging message ID returned on successful send',
      after: 'error_message',
    });

    await queryInterface.addIndex('notification_logs', ['fcm_message_id'], {
      name: 'notification_logs_fcm_message_id_idx',
      where: { fcm_message_id: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notification_logs', 'notification_logs_fcm_message_id_idx');
    await queryInterface.removeColumn('notification_logs', 'fcm_message_id');
  },
};
