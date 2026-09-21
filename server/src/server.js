import app from "./app.js";
import connectDB from "./config/db.js";
import { testMySQLConnection } from "./config/mysql.js";
import { startCronJobs } from "./services/cronScheduler.service.js";

const startServer = async () => {
    try {
        await connectDB();
        await testMySQLConnection();

        // Start Automated EOD & Reconciliation Cron Jobs
        startCronJobs();

        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        const shutdown = () => {
            console.log('Shutting down server...');
            server.close(() => {
                console.log('Server closed properly');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        console.error("Error while starting the server", error.message);
        process.exit(1);
    }
}

startServer();