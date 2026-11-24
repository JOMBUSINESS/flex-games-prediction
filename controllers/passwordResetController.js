const crypto = require("crypto");
const bcrypt = require("bcrypt");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendResetEmail(email, resetUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Resend email configuration is missing.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "Reset your FLEX GAMES PREDICTION password",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2>Reset your password</h2>
        <p>We received a request to reset your FLEX GAMES PREDICTION password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#e8b84d;color:#111;text-decoration:none;border-radius:6px">Reset password</a></p>
        <p>This link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.</p>
      </div>`
    })
  });
  if (!response.ok) {
    const details = await response.text();
    console.error("Resend API error:", details);
    throw new Error("Email provider rejected the request.");
  }
}

async function forgotPassword(req, res) {
  const db = req.app.locals.db;
  if (!db) return res.status(503).json({ success: false, message: "Password recovery is temporarily unavailable." });
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }

  try {
    const found = await db.query("SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1", [email]);
    // Always return the same response so the endpoint does not reveal registered accounts.
    if (!found.rowCount) {
      return res.json({ success: true, message: "If an account exists for that email, a reset link will be sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [found.rows[0].id]);
    await db.query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [found.rows[0].id, tokenHash, expiresAt]
    );

    const baseUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("PUBLIC_APP_URL is not configured.");
    const resetUrl = `${baseUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
    try {
      await sendResetEmail(found.rows[0].email, resetUrl);
    } catch (emailError) {
      await db.query("UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1", [tokenHash]);
      throw emailError;
    }
    return res.json({ success: true, message: "If an account exists for that email, a reset link will be sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(503).json({ success: false, message: "Unable to send a reset email right now. Please try again later." });
  }
}

async function resetPassword(req, res) {
  const db = req.app.locals.db;
  if (!db) return res.status(503).json({ success: false, message: "Password recovery is temporarily unavailable." });
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or expired." });
  }
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ success: false, message: "Use at least 10 characters with uppercase, lowercase, number and symbol." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(token)]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "This reset link is invalid or expired." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
      passwordHash, result.rows[0].user_id
    ]);
    await client.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [
      result.rows[0].user_id
    ]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Your password has been reset. You can now log in." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Unable to reset your password." });
  } finally {
    client.release();
  }
}

module.exports = { forgotPassword, resetPassword };
