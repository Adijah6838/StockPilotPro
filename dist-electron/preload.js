"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    getWarehouses: () => electron_1.ipcRenderer.invoke('db:get-warehouses'),
    getProducts: () => electron_1.ipcRenderer.invoke('db:get-products'),
    addProduct: (product) => electron_1.ipcRenderer.invoke('db:add-product', product),
    updateProduct: (product) => electron_1.ipcRenderer.invoke('db:update-product', product),
    deleteProduct: (id) => electron_1.ipcRenderer.invoke('db:delete-product', id),
    transferStock: (data) => electron_1.ipcRenderer.invoke('db:transfer-stock', data),
    getMovements: () => electron_1.ipcRenderer.invoke('db:get-movements'),
    getOrders: () => electron_1.ipcRenderer.invoke('db:get-orders'),
    createOrder: (data) => electron_1.ipcRenderer.invoke('db:create-order', data),
    processOrder: (id) => electron_1.ipcRenderer.invoke('db:process-order', id),
    getAlerts: () => electron_1.ipcRenderer.invoke('db:get-alerts'),
    acknowledgeAlert: (id) => electron_1.ipcRenderer.invoke('db:acknowledge-alert', id),
    getAnalytics: () => electron_1.ipcRenderer.invoke('db:get-analytics')
});
