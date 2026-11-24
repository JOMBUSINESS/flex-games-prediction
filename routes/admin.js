
const express = require("express");
const { requireAdmin, requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

router.get("/overview", async (req, res) => {
  const db = req.app.locals.db;

  if (!db) {
    return res.status(503).json({ success: false, message: "Database unavailable." });
  }

  try {
    const [users, payments, predictions, memberships] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'user'"),
      db.query("SELECT COUNT(*)::int AS total FROM payments WHERE status = 'pending'"),
      db.query("SELECT COUNT(*)::int AS total FROM predictions"),
      db.query("SELECT COUNT(*)::int AS total FROM memberships WHERE status = 'active' AND expires_at > NOW()")
    ]);

    res.json({
      success: true,
      overview: {
        totalUsers: users.rows[0].total,
        pendingPayments: payments.rows[0].total,
        totalPredictions: predictions.rows[0].total,
        activeVipMembers: memberships.rows[0].total
      }
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ success: false, message: "Unable to load admin overview." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      `SELECT id, full_name, phone, country, role, status, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 100`
    );

    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Unable to load users." });
  }
});

// Reserved for super-admin-only management actions.
router.get("/super-admin/check", requireSuperAdmin, (req, res) => {
  res.json({ success: true, message: "Super administrator access confirmed." });
});

module.exports = router;
