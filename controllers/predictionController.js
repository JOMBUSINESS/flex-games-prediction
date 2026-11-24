async function listPublicPredictions(req, res) {
  const db = req.app.locals.db;
  if (!db) return res.status(503).json({ success: false, message: "Database unavailable." });
  try {
    let hasVip = false;
    if (req.session?.userId) {
      if (["admin", "super_admin", "analyst", "support"].includes(req.session.role)) {
        hasVip = true;
      } else {
        const membership = await db.query(
          "SELECT 1 FROM memberships WHERE user_id = $1 AND status = 'active' AND starts_at <= NOW() AND expires_at > NOW() LIMIT 1",
          [req.session.userId]
        );
        hasVip = membership.rowCount > 0;
      }
    }
    const result = await db.query(
      `SELECT id, title, sport, event_name, prediction, odds, confidence,
              access_level, result, scheduled_at, created_at
       FROM predictions
       WHERE is_published = TRUE AND (access_level = 'free' OR $1 = TRUE)
       ORDER BY scheduled_at ASC NULLS LAST, created_at DESC
       LIMIT 100`,
      [hasVip]
    );
    return res.json({ success: true, predictions: result.rows });
  } catch (error) {
    console.error("Public predictions error:", error);
    return res.status(500).json({ success: false, message: "Unable to load predictions." });
  }
}

module.exports = { listPublicPredictions };
