require("dotenv").config();
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_NAME = "FLEX Super Admin" } = process.env;
  if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PHONE || !ADMIN_PASSWORD) {
    throw new Error("Set DATABASE_URL, ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD before running this script.");
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
  });
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status, phone_verified)
       VALUES ($1, LOWER($2), $3, $4, 'super_admin', 'active', TRUE)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         role = 'super_admin',
         status = 'active',
         phone_verified = TRUE,
         updated_at = NOW()
       RETURNING id, email, role`,
      [ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, hash]
    );
    console.log("Super-admin account ready:", result.rows[0]);
  } finally {
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });
