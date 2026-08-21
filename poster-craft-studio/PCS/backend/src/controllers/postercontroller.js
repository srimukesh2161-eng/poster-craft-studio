const { getAuth } = require("@clerk/express");
const { generatePoster, AVAILABLE_PROVIDERS } = require("../services/imageservices");

async function handleGenerate(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { theme, category, mood, optimize, provider } = req.body;

    if (!theme || !category || !mood) {
      return res.status(400).json({ error: "Theme, category, and mood are required" });
    }

    const useOptimization = optimize === "true" || optimize === true;
    const chosenProvider = provider || "qwen-nvidia";

    const image = await generatePoster(theme, category, mood, req.file, useOptimization, chosenProvider);
    res.json({ image });
  } catch (err) {
    next(err);
  }
}

function handleGetProviders(req, res) {
  const providers = Object.entries(AVAILABLE_PROVIDERS).map(([key, value]) => ({
    key,
    ...value,
  }));
  res.json({ providers });
}

module.exports = { handleGenerate, handleGetProviders };