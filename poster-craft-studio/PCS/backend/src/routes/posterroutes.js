const express = require("express");
const multer = require("multer");
const { handleGenerate, handleGetProviders } = require("../controllers/postercontroller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/generate", upload.single("referenceImage"), handleGenerate);
router.get("/providers", handleGetProviders);

module.exports = router;