"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1280, height: 800, title: "StockPilot Pro", show: false,
        webPreferences: { preload: path_1.default.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    win.once('ready-to-show', () => {
        win.show();
        win.webContents.openDevTools({ mode: 'detach' });
    });
    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://127.0.0.1:5173');
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    (0, database_1.initDB)();
    createWindow();
    electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow(); });
});
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
// --- IPC HANDLERS ---
electron_1.ipcMain.handle('db:get-warehouses', () => (0, database_1.getDB)().prepare('SELECT * FROM warehouses').all());
electron_1.ipcMain.handle('db:get-products', () => (0, database_1.getDB)().prepare(`SELECT p.*, w.name as warehouse_name FROM products p LEFT JOIN warehouses w ON p.warehouse_id = w.id`).all());
electron_1.ipcMain.handle('db:add-product', (_, product) => {
    try {
        const stmt = (0, database_1.getDB)().prepare(`INSERT INTO products (sku, name, description, category, purchase_price, selling_price, quantity, min_stock_threshold, warehouse_id) VALUES (@sku, @name, @description, @category, @purchase_price, @selling_price, @quantity, @min_stock_threshold, @warehouse_id)`);
        const info = stmt.run(product);
        return { success: true, id: info.lastInsertRowid };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:update-product', (_, product) => {
    try {
        const current = (0, database_1.getDB)().prepare('SELECT quantity, min_stock_threshold FROM products WHERE id = ?').get(product.id);
        if (product.quantity > product.min_stock_threshold && current.alert_acknowledged) {
            (0, database_1.getDB)().prepare('UPDATE products SET alert_acknowledged = 0 WHERE id = ?').run(product.id);
        }
        (0, database_1.getDB)().prepare(`UPDATE products SET sku=@sku, name=@name, category=@category, purchase_price=@purchase_price, selling_price=@selling_price, quantity=@quantity, min_stock_threshold=@min_stock_threshold, warehouse_id=@warehouse_id WHERE id=@id`).run(product);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:delete-product', (_, id) => {
    try {
        (0, database_1.getDB)().prepare('DELETE FROM products WHERE id = ?').run(id);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:transfer-stock', (_, { productId, fromWarehouseId, toWarehouseId, quantity, reason }) => {
    const db = (0, database_1.getDB)();
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND warehouse_id = ?').get(productId, fromWarehouseId);
        if (!product)
            return { success: false, error: "Product not found." };
        if (product.quantity < quantity)
            return { success: false, error: `Insufficient stock.` };
        const transferTransaction = db.transaction(() => {
            db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(product.quantity - quantity, productId);
            db.prepare('UPDATE products SET warehouse_id = ? WHERE id = ?').run(toWarehouseId, productId);
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, updated_stock, warehouse_id, reason) VALUES (?, 'Transfer Out', ?, ?, ?, ?, ?)`).run(productId, quantity, product.quantity, product.quantity - quantity, fromWarehouseId, reason);
            db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, updated_stock, warehouse_id, reason) VALUES (?, 'Transfer In', ?, ?, ?, ?, ?)`).run(productId, quantity, 0, quantity, toWarehouseId, reason);
        });
        transferTransaction();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:get-movements', () => {
    return (0, database_1.getDB)().prepare(`SELECT m.*, p.name as product_name, p.sku as product_sku, w.name as warehouse_name FROM stock_movements m JOIN products p ON m.product_id = p.id LEFT JOIN warehouses w ON m.warehouse_id = w.id ORDER BY m.timestamp DESC`).all();
});
electron_1.ipcMain.handle('db:get-orders', () => {
    return (0, database_1.getDB)().prepare(`SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count FROM orders o ORDER BY o.created_at DESC`).all();
});
electron_1.ipcMain.handle('db:create-order', (_, { customerName, items }) => {
    const db = (0, database_1.getDB)();
    try {
        const createTransaction = db.transaction(() => {
            const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const orderInfo = db.prepare('INSERT INTO orders (customer_name, status, total_amount) VALUES (?, ?, ?)').run(customerName, 'Pending', total);
            const orderId = orderInfo.lastInsertRowid;
            const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
            for (const item of items)
                itemStmt.run(orderId, item.product_id, item.quantity, item.unit_price);
            return orderId;
        });
        return { success: true, orderId: createTransaction() };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:process-order', (_, orderId) => {
    const db = (0, database_1.getDB)();
    try {
        const processTransaction = db.transaction(() => {
            const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
            if (order.status !== 'Pending')
                throw new Error("Only Pending orders can be processed");
            const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
            for (const item of items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                if (product.quantity < item.quantity)
                    throw new Error(`Insufficient stock for ${product.name}.`);
            }
            for (const item of items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                const newStock = product.quantity - item.quantity;
                db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newStock, item.product_id);
                db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, updated_stock, warehouse_id, reason) VALUES (?, 'Sale', ?, ?, ?, ?, ?)`).run(item.product_id, item.quantity, product.quantity, newStock, product.warehouse_id, `Order #${orderId}`);
            }
            db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('Completed', orderId);
        });
        processTransaction();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('db:get-alerts', () => {
    return (0, database_1.getDB)().prepare(`
    SELECT p.*, w.name as warehouse_name,
      CASE 
        WHEN p.quantity = 0 THEN 'Critical'
        WHEN p.quantity <= p.min_stock_threshold THEN 'Low'
      END as alert_severity
    FROM products p
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    WHERE p.quantity <= p.min_stock_threshold AND p.alert_acknowledged = 0
  `).all();
});
electron_1.ipcMain.handle('db:acknowledge-alert', (_, productId) => {
    try {
        (0, database_1.getDB)().prepare('UPDATE products SET alert_acknowledged = 1 WHERE id = ?').run(productId);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// --- ANALYTICS ---
electron_1.ipcMain.handle('db:get-analytics', () => {
    const db = (0, database_1.getDB)();
    const salesByDay = db.prepare(`
    SELECT DATE(created_at) as date, SUM(total_amount) as revenue 
    FROM orders 
    WHERE status = 'Completed' 
    GROUP BY DATE(created_at) 
    ORDER BY DATE(created_at) ASC 
    LIMIT 7
  `).all();
    const productsByCategory = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM products 
    GROUP BY category
  `).all();
    return { salesByDay, productsByCategory };
});
