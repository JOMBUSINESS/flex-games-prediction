
const crypto = require("crypto");
const { randomInt } = require("crypto");

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function requestOtp(req, res) {
  const db = req.app.locals.db;
  const { phone } = req.body;

  if (!db) {
    return res.status(503).json({ success: false, message: "Database unavailable." });
  }

  if (!phone || !/^\+?[0-9]{8,15}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Enter a valid phone number." });
  }

  try {
    const userResult = await db.query(
      "SELECT id, phone_verified FROM users WHERE phone = $1 AND status = 'active'",
      [phone.trim()]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    if (userResult.rows[0].phone_verified) {
      return res.status(400).json({ success: false, message: "Phone number is already verified." });
    }

    // SMS delivery must be connected before production OTP requests are enabled.
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        success: false,
        message: "SMS verification is not configured yet."
      });
    }

    const code = String(randomInt(100000, 1000000));

    await db.query(
      `UPDATE otp_verifications
       SET consumed_at = NOW()
       WHERE phone = $1 AND purpose = 'registration'
         AND consumed_at IS NULL`,
      [phone.trim()]
    );

    await db.query(
      `INSERT INTO otp_verifications
       (phone, code_hash, purpose, expires_at)
       VALUES ($1, $2, 'registration', NOW() + INTERVAL '5 minutes')`,
      [phone.trim(), hashCode(code)]
    );

    console.log(`Development OTP for ${phone}: ${code}`);

    return res.json({
      success: true,
      message: "Development verification code generated.",
      developmentCode: code
    });
  } catch (error) {
    console.error("OTP request error:", error);
    return res.status(500).json({ success: false, message: "Unable to generate verification code." });
  }
}

async function verifyOtp(req, res) {
  const db = req.app.locals.db;
  const { phone, code } = req.body;

  if (!db) {
    return res.status(503).json({ success: false, message: "Database unavailable." });
  }

  if (!phone || !/^\d{6}$/.test(String(code || ""))) {
    return res.status(400).json({ success: false, message: "Enter your phone number and six-digit code." });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, code_hash, attempts
       FROM otp_verifications
       WHERE phone = $1
         AND purpose = 'registration'
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [phone.trim()]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Code expired or not found. Request a new code." });
    }

    const otp = result.rows[0];

    if (otp.attempts >= 5) {
      await client.query(
        "UPDATE otp_verifications SET consumed_at = NOW() WHERE id = $1",
        [otp.id]
      );
      await client.query("COMMIT");
      return res.status(429).json({ success: false, message: "Too many attempts. Request a new code." });
    }

    if (hashCode(String(code)) !== otp.code_hash) {
      await client.query(
        "UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1",
        [otp.id]
      );
      await client.query("COMMIT");
      return res.status(400).json({ success: false, message: "Incorrect verification code." });
    }

    await client.query(
      "UPDATE users SET phone_verified = TRUE, updated_at = NOW() WHERE phone = $1",
      [phone.trim()]
    );

    await client.query(
      "UPDATE otp_verifications SET verified_at = NOW(), consumed_at = NOW() WHERE id = $1",
      [otp.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Phone number verified. You can now log in."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Unable to verify code." });
  } finally {
    client.release();
  }
}

module.exports = { requestOtp, verifyOtp };
