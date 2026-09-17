# Poster Craft Studio

Poster Craft Studio is an AI-powered poster generation application that allows users to enter a poster concept, choose a category and style, optionally attach a reference image, and generate a poster using multiple AI image providers.

This project combines a React frontend with an Express backend and uses Clerk for authentication.

---

## 1. Project Overview

The app flow is:

1. User signs in using Clerk.
2. User enters a poster theme, selects a category and mood/style, and optionally uploads a reference image.
3. Frontend sends the request to the backend.
4. Backend validates the request and verifies the Clerk auth token.
5. Backend selects an AI provider and generates a poster image.
6. Result is displayed in the UI and can be downloaded.

The main functional areas are:
- frontend UI for poster generation
- backend API for generation and provider listing
- AI image generation service abstraction
- category and style metadata
- authentication middleware

---

## 2. Tech Stack

### Frontend
- React 19
- Vite 8
- Clerk React SDK
- Clerk themes
- Oxlint

### Backend
- Node.js
- Express 5
- CORS
- Multer
- Clerk Express SDK
- dotenv
- node-fetch
- @google/genai
- @huggingface/inference

### Deployment / hosting
- Netlify for frontend deployment configuration
- Render-style backend deployment assumption for API host

---

## 3. Project Structure

```text
poster-craft-studio/
├── netlify.toml
├── PCS/
│   ├── backend/
│   │   ├── package.json
│   │   ├── server.js
│   │   └── src/
│   │       ├── app.js
│   │       ├── config/
│   │       │   └── gemini.js
│   │       ├── controllers/
│   │       │   └── postercontroller.js
│   │       ├── data/
│   │       │   ├── postercategories.js
│   │       │   └── stylepresets.js
│   │       ├── middleware/
│   │       │   └── errorhandler.js
│   │       ├── routes/
│   │       │   └── posterroutes.js
│   │       └── services/
│   │           └── imageservices.js
│   └── frontend/
│       ├── index.html
│       ├── package.json
│       ├── README.md
│       ├── vite.config.js
│       ├── public/
│       └── src/
│           ├── App.css
│           ├── App.jsx
│           ├── index.css
│           ├── main.jsx
│           ├── assets/
│           ├── components/
│           │   ├── login.jsx
│           │   ├── PosterDisplay.jsx
│           │   └── Posterform.jsx
│           └── config/
│               └── api.js
```

---

## 4. Backend Architecture

### App bootstrap
The backend entry file is:
- `PCS/backend/server.js`

It loads environment variables and starts the Express app.

```js
require("dotenv").config();
const app = require("./src/app");
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
```

### Express app setup
The main app is configured in:
- `PCS/backend/src/app.js`

It includes:
- CORS configuration
- JSON body parsing
- URL-encoded body parsing
- Clerk middleware for auth
- health route at `/`
- API routing at `/api`
- centralized error handler

CORS allowlist includes:
- `http://localhost:5173`
- `http://localhost:4173`
- production Render frontend URL
- any additional configured `FRONTEND_URL`

### Routing
The route file is:
- `PCS/backend/src/routes/posterroutes.js`

This file registers:
- `POST /api/generate`
- `GET /api/providers`

The upload is handled using `multer` with in-memory storage so that reference images can be sent to the AI provider.

### Controller flow
The controller is located at:
- `PCS/backend/src/controllers/postercontroller.js`

Responsibilities:
- read authenticated user information from Clerk
- reject unauthenticated requests with `401`
- validate required fields: `theme`, `category`, and `mood`
- normalize the optimize flag
- choose a provider (default: `qwen-nvidia`)
- call `generatePoster(...)`
- return the image as JSON

Example logic:

```js
const { userId } = getAuth(req);
if (!userId) {
  return res.status(401).json({ error: "Unauthorized" });
}

const { theme, category, mood, optimize, provider } = req.body;
if (!theme || !category || !mood) {
  return res.status(400).json({ error: "Theme, category, and mood are required" });
}
```

### Error handling
The backend uses:
- `PCS/backend/src/middleware/errorhandler.js`

This middleware logs the error and responds with a JSON payload containing the error message and status code.

---

## 5. AI Image Generation Service

The service layer is implemented in:
- `PCS/backend/src/services/imageservices.js`

This is the core of the poster generation engine.

### Available providers
The app exposes a provider registry:

