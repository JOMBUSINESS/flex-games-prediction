const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/passwordResetController");

const router = express.Router();
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many password recovery attempts. Try again later." }
});

router.post("/forgot", resetLimiter, controller.forgotPassword);
router.post("/reset", resetLimiter, controller.resetPassword);

module.exports = router;
