const bcrypt = require("bcrypt");

const ALLOWED_COUNTRIES = [
  "Ghana", "Nigeria", "Kenya", "Uganda", "South Africa", "Cameroon"
];

function getDb(req) {
  return req.app.locals.db;
}

function createSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    role: user.role,
    phone_verified: user.phone_verified
  };
}

async function register(req, res) {
  const db = getDb(req);
  if (!db) return res.status(503).json({ success: false, message: "Database unavailable." });

  const { full_name, email, phone, country, password, confirmPassword } = req.body;
  if (!full_name || !email || !phone || !country || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: "Complete all required fields." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(400).json({ success: false, message: "Select a supported country." });
  }
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "Enter a valid phone number with country code." });
  }
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 10 characters and include uppercase, lowercase, number and symbol."
    });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (full_name, email, phone, country, password_hash, role, phone_verified)
       VALUES ($1, LOWER($2), $3, $4, $5, 'user', FALSE)
       RETURNING id, full_name, email, phone, country, role, phone_verified`,
      [full_name.trim(), email.trim(), phone.trim(), country, passwordHash]
    );
    return res.status(201).json({
      success: true,
      message: process.env.REQUIRE_PHONE_VERIFICATION === "true" ? "Account created. Verify your phone number before logging in." : "Account created. You can now log in.",
      verificationRequired: process.env.REQUIRE_PHONE_VERIFICATION === "true",
      user: publicUser(result.rows[0])
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "That email address or phone number is already registered." });
    }
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Unable to create account." });
  }
}

async function performLogin(req, res, allowedRoles) {
  const db = getDb(req);
  if (!db) return res.status(503).json({ success: false, message: "Database unavailable." });
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: "Phone number and password are required." });
  }

  try {
    const result = await db.query(
      `SELECT id, full_name, email, phone, country, password_hash, role, phone_verified, status
       FROM users WHERE phone = $1 LIMIT 1`,
      [phone.trim()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: "Invalid phone number or password." });
    }
    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: "This account is not active." });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, message: "Use the correct login portal." });
    }
    if (process.env.REQUIRE_PHONE_VERIFICATION === "true" && user.role === "user" && !user.phone_verified) {
      return res.status(403).json({
        success: false,
        code: "PHONE_NOT_VERIFIED",
        message: "Verify your phone number before logging in."
      });
    }
    await createSession(req, user);
    return res.json({ success: true, message: "Login successful.", user: publicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Unable to log in." });
  }
}

function login(req, res) {
  return performLogin(req, res, ["user"]);
}
function adminLogin(req, res) {
  return performLogin(req, res, ["super_admin", "admin", "analyst", "support"]);
}

async function me(req, res) {
  if (!req.session?.userId) return res.status(401).json({ success: false, message: "Not logged in." });
  try {
    const result = await getDb(req).query(
      `SELECT id, full_name, email, phone, country, role, phone_verified
       FROM users WHERE id = $1 AND status = 'active'`,
      [req.session.userId]
    );
    if (!result.rowCount) return res.status(401).json({ success: false, message: "Account unavailable." });
    return res.json({ success: true, user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error("Session lookup error:", error);
    return res.status(500).json({ success: false, message: "Unable to check session." });
  }
}

function logout(req, res) {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ success: false, message: "Unable to log out." });
    res.clearCookie("flex.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    });
    return res.json({ success: true, message: "Logged out successfully." });
  });
}

module.exports = { register, login, adminLogin, me, logout };
