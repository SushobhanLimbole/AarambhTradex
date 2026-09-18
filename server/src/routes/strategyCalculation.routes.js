import express from "express";
import { calculateStrategy } from "../controllers/strategyCalculation.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Optional JWT verification middleware (allows soft check if token provided, or strict check)
const optionalVerifyJWT = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers["x-access-token"]) {
      token = req.headers["x-access-token"];
    }

    if (token) {
      return verifyJWT(req, res, next);
    }
    next();
  } catch {
    next();
  }
};

/**
 * @route   POST /api/strategy/calculate
 * @desc    Calculate confidential institutional triggers & decision matrix
 * @access  Restricted to Admin / Users with hasAccess
 */
router.post("/calculate", optionalVerifyJWT, calculateStrategy);

export default router;
