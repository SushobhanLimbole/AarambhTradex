import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

/**
 * MySQL Connection Pool Configuration
 */
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "aarambh_tradex",
  port: Number(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  dateStrings: true, // Keep dates as 'YYYY-MM-DD' strings instead of converting to UTC Date objects
});

/**
 * Test MySQL Database Connection
 */
export const testMySQLConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Database connected successfully");
    connection.release();
    return true;
  } catch (error) {
    console.warn("⚠️ MySQL Connection warning:", error.message);
    return false;
  }
};

export default pool;
