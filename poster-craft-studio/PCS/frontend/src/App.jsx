import React, { useState } from "react";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import Login from "./components/login";
import PosterForm from "./components/Posterform";
import PosterDisplay from "./components/PosterDisplay";
import "./App.css";

function App() {
  const { getToken } = useAuth();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async ({ theme, category, mood, referenceImage, optimize, provider }) => {
  setLoading(true);
  setImageUrl(null); // clear old image so skeleton shows cleanly
  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append("theme", theme);
    formData.append("category", category);
    formData.append("mood", mood);
    formData.append("optimize", optimize);
    formData.append("provider", provider);
    if (referenceImage) formData.append("referenceImage", referenceImage);

    const response = await fetch("http://localhost:8000/api/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    const data = await response.json();

    if (data.error) alert("Error: " + data.error);
    else setImageUrl(data.image);
  } catch (err) {
    alert("Something went wrong: " + err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <>
      <SignedOut>
        <Login />
      </SignedOut>

      <SignedIn>
        <div className="hero">
          <nav className="navbar">
            <div className="logo">Poster Craft Studio</div>
            <div className="nav-actions">
              <UserButton />
            </div>
          </nav>

          <div className="hero-content">
            <h1>Design Posters with AI</h1>
            <p className="hero-subtitle">
              Describe your idea, pick a vibe, get a poster in seconds
            </p>

            <div className="prompt-bar">
              <PosterForm onGenerate={handleGenerate} loading={loading} />
            </div>

            <div className="feature-row">
              <div className="feature-chip"><span className="dot"></span>5+ style presets</div>
              <div className="feature-chip"><span className="dot"></span>Reference image support</div>
              <div className="feature-chip"><span className="dot"></span>AI prompt optimization</div>
            </div>

            <PosterDisplay imageUrl={imageUrl} loading={loading} />
          </div>
        </div>
      </SignedIn>
    </>
  );
}

export default App;