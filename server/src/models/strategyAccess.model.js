import mongoose from "mongoose";

const strategyAccessSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"]
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        requestedAt: {
            type: Date,
            default: Date.now
        },
        reviewedAt: {
            type: Date
        },
        adminNote: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

const StrategyAccess = mongoose.model("StrategyAccess", strategyAccessSchema);

export default StrategyAccess;
