
const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/otpController");

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

router.post("/request", otpLimiter, controller.requestOtp);
router.post("/verify", otpLimiter, controller.verifyOtp);

module.exports = router;
