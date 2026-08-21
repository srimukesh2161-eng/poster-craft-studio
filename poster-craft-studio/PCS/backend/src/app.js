const express = require("express");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const posterRoutes = require("./routes/posterroutes");
const errorHandler = require("./middleware/errorhandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Parses the Clerk auth token on incoming requests
app.use(clerkMiddleware());

app.use("/api", posterRoutes);

app.use(errorHandler);

module.exports = app;