import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface ManagedUser {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

export default function AdminUsersManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load users');
      }

      setUsers(result.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const updateAdminStatus = async (userId: string, action: 'promote' | 'demote') => {
    setActionLoading(userId);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setActionLoading(null);
        return;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action,
          userId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      setSuccess(action === 'promote' ? 'User promoted to admin.' : 'Admin access removed.');
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <h2>Admin Users</h2>
        <button onClick={fetchUsers} className="form-button-small" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Last Sign In</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={5}>No users found.</td>
              </tr>
            )}
            {users.map((user) => {
              const isBusy = actionLoading === user.id;
              return (
                <tr key={user.id}>
                  <td>{user.email || 'Unknown'}</td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                  <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}</td>
                  <td>{user.is_admin ? 'Admin' : 'User'}</td>
                  <td>
                    {user.is_admin ? (
                      <button
                        className="form-button-secondary"
                        onClick={() => updateAdminStatus(user.id, 'demote')}
                        disabled={isBusy}
                      >
                        {isBusy ? 'Updating...' : 'Remove Admin'}
                      </button>
                    ) : (
                      <button
                        className="form-button-small"
                        onClick={() => updateAdminStatus(user.id, 'promote')}
                        disabled={isBusy}
                      >
                        {isBusy ? 'Updating...' : 'Promote'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
