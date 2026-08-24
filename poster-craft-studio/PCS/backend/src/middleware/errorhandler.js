function errorHandler(err, req, res, next) {
  console.error(err.stack);
  if (req.headers.origin === "https://poster-craft-studio-fe.onrender.com") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  }
  res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
}

module.exports = errorHandler;
