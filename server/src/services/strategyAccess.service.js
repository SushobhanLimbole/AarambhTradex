import StrategyAccess from "../models/strategyAccess.model.js";
import User from "../models/user.model.js";

/**
 * Request strategy access for a user
 */
export const createAccessRequest = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    if (user.hasAccess) {
        const error = new Error("User already has strategy access");
        error.statusCode = 400;
        throw error;
    }

    const existingPendingRequest = await StrategyAccess.findOne({
        user: userId,
        status: "pending"
    });

    if (existingPendingRequest) {
        const error = new Error("You already have a pending strategy access request");
        error.statusCode = 400;
        throw error;
    }

    const request = new StrategyAccess({
        user: userId,
        status: "pending",
        requestedAt: new Date()
    });

    await request.save();
    return request;
};

/**
 * Get access requests for a specific user
 */
export const getUserAccessRequests = async (userId) => {
    return await StrategyAccess.find({ user: userId }).sort({ createdAt: -1 });
};

/**
 * Get all strategy access requests (Admin function)
 */
export const getAllAccessRequests = async (statusFilter) => {
    const filter = {};
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
        filter.status = statusFilter;
    }

    return await StrategyAccess.find(filter)
        .populate("user", "name email hasAccess isAdmin")
        .sort({ createdAt: -1 });
};

/**
 * Accept or Decline a strategy access request (Admin function)
 */
export const reviewAccessRequest = async ({ requestId, action, adminNote = "" }) => {
    const normalizedAction = action?.toLowerCase();
    
    // Support either action ("accept"/"decline" or "approve"/"reject") or status ("approved"/"rejected")
    let newStatus;
    if (normalizedAction === "accept" || normalizedAction === "approve" || normalizedAction === "approved") {
        newStatus = "approved";
    } else if (normalizedAction === "decline" || normalizedAction === "reject" || normalizedAction === "rejected") {
        newStatus = "rejected";
    } else {
        const error = new Error("Invalid action. Must be 'accept' ('approved') or 'decline' ('rejected')");
        error.statusCode = 400;
        throw error;
    }

    const accessRequest = await StrategyAccess.findById(requestId);
    if (!accessRequest) {
        const error = new Error("Strategy access request not found");
        error.statusCode = 404;
        throw error;
    }

    accessRequest.status = newStatus;
    accessRequest.reviewedAt = new Date();
    if (adminNote) {
        accessRequest.adminNote = adminNote;
    }

    await accessRequest.save();

    // Update target user's hasAccess property
    const hasAccessValue = newStatus === "approved";
    const updatedUser = await User.findByIdAndUpdate(
        accessRequest.user,
        { hasAccess: hasAccessValue },
        { returnDocument: "after" }
    );

    return {
        request: accessRequest,
        user: updatedUser
    };
};
