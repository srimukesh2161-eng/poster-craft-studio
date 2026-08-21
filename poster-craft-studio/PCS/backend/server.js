require("dotenv").config();
const app = require("./src/app");

// Render dynamically assigns a PORT environment variable.
// Fall back to 8000 for local development.
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));