import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Special {
  id: number;
  title: string;
  description: string;
  discount_type: string;
  discount_amount: number;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  active: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SpecialsManager() {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_amount: 0,
    start_time: '17:00',
    end_time: '22:00',
    days_of_week: ['Friday', 'Saturday'],
    active: true
  });

  useEffect(() => {
    fetchSpecials();
  }, []);

  const fetchSpecials = async () => {
    const { data, error } = await supabase
      .from('specials')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSpecials(data);
    }
  };

  const handleAddSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { error } = await supabase.from('specials').insert([
      {
        title: formData.title,
        description: formData.description,
        discount_type: formData.discount_type,
        discount_amount: formData.discount_amount,
        start_time: formData.start_time,
        end_time: formData.end_time,
        days_of_week: formData.days_of_week,
        active: formData.active
      }
    ]);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Special created successfully!');
      setFormData({
        title: '',
        description: '',
        discount_type: 'percentage',
        discount_amount: 0,
        start_time: '17:00',
        end_time: '22:00',
        days_of_week: ['Friday', 'Saturday'],
        active: true
      });
      setShowForm(false);
      fetchSpecials();
    }
  };

  const handleDeleteSpecial = async (id: number) => {
    if (confirm('Delete this special?')) {
      await supabase.from('specials').delete().eq('id', id);
      fetchSpecials();
    }
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Manage Specials & Promotions</h2>
        <button onClick={() => setShowForm(!showForm)} className="form-button-small">
          {showForm ? 'Cancel' : '+ Create Special'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddSpecial} className="form-stack">
          <input
            type="text"
            placeholder="Special Title (e.g., Wings Night)"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
            className="form-input"
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
            className="form-textarea"
            rows={2}
          />
          <div className="form-grid">
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
              className="form-input"
            >
              <option value="percentage">Percentage Off</option>
              <option value="fixed">$ Off</option>
              <option value="deal">Special Deal</option>
            </select>
            <input
              type="number"
              placeholder="Discount Amount"
              value={formData.discount_amount}
              onChange={(e) => setFormData({...formData, discount_amount: parseFloat(e.target.value)})}
              step="0.01"
              className="form-input"
            />
          </div>
          <div className="form-grid">
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({...formData, start_time: e.target.value})}
              className="form-input"
            />
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({...formData, end_time: e.target.value})}
              className="form-input"
            />
          </div>
          <div className="days-selector">
            <label>Days of Week:</label>
            <div className="days-grid">
              {DAYS.map(day => (
                <label key={day} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.days_of_week.includes(day)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          days_of_week: [...formData.days_of_week, day]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          days_of_week: formData.days_of_week.filter(d => d !== day)
                        });
                      }
                    }}
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="form-button">Create Special</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </form>
      )}

      <div className="grid-layout">
        {specials.map((special) => (
          <div key={special.id} className="card-item">
            <h4>{special.title}</h4>
            <p>{special.description}</p>
            <div className="special-details">
              <p><strong>Discount:</strong> {special.discount_amount}{special.discount_type === 'percentage' ? '%' : '$'} off</p>
              <p><strong>Time:</strong> {special.start_time} - {special.end_time}</p>
              <p><strong>Days:</strong> {special.days_of_week.join(', ')}</p>
              <p><strong>Status:</strong> {special.active ? '✅ Active' : '❌ Inactive'}</p>
            </div>
            <button
              onClick={() => handleDeleteSpecial(special.id)}
              className="delete-button-small"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
