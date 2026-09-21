import mongoose from "mongoose";
import crypto from "crypto";
import pool from "../src/config/mysql.js";
import dotenv from "dotenv";
dotenv.config();

export async function createMySQLAuthTables() {
  const connection = await pool.getConnection();
  try {
    console.log("Creating MySQL users and strategy_access_requests tables...");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        hasAccess BOOLEAN DEFAULT FALSE,
        isAdmin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS strategy_access_requests (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        admin_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        CONSTRAINT fk_sar_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("✅ MySQL auth tables initialized successfully.");
  } finally {
    connection.release();
  }
}

export async function migrateFromMongo() {
  await createMySQLAuthTables();

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/aarambh_tradex";
  try {
    console.log("Connecting to MongoDB to check for data to migrate...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log("Connected to MongoDB.");

    const mongoDb = mongoose.connection.db;
    const usersCollection = mongoDb.collection("users");
    const requestsCollection = mongoDb.collection("strategyaccesses");

    const mongoUsers = await usersCollection.find({}).toArray();
    console.log(`Found ${mongoUsers.length} users in MongoDB.`);

    for (const u of mongoUsers) {
      const id = String(u._id);
      const name = u.name;
      const email = String(u.email).toLowerCase().trim();
      const password = u.password;
      const hasAccess = Boolean(u.hasAccess);
      const isAdmin = Boolean(u.isAdmin);
      const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();
      const updatedAt = u.updatedAt ? new Date(u.updatedAt) : new Date();

      await pool.query(
        `INSERT INTO users (id, name, email, password, hasAccess, isAdmin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password = VALUES(password),
           hasAccess = VALUES(hasAccess),
           isAdmin = VALUES(isAdmin),
           updated_at = VALUES(updated_at)`,
        [id, name, email, password, hasAccess, isAdmin, createdAt, updatedAt]
      );
      console.log(`Migrated user: ${email} (${id})`);
    }

    const mongoRequests = await requestsCollection.find({}).toArray();
    console.log(`Found ${mongoRequests.length} strategy requests in MongoDB.`);

    for (const r of mongoRequests) {
      const id = String(r._id);
      const userId = String(r.user);
      const status = r.status || "pending";
      const requestedAt = r.requestedAt ? new Date(r.requestedAt) : new Date();
      const reviewedAt = r.reviewedAt ? new Date(r.reviewedAt) : null;
      const adminNote = r.adminNote || "";
      const createdAt = r.createdAt ? new Date(r.createdAt) : new Date();
      const updatedAt = r.updatedAt ? new Date(r.updatedAt) : new Date();

      // Ensure user exists before inserting request
      const [userExists] = await pool.query("SELECT id FROM users WHERE id = ?", [userId]);
      if (userExists.length > 0) {
        await pool.query(
          `INSERT INTO strategy_access_requests (id, user_id, status, requested_at, reviewed_at, admin_note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             status = VALUES(status),
             reviewed_at = VALUES(reviewed_at),
             admin_note = VALUES(admin_note),
             updated_at = VALUES(updated_at)`,
          [id, userId, status, requestedAt, reviewedAt, adminNote, createdAt, updatedAt]
        );
        console.log(`Migrated strategy request: ${id} for user ${userId}`);
      }
    }

    await mongoose.disconnect();
    console.log("✅ MongoDB migration completed successfully!");
  } catch (err) {
    console.log("Note on MongoDB reading:", err.message);
  }
}

// If run directly
if (process.argv[1]?.endsWith("migrate_mongo_to_mysql.js")) {
  migrateFromMongo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
