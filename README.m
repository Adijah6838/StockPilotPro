# StockPilot Pro - Intelligent Inventory & Order Management

StockPilot Pro is a standalone Windows desktop application designed for medium-sized distribution companies. It centralizes inventory operations, tracks stock movements across multiple warehouses, manages customer orders, and provides real-time analytics.

## Core Features
- **Inventory Management:** Register, edit, and delete products with SKU validation and stock tracking.
- **Multi-Warehouse Transfers:** Securely transfer stock between warehouses using atomic SQLite transactions to ensure data consistency.
- **Order Management:** Create customer orders, manage a shopping cart, calculate totals automatically, and process orders to deduct stock.
- **Stock Movement Tracking:** An immutable transaction history logs every sale, transfer, and adjustment.
- **Automated Low-Stock Alerts:** Automatically flags products approaching their minimum stock threshold with "Low" or "Critical" severities.
- **Analytics Dashboard:** Interactive Chart.js visualizations showing 7-day revenue and product distribution by category.

## Technology Stack
- **Electron.js** (Desktop Runtime)
- **React + Vite** (Frontend UI)
- **TypeScript** (Strongly-typed logic)
- **Node.js** (Backend Process)
- **SQLite (better-sqlite3)** (Local Relational Database)
- **Chart.js** (Data Visualization)

## Getting Started

### Prerequisites
You need [Node.js](https://nodejs.org/) installed on your computer.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/StockPilotPro.git