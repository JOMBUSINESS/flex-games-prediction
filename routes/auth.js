
const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/authController");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later."
  }
});

router.post("/register", loginLimiter, controller.register);
router.post("/login", loginLimiter, controller.login);
router.post("/admin/login", loginLimiter, controller.adminLogin);
router.get("/me", controller.me);
router.post("/logout", controller.logout);

module.exports = router;
