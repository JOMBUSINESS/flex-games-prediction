
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Administrator login required."
    });
  }

  const allowedRoles = ["admin", "super_admin", "analyst", "support"];

  if (!allowedRoles.includes(req.session.role)) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to access this area."
    });
  }

  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Login required."
    });
  }

  if (req.session.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Super administrator permission required."
    });
  }

  next();
}

async function requireVip(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Please log in to access VIP predictions."
    });
  }

  const db = req.app.locals.db;

  if (!db) {
    return res.status(503).json({
      success: false,
      message: "VIP service is temporarily unavailable."
    });
  }

  try {
    const result = await db.query(
      `SELECT id
       FROM memberships
       WHERE user_id = $1
         AND status = 'active'
         AND starts_at <= NOW()
         AND expires_at > NOW()
       ORDER BY expires_at DESC
       LIMIT 1`,
      [req.session.userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({
        success: false,
        message: "An active VIP subscription is required."
      });
    }

    next();
  } catch (error) {
    console.error("VIP authorization error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify VIP membership."
    });
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireVip
};
