import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

interface Warehouse { id: number; name: string; location: string; }
interface Product {
  id: number; sku: string; name: string; category: string;
  purchase_price: number; selling_price: number; quantity: number;
  min_stock_threshold: number; warehouse_id: number; warehouse_name: string;
}
interface Movement {
  id: number; product_id: number; product_name: string; product_sku: string;
  movement_type: string; quantity: number; previous_stock: number; updated_stock: number;
  warehouse_name: string; timestamp: string; reason: string;
}
interface Order {
  id: number; customer_name: string; status: string; total_amount: number; created_at: string; item_count: number;
}
interface CartItem {
  product_id: number; name: string; price: number; quantity: number; max_stock: number;
}
interface Alert {
  id: number; name: string; sku: string; quantity: number; min_stock_threshold: number; warehouse_name: string; alert_severity: 'Low' | 'Critical';
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'transfers' | 'movements' | 'orders' | 'alerts' | 'analytics'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analytics, setAnalytics] = useState<{ salesByDay: any[], productsByCategory: any[] }>({ salesByDay: [], productsByCategory: [] });
  const [loading, setLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ sku: '', name: '', category: '', purchase_price: '', selling_price: '', quantity: '', min_stock_threshold: '5', warehouse_id: '' });

  const [transferData, setTransferData] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reason: '' });

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');

  const loadData = async () => {
    try {
      if (!(window as any).api) { setIsElectron(false); setLoading(false); return; }
      const p = await (window as any).api.getProducts();
      const w = await (window as any).api.getWarehouses();
      const m = await (window as any).api.getMovements();
      const o = await (window as any).api.getOrders();
      const a = await (window as any).api.getAlerts();
      const an = await (window as any).api.getAnalytics();
      setProducts(p); setWarehouses(w); setMovements(m); setOrders(o); setAlerts(a); setAnalytics(an);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(window as any).api) return;
    const qty = parseInt(formData.quantity), pPrice = parseFloat(formData.purchase_price), sPrice = parseFloat(formData.selling_price);
    if (qty < 0 || pPrice < 0 || sPrice < 0) return alert('Values cannot be negative.');

    const payload = { id: editingId, sku: formData.sku, name: formData.name, description: '', category: formData.category, purchase_price: pPrice, selling_price: sPrice, quantity: qty, min_stock_threshold: parseInt(formData.min_stock_threshold), warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id) : null };
    const res = editingId ? await (window as any).api.updateProduct(payload) : await (window as any).api.addProduct(payload);
    
    if (res.success) {
      setShowForm(false); setEditingId(null); setFormData({ sku: '', name: '', category: '', purchase_price: '', selling_price: '', quantity: '', min_stock_threshold: '5', warehouse_id: '' }); loadData();
    } else alert('Error: ' + res.error);
  };

  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    const selectedProd = products.find(p => p.id.toString() === pid);
    const fromId = selectedProd?.warehouse_id ? String(selectedProd.warehouse_id) : '';
    setTransferData({ ...transferData, productId: pid, fromWarehouseId: fromId, toWarehouseId: '' });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.fromWarehouseId) return alert('This product is not assigned to any warehouse.');
    if (transferData.fromWarehouseId === transferData.toWarehouseId) return alert('Source and destination warehouses must be different.');
    
    const res = await (window as any).api.transferStock({
      productId: parseInt(transferData.productId), fromWarehouseId: parseInt(transferData.fromWarehouseId),
      toWarehouseId: parseInt(transferData.toWarehouseId), quantity: parseInt(transferData.quantity), reason: transferData.reason
    });

    if (res.success) {
      alert('Transfer completed successfully!');
      setTransferData({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reason: '' }); loadData();
    } else alert('Transfer Failed: ' + res.error);
  };

  const handleAddToCart = () => {
    if (!selectedProductId) return alert("Please select a product from the dropdown first.");
    const qty = parseInt(selectedQty);
    if (qty <= 0) return alert("Quantity must be at least 1.");
    
    const product = products.find(p => p.id.toString() === selectedProductId);
    if (!product) return;
    if (qty > product.quantity) return alert(`Only ${product.quantity} in stock.`);

    const existing = cart.find(c => c.product_id === product.id);
    if (existing) {
      alert("Product already in cart. Remove it first to change quantity.");
      return;
    }

    setCart([...cart, { product_id: product.id, name: product.name, price: product.selling_price, quantity: qty, max_stock: product.quantity }]);
    setSelectedProductId('');
    setSelectedQty('1');
  };

  const handleRemoveFromCart = (pid: number) => {
    setCart(cart.filter(c => c.product_id !== pid));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return alert("Please enter a customer name.");
    if (cart.length === 0) return alert("Cart is empty.");

    const items = cart.map(c => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.price }));
    const res = await (window as any).api.createOrder({ customerName, items });
    
    if (res.success) {
      alert("Order created successfully!");
      setShowOrderForm(false); setCustomerName(''); setCart([]); loadData();
    } else alert("Failed to create order: " + res.error);
  };

  const handleProcessOrder = async (orderId: number) => {
    if (!window.confirm("Are you sure you want to process this order? This will deduct stock.")) return;
    const res = await (window as any).api.processOrder(orderId);
    if (res.success) {
      alert("Order processed! Stock has been deducted.");
      loadData();
    } else {
      alert("Failed to process order: " + res.error);
    }
  };

  const handleAcknowledgeAlert = async (id: number) => {
    const res = await (window as any).api.acknowledgeAlert(id);
    if (res.success) loadData();
  };

  if (!isElectron) return <div style={{ padding: '50px', textAlign: 'center', color: '#fff' }}><h1>Please use the Electron Window</h1></div>;

  // Chart Data Preparation
  const barChartData = {
    labels: analytics.salesByDay.map(d => d.date),
    datasets: [
      {
        label: 'Revenue ($)',
        data: analytics.salesByDay.map(d => d.revenue),
        backgroundColor: 'rgba(76, 175, 80, 0.6)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1,
      },
    ],
  };

  const doughnutChartData = {
    labels: analytics.productsByCategory.map(d => d.category || 'Uncategorized'),
    datasets: [
      {
        label: 'Products',
        data: analytics.productsByCategory.map(d => d.count),
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">StockPilot Pro</div>
        <nav>
          <a className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</a>
          <a className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</a>
          <a className={`nav-link ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Inventory</a>
          <a className={`nav-link ${activeTab === 'transfers' ? 'active' : ''}`} onClick={() => setActiveTab('transfers')}>Warehouse Transfers</a>
          <a className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Order Management</a>
          <a className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>Low Stock Alerts</a>
          <a className={`nav-link ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>Movement History</a>
        </nav>
      </aside>

      <main className="content">
        {activeTab === 'dashboard' && (
          <div>
            <div className="header"><h1>System Overview</h1></div>
            <div className="data-card">
              <h2>Welcome to StockPilot Pro</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Database connected. {warehouses.length} warehouses. {products.length} products. {orders.length} orders.</p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <div className="header"><h1>Analytics Dashboard</h1></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              
              <div className="data-card">
                <h3>Revenue (Last 7 Days)</h3>
                <div style={{ height: '300px', marginTop: '20px' }}>
                  {analytics.salesByDay.length > 0 ? <Bar data={barChartData} options={{ maintainAspectRatio: false }} /> : <p className="empty-state">No sales data yet.</p>}
                </div>
              </div>

              <div className="data-card">
                <h3>Products by Category</h3>
                <div style={{ height: '300px', marginTop: '20px' }}>
                   {analytics.productsByCategory.length > 0 ? <Doughnut data={doughnutChartData} options={{ maintainAspectRatio: false }} /> : <p className="empty-state">No inventory data yet.</p>}
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <div className="header"><h1>Low Stock Alerts</h1></div>
            <div className="data-card">
              <table>
                <thead><tr><th>Product</th><th>Warehouse</th><th>Current Stock</th><th>Min Threshold</th><th>Severity</th><th>Action</th></tr></thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id}>
                      <td>{a.name} <br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{a.sku}</span></td>
                      <td>{a.warehouse_name}</td>
                      <td><span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{a.quantity}</span></td>
                      <td>{a.min_stock_threshold}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: a.alert_severity === 'Critical' ? 'var(--danger)' : '#ff9800' }}>
                          {a.alert_severity}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleAcknowledgeAlert(a.id)} style={{ background: '#444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Acknowledge</button>
                      </td>
                    </tr>
                  ))}
                  {alerts.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No active alerts. Inventory levels are healthy!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div>
            <div className="header">
              <h1>Inventory Management</h1>
              <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ sku: '', name: '', category: '', purchase_price: '', selling_price: '', quantity: '', min_stock_threshold: '5', warehouse_id: '' }); }}>{showForm ? 'Cancel' : '+ Add Product'}</button>
            </div>

            {showForm && (
              <div className="data-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                  <input required name="sku" placeholder="SKU (Unique)" value={formData.sku} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input name="category" placeholder="Category" value={formData.category} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }}>
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <input required type="number" min="0" step="0.01" name="purchase_price" placeholder="Purchase Price ($)" value={formData.purchase_price} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required type="number" min="0" step="0.01" name="selling_price" placeholder="Selling Price ($)" value={formData.selling_price} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required type="number" min="0" name="quantity" placeholder="Quantity" value={formData.quantity} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required type="number" min="0" name="min_stock_threshold" placeholder="Min Stock Threshold" value={formData.min_stock_threshold} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>Save Product</button>
                </form>
              </div>
            )}

            <div className="data-card">
              <table>
                <thead><tr><th>SKU</th><th>Product Name</th><th>Warehouse</th><th>Stock</th><th>Price</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td><span className="badge">{product.sku}</span></td>
                      <td>{product.name}</td>
                      <td>{product.warehouse_name || 'Unassigned'}</td>
                      <td><span style={{ color: product.quantity <= product.min_stock_threshold ? 'var(--danger)' : 'var(--text-main)' }}>{product.quantity}</span></td>
                      <td>${product.selling_price.toFixed(2)}</td>
                      <td>
                        <button onClick={() => { setEditingId(product.id); setFormData({ ...product, purchase_price: product.purchase_price.toString(), selling_price: product.selling_price.toString(), quantity: product.quantity.toString(), min_stock_threshold: product.min_stock_threshold.toString(), warehouse_id: product.warehouse_id?.toString() || '' }); setShowForm(true); }} style={{ background: '#444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', marginRight: '5px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={async () => { if(window.confirm('Delete?')) { await (window as any).api.deleteProduct(product.id); loadData(); } }} style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div>
            <div className="header"><h1>Warehouse Transfers</h1></div>
            <div className="data-card" style={{ maxWidth: '600px' }}>
              <h3>Transfer Stock</h3>
              <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                <select required value={transferData.productId} onChange={handleProductSelect} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }}>
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) - Current Stock: {p.quantity}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <select disabled value={transferData.fromWarehouseId} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#121212', color: '#9e9e9e', border: '1px solid #444', cursor: 'not-allowed' }}>
                    <option value="">From Warehouse (Auto)</option>
                    {warehouses.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                  </select>
                  <select required value={transferData.toWarehouseId} onChange={e => setTransferData({...transferData, toWarehouseId: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }}>
                    <option value="">To Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                  </select>
                </div>
                <input required type="number" min="1" placeholder="Quantity to Transfer" value={transferData.quantity} onChange={e => setTransferData({...transferData, quantity: e.target.value})} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                <input required placeholder="Reason" value={transferData.reason} onChange={e => setTransferData({...transferData, reason: e.target.value})} style={{ padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                <button type="submit" className="btn-primary">Execute Transfer</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="header">
              <h1>Order Management</h1>
              <button className="btn-primary" onClick={() => setShowOrderForm(!showOrderForm)}>{showOrderForm ? 'Cancel' : '+ Create Order'}</button>
            </div>

            {showOrderForm && (
              <div className="data-card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
                <h3>Create New Order</h3>
                <form onSubmit={handleCreateOrder} style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>Customer Name</label>
                    <input required placeholder="Enter customer name (e.g., John Doe)" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>Select Product</label>
                      <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }}>
                        <option value="">-- Choose a product --</option>
                        {products.length === 0 ? (
                           <option disabled>No products found in database!</option>
                        ) : (
                          products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.selling_price.toFixed(2)}) - In Stock: {p.quantity}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div style={{ width: '100px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>Qty</label>
                      <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                    </div>
                    <button type="button" onClick={handleAddToCart} className="btn-primary" style={{ padding: '10px 20px', height: '42px', marginTop: '22px' }}>Add to Order</button>
                  </div>

                  {cart.length > 0 && (
                    <table style={{ marginTop: '15px' }}>
                      <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th>Action</th></tr></thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.product_id}>
                            <td>{item.name}</td>
                            <td>${item.price.toFixed(2)}</td>
                            <td>{item.quantity}</td>
                            <td>${(item.price * item.quantity).toFixed(2)}</td>
                            <td><button type="button" onClick={() => handleRemoveFromCart(item.product_id)} style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                    <h4>Total: <span style={{ color: 'var(--accent)' }}>${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</span></h4>
                    <button type="submit" className="btn-primary" disabled={cart.length === 0}>Submit Order</button>
                  </div>
                </form>
              </div>
            )}

            <div className="data-card">
              <table>
                <thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.customer_name}</td>
                      <td>{new Date(o.created_at).toLocaleString()}</td>
                      <td>{o.item_count} items</td>
                      <td>${o.total_amount.toFixed(2)}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: o.status === 'Completed' ? 'var(--accent)' : '#ff9800' }}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.status === 'Pending' && (
                          <button onClick={() => handleProcessOrder(o.id)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Process</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'movements' && (
          <div>
            <div className="header"><h1>Stock Movement History</h1></div>
            <div className="data-card">
              <table>
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Warehouse</th><th>Reason</th></tr></thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td>{new Date(m.timestamp).toLocaleString()}</td>
                      <td>{m.product_name} <br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{m.product_sku}</span></td>
                      <td>
                        <span className="badge" style={{ backgroundColor: m.movement_type.includes('In') || m.movement_type === 'Sale' ? 'var(--accent)' : '#ff9800' }}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td>{m.quantity}</td>
                      <td>{m.warehouse_name}</td>
                      <td>{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;