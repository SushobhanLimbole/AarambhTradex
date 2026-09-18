import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import strategyAccessRoutes from "./routes/strategyAccess.routes.js";
import stockDataRoutes from "./routes/stockData.routes.js";
import screenerRoutes from "./routes/screener.routes.js";
import strategyCalculationRoutes from "./routes/strategyCalculation.routes.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req, res) => {
    res.json({ message: "Health is good" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/strategy-access", strategyAccessRoutes);
app.use("/api/strategy", strategyCalculationRoutes);
app.use("/api/stocks", stockDataRoutes);
app.use("/api/screener", screenerRoutes);

// Global Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;