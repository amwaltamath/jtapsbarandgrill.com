import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface BeerItem {
  id: number;
  name: string;
  brewery: string;
  style: string;
  description: string;
  price: number | null;
  abv: number | null;
  ibu: number | null;
  serving: string;
  available: boolean;
  featured: boolean;
  sort_order: number;
}

const STYLES = [
  'IPA', 'Double IPA', 'Hazy IPA', 'Pale Ale', 'Lager', 'Pilsner',
  'Wheat', 'Stout', 'Porter', 'Amber', 'Red Ale', 'Brown Ale',
  'Blonde Ale', 'Sour', 'Saison', 'Belgian', 'Kolsch', 'Hefeweizen',
  'Cider', 'Seltzer', 'Other'
];

const SERVINGS = ['Draft', 'Bottle', 'Can', 'Crowler', 'Growler'];

const defaultFormData = {
  name: '',
  brewery: '',
  style: 'IPA',
  description: '',
  price: '',
  abv: '',
  ibu: '',
  serving: 'Draft',
  available: true,
  featured: false,
  sort_order: 0
};

export default function BeerMenuManager() {
  const [items, setItems] = useState<BeerItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ ...defaultFormData });

  useEffect(() => {
    fetchBeers();
  }, []);

  const fetchBeers = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('beer_menu')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('style', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supabase) {
      setError('Supabase not configured');
      return;
    }

    const payload = {
      name: formData.name,
      brewery: formData.brewery,
      style: formData.style,
      description: formData.description,
      price: formData.price ? parseFloat(String(formData.price)) : null,
      abv: formData.abv ? parseFloat(formData.abv as string) : null,
      ibu: formData.ibu ? parseInt(formData.ibu as string, 10) : null,
      serving: formData.serving,
      available: formData.available,
      featured: formData.featured,
      sort_order: formData.sort_order,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      const { error } = await supabase
        .from('beer_menu')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        setError(error.message);
      } else {
        setSuccess('Beer updated!');
        resetForm();
        fetchBeers();
      }
    } else {
      const { error } = await supabase.from('beer_menu').insert([payload]);

      if (error) {
        setError(error.message);
      } else {
        setSuccess('Beer added!');
        resetForm();
        fetchBeers();
      }
    }
  };

  const handleEdit = (item: BeerItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      brewery: item.brewery || '',
      style: item.style,
      description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      abv: item.abv != null ? String(item.abv) : '',
      ibu: item.ibu != null ? String(item.ibu) : '',
      serving: item.serving || 'Draft',
      available: item.available,
      featured: item.featured,
      sort_order: item.sort_order || 0
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this beer?')) {
      if (!supabase) {
        setError('Supabase not configured');
        return;
      }
      await supabase.from('beer_menu').delete().eq('id', id);
      fetchBeers();
    }
  };

  const toggleAvailability = async (item: BeerItem) => {
    if (!supabase) return;
    await supabase
      .from('beer_menu')
      .update({ available: !item.available, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    fetchBeers();
  };

  const resetForm = () => {
    setFormData({ ...defaultFormData });
    setEditingId(null);
    setShowForm(false);
  };

  const groupedByServing = SERVINGS.reduce((acc, serving) => {
    acc[serving] = items.filter(item => item.serving === serving);
    return acc;
  }, {} as Record<string, BeerItem[]>);

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Beer Menu</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a
            href="/beer-menu-tv"
            target="_blank"
            rel="noopener noreferrer"
            className="form-button-small"
            style={{ textDecoration: 'none', background: '#2196F3' }}
          >
            📺 Open TV Display
          </a>
          <button onClick={() => { showForm ? resetForm() : setShowForm(true); }} className="form-button-small">
            {showForm ? 'Cancel' : '+ Add Beer'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-stack">
          <input
            type="text"
            placeholder="Beer Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="form-input"
          />
          <input
            type="text"
            placeholder="Brewery"
            value={formData.brewery}
            onChange={(e) => setFormData({ ...formData, brewery: e.target.value })}
            className="form-input"
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="form-textarea"
            rows={2}
          />
          <div className="form-grid">
            <select
              value={formData.style}
              onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              className="form-input"
            >
              {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={formData.serving}
              onChange={(e) => setFormData({ ...formData, serving: e.target.value })}
              className="form-input"
            >
              {SERVINGS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <input
              type="number"
              placeholder="Price (optional)"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              step="0.01"
              className="form-input"
            />
            <input
              type="number"
              placeholder="ABV %"
              value={formData.abv}
              onChange={(e) => setFormData({ ...formData, abv: e.target.value })}
              step="0.1"
              className="form-input"
            />
            <input
              type="number"
              placeholder="IBU"
              value={formData.ibu}
              onChange={(e) => setFormData({ ...formData, ibu: e.target.value })}
              className="form-input"
            />
            <input
              type="number"
              placeholder="Sort Order"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })}
              className="form-input"
            />
          </div>
          <div className="form-grid">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.available}
                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
              />
              Available
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              />
              Featured
            </label>
          </div>
          <button type="submit" className="form-button">
            {editingId ? 'Update Beer' : 'Add Beer'}
          </button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </form>
      )}

      {Object.entries(groupedByServing).map(([serving, servingItems]) =>
        servingItems.length > 0 && (
          <div key={serving} style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', width: '24px', height: '2px', background: '#E13622' }} />
              🍺 {serving}
              <span style={{ display: 'inline-block', flex: 1, height: '1px', background: '#eee' }} />
              <span style={{ fontWeight: 400, color: '#bbb' }}>{servingItems.length} beer{servingItems.length !== 1 ? 's' : ''}</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {servingItems.map(item => (
                <div key={item.id} style={{
                  border: `1px solid ${item.featured ? '#FFD700' : '#e5e5e5'}`,
                  borderLeft: `4px solid ${item.featured ? '#FFD700' : item.available ? '#E13622' : '#ccc'}`,
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  background: item.available ? '#fff' : '#fafafa',
                  opacity: item.available ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column' as const,
                  gap: '0.4rem'
                }}>
                  {/* Name row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>{item.name}</span>
                      {item.featured && <span title="Featured" style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>⭐</span>}
                      {item.brewery && (
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.1rem' }}>{item.brewery}</div>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#E13622', whiteSpace: 'nowrap' }}>
                      {item.price != null ? `$${item.price.toFixed(2)}` : ''}
                    </span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'rgba(225,54,34,0.08)', color: '#E13622', border: '1px solid rgba(225,54,34,0.2)', borderRadius: '3px', padding: '1px 6px' }}>
                      {item.style}
                    </span>
                    {item.abv != null && (
                      <span style={{ fontSize: '0.7rem', background: '#f4f4f4', color: '#666', border: '1px solid #e0e0e0', borderRadius: '3px', padding: '1px 6px' }}>
                        {item.abv}% ABV
                      </span>
                    )}
                    {item.ibu != null && (
                      <span style={{ fontSize: '0.7rem', background: '#f4f4f4', color: '#666', border: '1px solid #e0e0e0', borderRadius: '3px', padding: '1px 6px' }}>
                        {item.ibu} IBU
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {item.description && (
                    <div style={{ fontSize: '0.78rem', color: '#999', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', alignItems: 'center' }}>
                    <button
                      onClick={() => toggleAvailability(item)}
                      style={{
                        flex: 1,
                        cursor: 'pointer',
                        border: `1px solid ${item.available ? '#a5d6a7' : '#ef9a9a'}`,
                        background: item.available ? '#e8f5e9' : '#fce4ec',
                        color: item.available ? '#2e7d32' : '#c62828',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      {item.available ? '✅ On Tap' : '❌ Off Tap'}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      style={{ background: '#2196F3', color: '#fff', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="delete-button"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {items.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
          No beers added yet. Click "+ Add Beer" to get started.
        </p>
      )}
    </div>
  );
}
