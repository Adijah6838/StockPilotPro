import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getWarehouses: () => ipcRenderer.invoke('db:get-warehouses'),
  getProducts: () => ipcRenderer.invoke('db:get-products'),
  addProduct: (product: any) => ipcRenderer.invoke('db:add-product', product),
  updateProduct: (product: any) => ipcRenderer.invoke('db:update-product', product),
  deleteProduct: (id: number) => ipcRenderer.invoke('db:delete-product', id),
  transferStock: (data: any) => ipcRenderer.invoke('db:transfer-stock', data),
  getMovements: () => ipcRenderer.invoke('db:get-movements'),
  getOrders: () => ipcRenderer.invoke('db:get-orders'),
  createOrder: (data: any) => ipcRenderer.invoke('db:create-order', data),
  processOrder: (id: number) => ipcRenderer.invoke('db:process-order', id),
  getAlerts: () => ipcRenderer.invoke('db:get-alerts'),
  acknowledgeAlert: (id: number) => ipcRenderer.invoke('db:acknowledge-alert', id),
  getAnalytics: () => ipcRenderer.invoke('db:get-analytics')
})
