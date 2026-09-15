import * as strategyAccessService from "../services/strategyAccess.service.js";

/**
 * User endpoint: Request Strategy Access
 */
export const requestAccess = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const request = await strategyAccessService.createAccessRequest(userId);

        return res.status(201).json({
            success: true,
            message: "Strategy access request submitted successfully",
            data: { request }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * User endpoint: Get current user's strategy access requests status
 */
export const getMyStatus = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const requests = await strategyAccessService.getUserAccessRequests(userId);

        return res.status(200).json({
            success: true,
            data: {
                hasAccess: req.user.hasAccess,
                requests
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin endpoint: List all strategy access requests
 */
export const getAllRequests = async (req, res, next) => {
    try {
        const { status } = req.query;
        const requests = await strategyAccessService.getAllAccessRequests(status);

        return res.status(200).json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin endpoint: Accept or Decline a strategy access request
 */
export const handleRequestReview = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const { action, status, adminNote } = req.body;

        // Support either action or status in body
        const chosenAction = action || status;

        if (!chosenAction) {
            const error = new Error("Action or status field is required ('accept'/'approve' or 'decline'/'reject')");
            error.statusCode = 400;
            throw error;
        }

        const result = await strategyAccessService.reviewAccessRequest({
            requestId,
            action: chosenAction,
            adminNote
        });

        return res.status(200).json({
            success: true,
            message: `Strategy access request ${result.request.status} successfully`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
