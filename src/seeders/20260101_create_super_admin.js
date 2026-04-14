'use strict';

const { hashPassword } = require('../utils/hasher');

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Hash the password
      const hashedPassword = await hashPassword('Admin@1234');

      // Create super admin user
      await queryInterface.bulkInsert('users', [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          username: 'admin',
          email: 'admin@sitesafe.com',
          password_hash: hashedPassword,
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super_admin',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      console.log('✓ Super admin user created successfully');
    } catch (error) {
      console.error('✗ Error creating super admin user:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the super admin user by email
      await queryInterface.bulkDelete('users', {
        email: 'admin@sitesafe.com',
      });

      console.log('✓ Super admin user removed');
    } catch (error) {
      console.error('✗ Error removing super admin user:', error.message);
      throw error;
    }
  },
};
