import { useState, useEffect } from "react";

const categories = [
  "Music/Concert", "Birthday/Celebration", "Corporate/Business Event",
  "Movie/Entertainment", "Product Launch/Brand", "Community/Social Cause",
  "Education/Academic", "Sports/Fitness", "Wedding/Invitation"
];

const moods = [
  "Dark", "Psychedelic", "Minimalistic", "Vintage", "Cover",
  "Pastel", "Neon", "Elegant", "Bold_Typographic"
];

function PosterForm({ onGenerate, loading }) {
  const [theme, setTheme] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [mood, setMood] = useState(moods[0]);
  const [referenceImage, setReferenceImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [optimize, setOptimize] = useState(false);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState("qwen-nvidia");

  useEffect(() => {
    fetch("http://localhost:8000/api/providers")
      .then((res) => res.json())
      .then((data) => setProviders(data.providers || []))
      .catch(() => setProviders([]));
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReferenceImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeReference = () => {
    setReferenceImage(null);
    setPreviewUrl(null);
  };

  const handleSubmit = () => {
    if (!theme.trim()) {
      alert("Please enter a theme first.");
      return;
    }
    onGenerate({ theme, category, mood, referenceImage, optimize, provider });
  };

  const activeProvider = providers.find((p) => p.key === provider);

  return (
    <div className="prompt-inner">
      <input
        className="prompt-input"
        type="text"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="What would you like to design?"
      />

      {previewUrl && (
        <div className="reference-preview">
          <img src={previewUrl} alt="Reference preview" />
          <button type="button" className="remove-ref-btn" onClick={removeReference}>✕</button>
          <span className="reference-label">
            Reference attached
            {activeProvider && !activeProvider.supportsReference && (
              <span className="ref-warning"> — this model may ignore it</span>
            )}
          </span>
        </div>
      )}

      <div className="row-controls">
        <label className="optimize-toggle">
          <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
          Let AI improve my description
        </label>

        {providers.length > 0 && (
          <select className="provider-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        )}
      </div>

      <div className="prompt-controls">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={mood} onChange={(e) => setMood(e.target.value)}>
          {moods.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
        </select>

        <label className="file-pill">
          {referenceImage ? "Change Reference" : "Reference"}
          <input type="file" accept="image/*" onChange={handleFileChange} hidden />
        </label>

        <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? <span className="spinner"></span> : "↑"}
        </button>
      </div>
    </div>
  );
}

export default PosterForm;