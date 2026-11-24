const express = require("express");
const controller = require("../controllers/predictionController");
const router = express.Router();

router.get("/", controller.listPublicPredictions);

module.exports = router;
