const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hash a password
 */
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
  try {
    return bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error(`Error comparing passwords: ${error.message}`);
  }
};

module.exports = {
  hashPassword,
  comparePassword,
};
