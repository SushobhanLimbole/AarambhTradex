import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/aarambh_tradex";
        await mongoose.connect(uri);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.log("Error while connecting to the server ", error);
        process.exit(1);
    }
}

export default connectDB;