```js
const AVAILABLE_PROVIDERS = {
  "qwen-nvidia": { label: "Qwen (NVIDIA)", supportsReference: true },
  "huggingface": { label: "FLUX (Hugging Face)", supportsReference: false },
  "pollinations": { label: "Pollinations (Free)", supportsReference: false },
  "gemini": { label: "Gemini", supportsReference: true },
};
```

### Prompt construction
The prompt builder combines:
- category details
- mood/style guidance
- layout rules
- typography direction
- palette

This is generated using the data files:
- `PCS/backend/src/data/postercategories.js`
- `PCS/backend/src/data/stylepresets.js`

Example from the service:

```js
function buildPrompt(theme, category, mood) {
  const cat = posterCategories[category];
  const style = stylePresets[mood];

  return `A professional poster design for: ${theme}. Poster category: ${category}. Composition: ${cat.composition}. Layout conventions: ${cat.conventions}. Color palette: ${style.palette}. Typography: ${style.typography}. Portfolio-quality, print-ready aesthetic.`;
}
```

### Prompt optimization
If the toggle is enabled, the app sends the theme to a Hugging Face chat model and asks it to rewrite the brief into a more vivid poster prompt.

```js
async function optimizePromptWithHuggingFace(theme) {
  try {
    const result = await hf.chatCompletion({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      messages: [{
        role: "user",
        content: `Rewrite this poster concept into a vivid, specific creative brief...`,
      }],
      max_tokens: 120,
    });
    return result.choices?.[0]?.message?.content?.trim() || theme;
  } catch (err) {
    console.error("PROMPT OPTIMIZATION ERROR:", err);
    return theme;
  }
}
```

### Supported providers

#### 1. Qwen / NVIDIA
This is the default and most feature-complete implementation.

- uses the NVIDIA image generation endpoint
- supports text-to-image and image-to-image via reference uploads
- falls back from image-to-image mode to text-only if the first request fails

```js
const body = { prompt, mode: "base", width: 1024, height: 1024, cfg_scale: 5, steps: 25, samples: 1 };

if (referenceFile) {
  body.mode = "image-to-image";
  body.image = referenceFile.buffer.toString("base64");
  body.strength = 0.6;
}
```

#### 2. Hugging Face
Uses the FLUX model via `@huggingface/inference`.

#### 3. Pollinations
Calls the Pollinations image API and converts the response to a base64 data URL.

#### 4. Gemini
There is a Gemini config file:
- `PCS/backend/src/config/gemini.js`

But the actual generation function is still stubbed:

```js
async function generateWithGemini(theme, category, mood, referenceFile) {
  throw new Error("Gemini provider not configured yet.");
}
```

This means Gemini is present as a provider option but not fully functional yet.

---

## 6. Poster Categories Data

The poster category metadata is stored in:
- `PCS/backend/src/data/postercategories.js`

Example categories:
- Music/Concert
- Birthday/Celebration
- Corporate/Business Event
- Movie/Entertainment
- Product Launch/Brand
- Community/Social Cause
- Education/Academic
- Sports/Fitness
- Wedding/Invitation

Each item contains:
- `composition`: how the poster should be arranged
- `conventions`: design rules for layout and hierarchy

---

## 7. Style Presets Data

The preset data lives in:
- `PCS/backend/src/data/stylepresets.js`

Supported moods include:
- Dark
- Psychedelic
- Minimalistic
- Vintage
- Cover
- Pastel
- Neon
- Elegant
- Bold_Typographic

Each preset contains:
- `palette`: visual color strategy
- `typography`: typography direction

---

## 8. Frontend Architecture

### Main app
The app entry is:
- `PCS/frontend/src/App.jsx`

It performs the following:
- checks signed-in status with Clerk
- displays the sign-in page when signed out
- displays the generator interface when signed in
- retrieves a Clerk token using `getToken()`
- builds `FormData`
- calls the backend generation endpoint
- stores the returned image URL
- shows loading state while generation is running

Example request construction:

```js
const formData = new FormData();
formData.append("theme", theme);
formData.append("category", category);
formData.append("mood", mood);
formData.append("optimize", optimize);
formData.append("provider", provider);
if (referenceImage) formData.append("referenceImage", referenceImage);
```

### Auth UI
The login page is defined in:
- `PCS/frontend/src/components/login.jsx`

It renders Clerk’s `SignIn` component.

### Poster form
The core form component is:
- `PCS/frontend/src/components/Posterform.jsx`

This component includes:
- topic input
- category selector
- mood selector
- file upload for reference image
- preview of reference image
- prompt optimization toggle
- provider dropdown
- submit button

