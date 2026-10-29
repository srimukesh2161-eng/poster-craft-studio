const fetch = require("node-fetch");
require("dns").setDefaultResultOrder("ipv4first");

const { InferenceClient } = require("@huggingface/inference");

const posterCategories = require("../data/postercategories");
const stylePresets = require("../data/stylepresets");

const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

const DEFAULT_NVIDIA_MODEL = process.env.NVIDIA_MODEL || "black-forest-labs/flux.1-dev";
const NVIDIA_IMAGE_ENDPOINT = process.env.NVIDIA_IMAGE_ENDPOINT || `https://ai.api.nvidia.com/v1/genai/${DEFAULT_NVIDIA_MODEL}`;

const AVAILABLE_PROVIDERS = {
  "qwen-nvidia": { label: `NVIDIA Image Model (${DEFAULT_NVIDIA_MODEL})`, supportsReference: true },
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
    const error = new Error("NVIDIA_API_KEY is missing from environment variables.");
    error.statusCode = 503;
    throw error;
  }

  const modelName = process.env.NVIDIA_MODEL || "black-forest-labs/flux.1-dev";
  const endpoint = process.env.NVIDIA_IMAGE_ENDPOINT || `https://ai.api.nvidia.com/v1/genai/${modelName}`;

  console.log(`Calling NVIDIA model: ${modelName}`);
  console.log(`Using NVIDIA endpoint: ${endpoint}`);

  const body = { prompt, mode: "base", width: 1024, height: 1024, cfg_scale: 5, steps: 25, samples: 1 };

  if (referenceFile) {
    body.mode = "image-to-image";
    body.image = referenceFile.buffer.toString("base64");
    body.strength = 0.6;
  }

  let response = await fetch(endpoint, {
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
    response = await fetch(endpoint, {
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
    const error = new Error(`NVIDIA API Error (${response.status}) for model ${modelName}: ${errText}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  const base64Data = data.artifacts?.[0]?.base64 || data.data?.[0]?.b64_json || data.image;
  if (!base64Data) throw new Error("No image data returned from NVIDIA API response.");
  return `data:image/jpeg;base64,${base64Data}`;
}

async function generateWithGemini(theme, category, mood, referenceFile) {
  throw new Error("Gemini provider not configured yet.");
}

async function executeProvider(theme, category, mood, referenceFile, selectedProvider) {
  switch (selectedProvider) {
    case "qwen-nvidia":
      return await generateWithNvidiaQwen(theme, category, mood, referenceFile);
    case "huggingface":
      return await generateWithHuggingFace(theme, category, mood);
    case "pollinations":
      return await generateWithPollinations(theme, category, mood);
    case "gemini":
      return await generateWithGemini(theme, category, mood, referenceFile);
    default:
      throw new Error(`Unsupported provider: ${selectedProvider}`);
  }
}

function getProviderFallbackOrder(provider) {
  if (provider === "qwen-nvidia") {
    return ["qwen-nvidia"];
  }

  const order = [provider];
  const extras = ["qwen-nvidia", "pollinations", "huggingface", "gemini"];

  for (const candidate of extras) {
    if (candidate !== provider && !order.includes(candidate)) {
      order.push(candidate);
    }
  }

  return order;
}

async function generatePosterImage(theme, category, mood, referenceFile, useOptimization = false, provider = "qwen-nvidia") {
  if (!AVAILABLE_PROVIDERS[provider]) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const finalTheme = useOptimization ? await optimizePromptWithHuggingFace(theme) : theme;
  const attempts = getProviderFallbackOrder(provider);
  let lastError = null;

  for (const selectedProvider of attempts) {
    try {
      console.log(`Provider attempt: ${selectedProvider} | Optimized: ${useOptimization}`);
      return await executeProvider(finalTheme, category, mood, referenceFile, selectedProvider);
    } catch (err) {
      lastError = err;
      console.warn(`Provider ${selectedProvider} failed:`, err.message);
    }
  }

  const fallbackError = new Error(lastError ? lastError.message : "Image generation failed for all providers.");
  fallbackError.statusCode = lastError && lastError.statusCode ? lastError.statusCode : 502;
  throw fallbackError;
}

module.exports = {
  generatePosterImage,
  generatePoster: generatePosterImage,
  AVAILABLE_PROVIDERS,
};