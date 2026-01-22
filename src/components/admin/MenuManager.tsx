import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  available: boolean;
  featured: boolean;
}

const CATEGORIES = ['Wings', 'Gyros', 'Burgers', 'Sandwiches', 'Salads', 'Sides', 'Appetizers', 'Drinks'];

export default function MenuManager() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Wings',
    price: 0,
    available: true,
    featured: false
  });

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { error } = await supabase.from('menu_items').insert([formData]);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Menu item added!');
      setFormData({
        name: '',
        description: '',
        category: 'Wings',
        price: 0,
        available: true,
        featured: false
      });
      setShowForm(false);
      fetchMenuItems();
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm('Delete this menu item?')) {
      await supabase.from('menu_items').delete().eq('id', id);
      fetchMenuItems();
    }
  };

  const categorizedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(item => item.category === cat);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Menu Management</h2>
        <button onClick={() => setShowForm(!showForm)} className="form-button-small">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddItem} className="form-stack">
          <input
            type="text"
            placeholder="Item Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            className="form-input"
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="form-textarea"
            rows={2}
          />
          <div className="form-grid">
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="form-input"
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input
              type="number"
              placeholder="Price"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
              step="0.01"
              required
              className="form-input"
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.featured}
              onChange={(e) => setFormData({...formData, featured: e.target.checked})}
            />
            Featured Item
          </label>
          <button type="submit" className="form-button">Add to Menu</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </form>
      )}

      {Object.entries(categorizedItems).map(([category, categoryItems]) => (
        categoryItems.length > 0 && (
          <div key={category}>
            <h3>{category}</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.description}</td>
                      <td>${item.price.toFixed(2)}</td>
                      <td>{item.available ? '✅ Available' : '❌ Unavailable'}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ))}
    </div>
  );
}
