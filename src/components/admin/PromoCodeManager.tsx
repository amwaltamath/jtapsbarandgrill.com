import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface PromoCode {
  id: number;
  code: string;
  discount_type: string;
  discount_amount: number;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  uses_count: number;
  active: boolean;
  campaign_name: string;
}

export default function PromoCodeManager() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_amount: 10,
    valid_from: '',
    valid_until: '',
    max_uses: 100,
    campaign_name: ''
  });

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('valid_until', { ascending: false });

    if (!error && data) {
      setCodes(data);
    }
  };

  const generateCode = () => {
    const code = 'JTAPS' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({...formData, code});
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { error } = await supabase.from('promo_codes').insert([
      {
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_amount: formData.discount_amount,
        valid_from: `${formData.valid_from}T00:00:00`,
        valid_until: `${formData.valid_until}T23:59:59`,
        max_uses: formData.max_uses,
        campaign_name: formData.campaign_name
      }
    ]);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Promo code created!');
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_amount: 10,
        valid_from: '',
        valid_until: '',
        max_uses: 100,
        campaign_name: ''
      });
      setShowForm(false);
      fetchCodes();
    }
  };

  const handleDeleteCode = async (id: number) => {
    if (confirm('Delete this promo code?')) {
      await supabase.from('promo_codes').delete().eq('id', id);
      fetchCodes();
    }
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Promo Code Manager</h2>
        <button onClick={() => setShowForm(!showForm)} className="form-button-small">
          {showForm ? 'Cancel' : '+ Create Code'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddCode} className="form-stack">
          <div className="form-grid">
            <input
              type="text"
              placeholder="Promo Code"
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value})}
              required
              className="form-input"
              maxLength={20}
            />
            <button type="button" onClick={generateCode} className="form-button-secondary">
              Generate Code
            </button>
          </div>
          <input
            type="text"
            placeholder="Campaign Name (e.g., Game Day Special)"
            value={formData.campaign_name}
            onChange={(e) => setFormData({...formData, campaign_name: e.target.value})}
            className="form-input"
          />
          <div className="form-grid">
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
              className="form-input"
            >
              <option value="percentage">% Off</option>
              <option value="fixed">$ Off</option>
            </select>
            <input
              type="number"
              placeholder="Discount Amount"
              value={formData.discount_amount}
              onChange={(e) => setFormData({...formData, discount_amount: parseFloat(e.target.value)})}
              step="0.01"
              required
              className="form-input"
            />
          </div>
          <div className="form-grid">
            <input
              type="date"
              value={formData.valid_from}
              onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
              required
              className="form-input"
            />
            <input
              type="date"
              value={formData.valid_until}
              onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
              required
              className="form-input"
            />
          </div>
          <input
            type="number"
            placeholder="Max Uses"
            value={formData.max_uses}
            onChange={(e) => setFormData({...formData, max_uses: parseInt(e.target.value)})}
            className="form-input"
          />
          <button type="submit" className="form-button">Create Promo Code</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </form>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Campaign</th>
              <th>Discount</th>
              <th>Valid Period</th>
              <th>Uses</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(code => (
              <tr key={code.id}>
                <td><strong className="promo-code">{code.code}</strong></td>
                <td>{code.campaign_name}</td>
                <td>{code.discount_amount}{code.discount_type === 'percentage' ? '%' : '$'} off</td>
                <td>{new Date(code.valid_from).toLocaleDateString()} - {new Date(code.valid_until).toLocaleDateString()}</td>
                <td>{code.uses_count}/{code.max_uses}</td>
                <td>{code.active ? '✅' : '❌'}</td>
                <td>
                  <button
                    onClick={() => handleDeleteCode(code.id)}
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
  );
}
