
require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");

async function main() {
  const { SUPER_ADMIN_NAME, SUPER_ADMIN_PHONE, SUPER_ADMIN_COUNTRY, SUPER_ADMIN_PASSWORD, DATABASE_URL } = process.env;

  if (!DATABASE_URL || !SUPER_ADMIN_NAME || !SUPER_ADMIN_PHONE ||
      !SUPER_ADMIN_COUNTRY || !SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "Set DATABASE_URL, SUPER_ADMIN_NAME, SUPER_ADMIN_PHONE, SUPER_ADMIN_COUNTRY and SUPER_ADMIN_PASSWORD."
    );
  }

  if (SUPER_ADMIN_PASSWORD.length < 10 ||
      !/[A-Z]/.test(SUPER_ADMIN_PASSWORD) ||
      !/[a-z]/.test(SUPER_ADMIN_PASSWORD) ||
      !/[0-9]/.test(SUPER_ADMIN_PASSWORD) ||
      !/[^A-Za-z0-9]/.test(SUPER_ADMIN_PASSWORD)) {
    throw new Error("Password must be 10+ characters with uppercase, lowercase, number and symbol.");
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined
  });

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE phone = $1",
      [SUPER_ADMIN_PHONE]
    );

    if (existing.rowCount) {
      throw new Error("That phone number already exists. Use a dedicated admin phone number.");
    }

    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, phone, country, password_hash, role, status, phone_verified)
       VALUES ($1, $2, $3, $4, 'super_admin', 'active', TRUE)
       RETURNING id, full_name, phone, role`,
      [SUPER_ADMIN_NAME, SUPER_ADMIN_PHONE, SUPER_ADMIN_COUNTRY, passwordHash]
    );

    console.log("Super-admin account created:");
    console.log(result.rows[0]);
    console.log("Keep your password private. Remove the temporary environment variables after setup.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Super-admin setup failed:", error.message);
  process.exitCode = 1;
});