It also fetches provider metadata from the backend:

```js
useEffect(() => {
  fetch(`${API_BASE_URL}/api/providers`)
    .then((res) => res.json())
    .then((data) => setProviders(data.providers || []))
    .catch(() => setProviders([]));
}, []);
```

### Poster display
The generated image view is handled by:
- `PCS/frontend/src/components/PosterDisplay.jsx`

It does the following:
- shows a loading skeleton while generating
- renders the image when available
- enables a download button for the final poster

---

## 9. API Configuration

The frontend configuration file is:
- `PCS/frontend/src/config/api.js`

It chooses the backend URL as:

```js
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? "https://poster-craft-studio.onrender.com"
    : "http://localhost:8000"
);
```

This means:
- in development, it defaults to localhost:8000
- in production, it defaults to a Render deployment URL
- `VITE_API_URL` can override the default

---

## 10. Authentication

The application uses Clerk for both frontend and backend auth.

### Frontend auth
Configured in:
- `PCS/frontend/src/main.jsx`

```jsx
<ClerkProvider 
  appearance={{ baseTheme: dark }} 
  publishableKey={PUBLISHABLE_KEY} 
  afterSignOutUrl="/"
>
  <App />
</ClerkProvider>
```

### Backend auth
The Express app mounts Clerk middleware:

```js
app.use(clerkMiddleware());
```

Then each generation request checks `getAuth(req)` and requires a valid user ID.

---

## 11. Environment Variables

### Backend expected variables
The backend relies on environment values such as:
- `NVIDIA_API_KEY`
- `HUGGINGFACE_API_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`
- `FRONTEND_URL`
- `PORT`

### Frontend expected variables
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL` (optional)

The project includes local env files, which are used during development.

---

## 12. Deployment Setup

### Frontend deployment
The Netlify config file is:
- `netlify.toml`

```toml
[build]
  base = "PCS/frontend"
  command = "npm run build"
  publish = "dist"
```

This indicates the frontend is intended to be built from the `PCS/frontend` folder and deployed by Netlify.

### Backend deployment
The backend is intended to run as a separate Node service, likely on Render or a similar hosting platform, because:
- it uses `PORT` from environment
- the frontend production API URL points to a Render-hosted backend
- CORS is explicitly configured for the Render frontend URL

---

## 13. Strengths of the Project

- Clear separation of responsibilities between frontend and backend
- Support for multiple AI providers
- Reference image support
- Built-in prompt optimization
- Clerk authentication integrated in the app flow
- Simple and usable UI for poster generation

---

## 14. Current Limitations and Gaps

- Gemini provider is not yet fully implemented
- There are no automated tests configured
- The README in the frontend is only the default Vite template and is not customized to the app
- External API keys are required for all AI providers to function
- The app is stateless and does not use a database

---

## 15. How to Run the Project

### Backend
From the backend folder:

```bash
cd PCS/backend
npm install
npm start
```

### Frontend
From the frontend folder:

```bash
cd PCS/frontend
npm install
npm run dev
```

The frontend typically runs on:
- `http://localhost:5173`

---

## 16. Summary

Poster Craft Studio is a full-stack AI-powered poster generator. It gives users the ability to describe a theme, pick a poster style, optionally add a reference image, and generate a poster using multiple AI providers. The architecture is practical and modular, with clear separation between UI, route handling, auth, and image generation logic.

The project is functional as a prototype and has a strong base for future enhancement, especially around provider expansion, testing, and production hardening.

---

## 17. Quick Start Checklist

- Install backend dependencies
- Install frontend dependencies
- Add required environment variables
- Start backend
- Start frontend
- Sign in with Clerk
- Enter a poster idea
- Select category and mood
- Generate poster
- Download result

---

## 18. Useful Files for Developers

- `PCS/backend/src/services/imageservices.js` – core generation logic
- `PCS/backend/src/controllers/postercontroller.js` – request validation and auth guard
- `PCS/backend/src/routes/posterroutes.js` – route definitions
- `PCS/backend/src/data/postercategories.js` – poster category metadata
- `PCS/backend/src/data/stylepresets.js` – visual style presets
- `PCS/frontend/src/App.jsx` – main app orchestration
- `PCS/frontend/src/components/Posterform.jsx` – generator form UI
- `PCS/frontend/src/components/PosterDisplay.jsx` – image rendering and download
- `PCS/frontend/src/config/api.js` – API base URL config
