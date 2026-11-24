const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/authController");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." }
});

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.post("/admin/login", authLimiter, controller.adminLogin);
router.get("/me", controller.me);
router.post("/logout", controller.logout);

module.exports = router;
