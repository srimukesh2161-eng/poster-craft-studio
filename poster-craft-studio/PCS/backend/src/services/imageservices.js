const fetch = require("node-fetch");
require("dns").setDefaultResultOrder("ipv4first");

const { InferenceClient } = require("@huggingface/inference");

const posterCategories = require("../data/posterCategories");
const stylePresets = require("../data/stylePresets");

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

const AVAILABLE_PROVIDERS = {
  "qwen-nvidia": { label: "Qwen (NVIDIA)", supportsReference: true },
  "huggingface": { label: "FLUX (Hugging Face)", supportsReference: false },
  "pollinations": { label: "Pollinations (Free)", supportsReference: false },
  "gemini": { label: "Gemini", supportsReference: true },
};

function buildPrompt(theme, category, mood) {
  const cat = posterCategories[category];
  const style = stylePresets[mood];
  if (!cat) throw new Error(`Unknown poster category: ${category}`);
  if (!style) throw new Error(`Unknown style/mood: ${mood}`);
  return `A professional poster design for: ${theme}. Poster category: ${category}. Composition: ${cat.composition}. Layout conventions: ${cat.conventions}. Color palette: ${style.palette}. Typography: ${style.typography}. Portfolio-quality, print-ready aesthetic.`;
}

async function optimizePromptWithHuggingFace(theme) {
  try {
    const result = await hf.chatCompletion({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      messages: [{
        role: "user",
        content: `Rewrite this poster concept into a vivid, specific creative brief. Add concrete visual details (focal elements, mood, composition ideas). Keep it under 50 words, no preamble, just the rewritten concept. Concept: "${theme}"`,
      }],
      max_tokens: 120,
    });
    return result.choices?.[0]?.message?.content?.trim() || theme;
  } catch (err) {
    console.error("PROMPT OPTIMIZATION ERROR:", err);
    return theme;
  }
}

async function generateWithPollinations(theme, category, mood) {
  const prompt = buildPrompt(theme, category, mood);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pollinations error (${response.status})`);
  const buffer = await response.arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;
}

async function generateWithHuggingFace(theme, category, mood) {
  const prompt = buildPrompt(theme, category, mood);
  const imageBlob = await hf.textToImage({
    model: "black-forest-labs/FLUX.1-schnell",
    inputs: prompt,
    provider: "hf-inference",
    parameters: { num_inference_steps: 4 },
  });
  const arrayBuffer = await imageBlob.arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}

async function generateWithNvidiaQwen(theme, category, mood, referenceFile) {
  const prompt = buildPrompt(theme, category, mood);
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error("NVIDIA_API_KEY is missing from environment variables.");
  }

  const body = { prompt, mode: "base", width: 1024, height: 1024, cfg_scale: 5, steps: 25, samples: 1 };

  if (referenceFile) {
    body.mode = "image-to-image";
    body.image = referenceFile.buffer.toString("base64");
    body.strength = 0.6;
  }

  let response = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && referenceFile) {
    console.warn("Image-to-image mode failed, retrying as text-only...");
    const fallbackBody = { ...body, mode: "base" };
    delete fallbackBody.image;
    delete fallbackBody.strength;
    response = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(fallbackBody),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const base64Data = data.artifacts?.[0]?.base64 || data.data?.[0]?.b64_json || data.image;
  if (!base64Data) throw new Error("No image data returned from NVIDIA API response.");
  return `data:image/jpeg;base64,${base64Data}`;
}

async function generateWithGemini(theme, category, mood, referenceFile) {
  throw new Error("Gemini provider not configured yet.");
}

async function generatePosterImage(theme, category, mood, referenceFile, useOptimization = false, provider = "qwen-nvidia") {
  if (!AVAILABLE_PROVIDERS[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const finalTheme = useOptimization ? await optimizePromptWithHuggingFace(theme) : theme;

  console.log(`Provider: ${provider} | Optimized: ${useOptimization}`);

  switch (provider) {
    case "qwen-nvidia":
      return await generateWithNvidiaQwen(finalTheme, category, mood, referenceFile);
    case "huggingface":
      return await generateWithHuggingFace(finalTheme, category, mood);
    case "pollinations":
      return await generateWithPollinations(finalTheme, category, mood);
    case "gemini":
      return await generateWithGemini(finalTheme, category, mood, referenceFile);
  }
}

module.exports = {
  generatePosterImage,
  generatePoster: generatePosterImage,
  AVAILABLE_PROVIDERS,
};