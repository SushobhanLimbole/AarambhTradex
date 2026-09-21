import pool from "../config/mysql.js";
import crypto from "crypto";

export class StrategyAccess {
  constructor(data = {}) {
    this._id = data.id || data._id || crypto.randomBytes(12).toString("hex");
    this.id = this._id;
    this.user = data.user_id || data.user || null;
    this.status = data.status || "pending";
    this.requestedAt = data.requested_at || data.requestedAt || new Date();
    this.reviewedAt = data.reviewed_at || data.reviewedAt || null;
    this.adminNote = data.admin_note || data.adminNote || "";
    this.createdAt = data.created_at || data.createdAt || new Date();
    this.updatedAt = data.updated_at || data.updatedAt || new Date();

    // If populated user data passed in
    if (data.user_name || data.userName) {
      this.user = {
        _id: data.user_id || data.user,
        id: data.user_id || data.user,
        name: data.user_name || data.userName,
        email: data.user_email || data.userEmail,
        hasAccess: Boolean(data.user_hasAccess ?? data.userHasAccess),
        isAdmin: Boolean(data.user_isAdmin ?? data.userIsAdmin),
      };
    }
  }

  /**
   * Save (insert or update) this strategy access request in MySQL
   */
  async save() {
    const userId = typeof this.user === "object" && this.user !== null ? (this.user.id || this.user._id) : this.user;

    const [existing] = await pool.query(
      "SELECT id FROM strategy_access_requests WHERE id = ?",
      [this.id]
    );

    if (existing && existing.length > 0) {
      await pool.query(
        `UPDATE strategy_access_requests
         SET status = ?, reviewed_at = ?, admin_note = ?, updated_at = NOW()
         WHERE id = ?`,
        [this.status, this.reviewedAt, this.adminNote, this.id]
      );
    } else {
      await pool.query(
        `INSERT INTO strategy_access_requests (id, user_id, status, requested_at, reviewed_at, admin_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [this.id, userId, this.status, this.requestedAt, this.reviewedAt, this.adminNote]
      );
    }
    return this;
  }

  /**
   * Find a single strategy access request
   */
  static async findOne(query = {}) {
    let sql = "SELECT * FROM strategy_access_requests WHERE 1=1";
    const params = [];

    if (query.user) {
      const userId = typeof query.user === "object" ? (query.user.id || query.user._id) : query.user;
      sql += " AND user_id = ?";
      params.push(String(userId));
    }

    if (query.status) {
      sql += " AND status = ?";
      params.push(query.status);
    }

    sql += " ORDER BY created_at DESC LIMIT 1";

    const [rows] = await pool.query(sql, params);
    if (rows && rows.length > 0) {
      return new StrategyAccess(rows[0]);
    }
    return null;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    if (!id) return null;
    const [rows] = await pool.query(
      "SELECT * FROM strategy_access_requests WHERE id = ? LIMIT 1",
      [String(id)]
    );
    if (rows && rows.length > 0) {
      return new StrategyAccess(rows[0]);
    }
    return null;
  }

  /**
   * Find multiple requests with optional populate query helper
   */
  static find(query = {}) {
    let shouldPopulate = false;
    let populateFields = "";
    let sortOrder = "DESC";

    const executor = async () => {
      let sql = "";
      const params = [];

      if (shouldPopulate) {
        sql = `
          SELECT sar.*, u.name AS user_name, u.email AS user_email, u.hasAccess AS user_hasAccess, u.isAdmin AS user_isAdmin
          FROM strategy_access_requests sar
          LEFT JOIN users u ON sar.user_id = u.id
          WHERE 1=1
        `;
      } else {
        sql = "SELECT * FROM strategy_access_requests WHERE 1=1";
      }

      if (query.user) {
        const userId = typeof query.user === "object" ? (query.user.id || query.user._id) : query.user;
        sql += shouldPopulate ? " AND sar.user_id = ?" : " AND user_id = ?";
        params.push(String(userId));
      }

      if (query.status) {
        sql += shouldPopulate ? " AND sar.status = ?" : " AND status = ?";
        params.push(query.status);
      }

      sql += ` ORDER BY ${shouldPopulate ? "sar.created_at" : "created_at"} ${sortOrder}`;

      const [rows] = await pool.query(sql, params);
      return rows.map((r) => new StrategyAccess(r));
    };

    // Return thenable query builder supporting .populate() and .sort()
    const queryBuilder = {
      populate: (field, select) => {
        if (field === "user") {
          shouldPopulate = true;
          populateFields = select;
        }
        return queryBuilder;
      },
      sort: (sortObj = {}) => {
        if (sortObj.createdAt === 1) sortOrder = "ASC";
        else sortOrder = "DESC";
        return queryBuilder;
      },
      then: (resolve, reject) => executor().then(resolve, reject),
      catch: (reject) => executor().catch(reject),
    };

    return queryBuilder;
  }

  /**
   * Initialize table in MySQL
   */
  static async initTable() {
    await pool.query(`
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
  }
}

export default StrategyAccess;
