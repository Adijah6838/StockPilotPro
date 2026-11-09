"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = initDB;
exports.getDB = getDB;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
let db;
function initDB() {
    const dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'stockpilot.db');
    db = new better_sqlite3_1.default(dbPath);
    db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_threshold INTEGER NOT NULL DEFAULT 5,
      warehouse_id INTEGER,
      alert_acknowledged INTEGER DEFAULT 0,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL, 
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      updated_stock INTEGER NOT NULL,
      warehouse_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      total_amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);
    // Try to add alert_acknowledged column if it doesn't exist (for existing databases)
    try {
        db.exec(`ALTER TABLE products ADD COLUMN alert_acknowledged INTEGER DEFAULT 0;`);
    }
    catch (e) {
        // Column already exists, ignore error
    }
    // Seed Warehouses & Products
    const checkWarehouses = db.prepare('SELECT count(*) as count FROM warehouses').get();
    if (checkWarehouses.count === 0) {
        db.exec(`
      INSERT INTO warehouses (name, location) VALUES ('Main Warehouse', 'New York');
      INSERT INTO warehouses (name, location) VALUES ('West Coast Hub', 'Los Angeles');
    `);
    }
    const checkProducts = db.prepare('SELECT count(*) as count FROM products').get();
    if (checkProducts.count === 0) {
        db.exec(`
      INSERT INTO products (sku, name, category, purchase_price, selling_price, quantity, min_stock_threshold, warehouse_id)
      VALUES ('SKU-001', 'Wireless Mouse', 'Electronics', 15.00, 25.00, 50, 10, 1);
      
      INSERT INTO products (sku, name, category, purchase_price, selling_price, quantity, min_stock_threshold, warehouse_id)
      VALUES ('SKU-002', 'Mechanical Keyboard', 'Electronics', 45.00, 80.00, 5, 10, 2);
    `);
    }
    return db;
}
function getDB() {
    if (!db)
        throw new Error("Database not initialized yet.");
    return db;
}
