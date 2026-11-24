const express = require("express");
const { requireAdmin, requireSuperAdmin } = require("../middleware/auth");
const router = express.Router();

router.use(requireAdmin);

router.get("/overview", async (req, res) => {
  const db = req.app.locals.db;
  if (!db) return res.status(503).json({ success: false, message: "Database unavailable." });
  try {
    const [users, payments, predictions, memberships] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'user'"),
      db.query("SELECT COUNT(*)::int AS total FROM payments WHERE status = 'pending'"),
      db.query("SELECT COUNT(*)::int AS total FROM predictions"),
      db.query("SELECT COUNT(*)::int AS total FROM memberships WHERE status = 'active' AND starts_at <= NOW() AND expires_at > NOW()")
    ]);
    res.json({ success: true, overview: {
      totalUsers: users.rows[0].total,
      pendingPayments: payments.rows[0].total,
      totalPredictions: predictions.rows[0].total,
      activeVipMembers: memberships.rows[0].total
    }});
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ success: false, message: "Unable to load admin overview." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      `SELECT id, full_name, email, phone, country, role, status, phone_verified, created_at
       FROM users ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Unable to load users." });
  }
});

router.patch("/users/:id/status", requireSuperAdmin, async (req, res) => {
  const status = req.body.status;
  if (!["active", "suspended"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be active or suspended." });
  }
  try {
    const result = await req.app.locals.db.query(
      "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND role <> 'super_admin' RETURNING id, status",
      [status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "User not found or protected." });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({ success: false, message: "Unable to update user." });
  }
});

router.get("/predictions", async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      "SELECT * FROM predictions ORDER BY created_at DESC LIMIT 200"
    );
    res.json({ success: true, predictions: result.rows });
  } catch (error) {
    console.error("Admin predictions error:", error);
    res.status(500).json({ success: false, message: "Unable to load predictions." });
  }
});

router.post("/predictions", async (req, res) => {
  const { title, sport, event_name, prediction, odds, confidence, access_level, scheduled_at, is_published } = req.body;
  if (!title || !event_name || !prediction) {
    return res.status(400).json({ success: false, message: "Title, event and prediction are required." });
  }
  if (access_level && !["free", "vip"].includes(access_level)) {
    return res.status(400).json({ success: false, message: "Access level must be free or vip." });
  }
  const parsedOdds = odds === "" || odds == null ? null : Number(odds);
  const parsedConfidence = confidence === "" || confidence == null ? null : Number(confidence);
  if (parsedOdds !== null && (!Number.isFinite(parsedOdds) || parsedOdds < 0)) {
    return res.status(400).json({ success: false, message: "Odds must be a valid non-negative number." });
  }
  if (parsedConfidence !== null && (!Number.isInteger(parsedConfidence) || parsedConfidence < 1 || parsedConfidence > 100)) {
    return res.status(400).json({ success: false, message: "Confidence must be from 1 to 100." });
  }
  try {
    const result = await req.app.locals.db.query(
      `INSERT INTO predictions
       (title, sport, event_name, prediction, odds, confidence, access_level, scheduled_at, is_published, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title.trim(), sport || null, event_name.trim(), prediction.trim(), parsedOdds, parsedConfidence,
       access_level || "free", scheduled_at || null, Boolean(is_published), req.session.userId]
    );
    res.status(201).json({ success: true, prediction: result.rows[0] });
  } catch (error) {
    console.error("Create prediction error:", error);
    res.status(500).json({ success: false, message: "Unable to create prediction." });
  }
});

router.patch("/predictions/:id", async (req, res) => {
  const allowed = ["title", "sport", "event_name", "prediction", "odds", "confidence", "access_level", "result", "scheduled_at", "is_published"];
  const fields = Object.keys(req.body).filter(key => allowed.includes(key));
  if (!fields.length) return res.status(400).json({ success: false, message: "No valid prediction fields supplied." });
  if (req.body.access_level && !["free", "vip"].includes(req.body.access_level)) {
    return res.status(400).json({ success: false, message: "Invalid access level." });
  }
  if (req.body.result && !["pending", "won", "lost", "void"].includes(req.body.result)) {
    return res.status(400).json({ success: false, message: "Invalid result value." });
  }
  const values = fields.map(key => req.body[key]);
  const assignments = fields.map((key, index) => `${key} = $${index + 1}`);
  try {
    const result = await req.app.locals.db.query(
      `UPDATE predictions SET ${assignments.join(", ")} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Prediction not found." });
    res.json({ success: true, prediction: result.rows[0] });
  } catch (error) {
    console.error("Update prediction error:", error);
    res.status(500).json({ success: false, message: "Unable to update prediction." });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      `SELECT p.*, u.full_name, u.email, u.phone, v.name AS plan_name
       FROM payments p JOIN users u ON u.id = p.user_id
       JOIN vip_plans v ON v.id = p.plan_id
       ORDER BY p.created_at DESC LIMIT 200`
    );
    res.json({ success: true, payments: result.rows });
  } catch (error) {
    console.error("Admin payments error:", error);
    res.status(500).json({ success: false, message: "Unable to load payments." });
  }
});

router.patch("/payments/:id/review", requireSuperAdmin, async (req, res) => {
  const { decision } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Decision must be approved or rejected." });
  }
  const db = req.app.locals.db;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query(
      `SELECT p.id, p.user_id, p.plan_id, p.status, v.duration_days
       FROM payments p JOIN vip_plans v ON v.id = p.plan_id
       WHERE p.id = $1 FOR UPDATE OF p`,
      [req.params.id]
    );
    if (!payment.rowCount || payment.rows[0].status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Pending payment not found." });
    }
    const row = payment.rows[0];
    await client.query(
      "UPDATE payments SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3",
      [decision, req.session.userId, row.id]
    );
    if (decision === "approved") {
      await client.query(
        `INSERT INTO memberships (user_id, plan_id, payment_id, starts_at, expires_at, status)
         VALUES ($1, $2, $3, NOW(), NOW() + ($4 * INTERVAL '1 day'), 'active')`,
        [row.user_id, row.plan_id, row.id, row.duration_days]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, message: `Payment ${decision}.` });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Payment review error:", error);
    res.status(500).json({ success: false, message: "Unable to review payment." });
  } finally {
    client.release();
  }
});

router.get("/super-admin/check", requireSuperAdmin, (req, res) => {
  res.json({ success: true, message: "Super administrator access confirmed." });
});

module.exports = router;
