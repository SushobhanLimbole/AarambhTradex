import pool from "../config/mysql.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export class User {
  constructor(data = {}) {
    this._id = data.id || data._id || crypto.randomBytes(12).toString("hex");
    this.id = this._id;
    this.name = data.name || "";
    this.email = (data.email || "").toLowerCase().trim();
    this.password = data.password || "";
    this.hasAccess = Boolean(data.hasAccess);
    this.isAdmin = Boolean(data.isAdmin);
    this.createdAt = data.created_at || data.createdAt || new Date();
    this.updatedAt = data.updated_at || data.updatedAt || new Date();
  }

  /**
   * Compare candidate plaintext password with stored hash
   */
  async comparePassword(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Convert user instance to JSON without password
   */
  toJSON() {
    return {
      id: this.id,
      _id: this.id,
      name: this.name,
      email: this.email,
      hasAccess: this.hasAccess,
      isAdmin: this.isAdmin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Save (insert or update) this user instance in MySQL
   */
  async save() {
    // If password is not yet a bcrypt hash ($2a$ or $2b$), hash it
    if (this.password && !this.password.startsWith("$2a$") && !this.password.startsWith("$2b$")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE id = ?", [this.id]);
    if (existing && existing.length > 0) {
      await pool.query(
        `UPDATE users
         SET name = ?, email = ?, password = ?, hasAccess = ?, isAdmin = ?, updated_at = NOW()
         WHERE id = ?`,
        [this.name, this.email, this.password, this.hasAccess ? 1 : 0, this.isAdmin ? 1 : 0, this.id]
      );
    } else {
      await pool.query(
        `INSERT INTO users (id, name, email, password, hasAccess, isAdmin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [this.id, this.name, this.email, this.password, this.hasAccess ? 1 : 0, this.isAdmin ? 1 : 0]
      );
    }
    return this;
  }

  /**
   * Find a single user by criteria (email, id, isAdmin, etc.)
   */
  static async findOne(query = {}) {
    if (query.email) {
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [query.email.trim()]
      );
      if (rows && rows.length > 0) {
        return new User(rows[0]);
      }
      return null;
    }

    if (query.id || query._id) {
      return await this.findById(query.id || query._id);
    }

    if (query.isAdmin !== undefined) {
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE isAdmin = ? LIMIT 1",
        [query.isAdmin ? 1 : 0]
      );
      if (rows && rows.length > 0) {
        return new User(rows[0]);
      }
      return null;
    }

    return null;
  }

  /**
   * Find user by primary ID
   */
  static async findById(id) {
    if (!id) return null;
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [String(id)]
    );
    if (rows && rows.length > 0) {
      return new User(rows[0]);
    }
    return null;
  }

  /**
   * Find and update user by ID
   */
  static async findByIdAndUpdate(id, updates = {}, options = {}) {
    if (!id) return null;
    const user = await this.findById(id);
    if (!user) return null;

    if (updates.hasAccess !== undefined) {
      user.hasAccess = Boolean(updates.hasAccess);
    }
    if (updates.isAdmin !== undefined) {
      user.isAdmin = Boolean(updates.isAdmin);
    }
    if (updates.name !== undefined) {
      user.name = updates.name;
    }
    if (updates.password !== undefined) {
      user.password = updates.password;
    }

    await user.save();
    return user;
  }

  /**
   * Find all users matching optional filter
   */
  static async find(query = {}) {
    let sql = "SELECT * FROM users WHERE 1=1";
    const params = [];

    if (query.isAdmin !== undefined) {
      sql += " AND isAdmin = ?";
      params.push(query.isAdmin ? 1 : 0);
    }
    if (query.hasAccess !== undefined) {
      sql += " AND hasAccess = ?";
      params.push(query.hasAccess ? 1 : 0);
    }

    const [rows] = await pool.query(sql, params);
    return rows.map((r) => new User(r));
  }

  /**
   * Delete user by ID
   */
  static async deleteById(id) {
    if (!id) return false;
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [String(id)]);
    return result.affectedRows > 0;
  }

  /**
   * Ensure users table exists in MySQL
   */
  static async initTable() {
    await pool.query(`
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
  }
}

export default User;
