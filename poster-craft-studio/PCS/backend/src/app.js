const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const posterRoutes = require("./routes/posterroutes");
const errorHandler = require("./middleware/errorhandler");

const app = express();

const allowedOrigins = [
	"http://localhost:5173",
	"http://localhost:4173",
	"https://poster-craft-studio-fe.onrender.com",
];

if (process.env.FRONTEND_URL) {
	allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(cors({
	origin: (origin, callback) => {
		if (!origin || allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		return callback(new Error("Origin is not allowed by CORS"));
	},
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parses the Clerk auth token on incoming requests
app.use(clerkMiddleware());

app.get("/", (req, res) => {
	res.json({ status: "ok", service: "poster-craft-studio-api" });
});

app.use("/api", posterRoutes);

app.use(errorHandler);

module.exports = app;