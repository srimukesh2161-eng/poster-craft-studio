const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? "https://poster-craft-studio.onrender.com"
    : "http://localhost:8000"
);

export default API_BASE_URL;