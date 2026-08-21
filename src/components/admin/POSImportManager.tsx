import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface POSRecord {
  card_number: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  points: number;
  total_points: number;
  dollars: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  birthday: string;
  gender: string;
  register_date: string;
  last_visit: string;
  loyalty_status: string;
}

interface ImportLog {
  id: number;
  imported_at: string;
  total_records: number;
  new_subscribers: number;
  updated_subscribers: number;
  new_loyalty: number;
  updated_loyalty: number;
}

function parseCSV(text: string): POSRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const colIndex = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const cardIdx = colIndex(['card #', 'card', 'card number']);
  const statusIdx = colIndex(['loyalty status', 'status']);
  const pointsIdx = colIndex(['points']);
  const totalPtsIdx = colIndex(['total points']);
  const dollarsIdx = colIndex(['dollars']);
  const firstIdx = colIndex(['first', 'first name']);
  const lastIdx = colIndex(['last', 'last name']);
  const addressIdx = colIndex(['address']);
  const cityIdx = colIndex(['city']);
  const stateIdx = colIndex(['state']);
  const zipIdx = colIndex(['zip']);
  const mobileIdx = colIndex(['mobile', 'phone']);
  const regDateIdx = colIndex(['register date', 'registered']);
  const birthIdx = colIndex(['birth date', 'birthday']);
  const emailIdx = colIndex(['e-mail', 'email']);
  const genderIdx = colIndex(['gender']);
  const lastVisitIdx = colIndex(['last visit']);

  const records: POSRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle commas inside quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);

    const get = (idx: number) => (idx >= 0 && idx < fields.length ? fields[idx].trim() : '');

    const email = get(emailIdx);
    const phone = get(mobileIdx);
    if (!email && !phone) continue; // Skip records with no contact info

    records.push({
      card_number: get(cardIdx),
      loyalty_status: get(statusIdx),
      points: parseFloat(get(pointsIdx)) || 0,
      total_points: parseFloat(get(totalPtsIdx)) || 0,
      dollars: parseFloat(get(dollarsIdx)) || 0,
      first: get(firstIdx),
      last: get(lastIdx),
      address: get(addressIdx),
      city: get(cityIdx),
      state: get(stateIdx),
      zip: get(zipIdx),
      phone,
      register_date: get(regDateIdx),
      birthday: get(birthIdx),
      email,
      gender: get(genderIdx),
      last_visit: get(lastVisitIdx),
    });
  }

  return records;
}

export default function POSImportManager() {
  const [records, setRecords] = useState<POSRecord[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [posConfigured, setPosConfigured] = useState<boolean | null>(null);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<string>('');

  useEffect(() => {
    fetchImportLogs();
    fetchPosStatus();
  }, []);

  const fetchPosStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('/api/admin/pos-inquiry', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      setPosConfigured(Boolean(result.configured));
    } catch {
      setPosConfigured(false);
    }
  };

  const handlePosLookup = async () => {
    if (!lookupPhone.trim()) return;
    setLookupLoading(true);
    setError('');
    setSuccess('');
    setLookupResult('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/pos-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: lookupPhone.trim() }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Lookup failed');

      if (!result.inquiry?.found) {
        setLookupResult(`Not found in POS: ${result.inquiry?.message || 'No account for that phone.'}`);
      } else {
        const points = result.inquiry.balance ?? result.inquiry.purchase ?? 0;
        const card = result.inquiry.cardNumber ? ` Card ...${result.inquiry.cardNumber.slice(-6)}` : '';
        setLookupResult(
          `Found in POS — ${points} points.${card}` +
          (result.sync?.synced ? ' Synced to JTAPS database.' : '')
        );
        setSuccess(result.sync?.message || 'POS lookup complete.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'POS lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const fetchImportLogs = async () => {
    const { data } = await supabase
      .from('pos_import_log')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(10);
    if (data) setImportLogs(data);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setError('No valid records found in CSV. Make sure it has the expected POS columns.');
        } else {
          setRecords(parsed);
        }
      } catch {
        setError('Failed to parse CSV file');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (records.length === 0) return;

    setError('');
    setSuccess('');
    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setImporting(false);
        return;
      }

      const response = await fetch('/api/admin/pos-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ records }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      const parts = [];
      if (result.newSubscribers > 0) parts.push(`${result.newSubscribers} new subscribers`);
      if (result.updatedSubscribers > 0) parts.push(`${result.updatedSubscribers} updated subscribers`);
      if (result.newLoyalty > 0) parts.push(`${result.newLoyalty} new loyalty members`);
      if (result.updatedLoyalty > 0) parts.push(`${result.updatedLoyalty} updated loyalty members`);

      setSuccess(
        `Import complete! ${result.total} records processed: ${parts.join(', ')}.` +
        (result.errors?.length > 0 ? ` ${result.errors.length} errors.` : '')
      );

      if (result.errors?.length > 0) {
        setError(`Errors:\n${result.errors.join('\n')}`);
      }

      setRecords([]);
      setFileName('');
      fetchImportLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const totalPoints = records.reduce((sum, r) => sum + r.points, 0);
  const withEmail = records.filter(r => r.email).length;
  const withPhone = records.filter(r => r.phone).length;

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>POS Import</h2>
        <p style={{ color: '#999', marginTop: '4px' }}>
          Sync customer points from Shift4 / Focus POS live, or upload a CSV export.
        </p>
      </div>

      {error && <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-card" style={{ marginBottom: '24px' }}>
        <h3>Live POS Lookup (INQUIRY)</h3>
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>
          Look up a customer by mobile number in Focus POS and sync their points into JTAPS automatically.
        </p>
        <p style={{
          color: posConfigured ? '#4ade80' : '#fbbf24',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          {posConfigured === null
            ? 'Checking Focus POS configuration...'
            : posConfigured
              ? 'Focus POS API connected (env configured).'
              : 'Focus POS API not configured — add FOCUS_POS_* env vars in Vercel.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="tel"
            value={lookupPhone}
            onChange={(e) => setLookupPhone(e.target.value)}
            placeholder="Mobile number (10 digits)"
            className="form-input"
            style={{ maxWidth: '240px' }}
          />
          <button
            className="btn btn-primary"
            onClick={handlePosLookup}
            disabled={lookupLoading || !lookupPhone.trim()}
          >
            {lookupLoading ? 'Looking up...' : 'Lookup & Sync'}
          </button>
        </div>
        {lookupResult && (
          <p style={{ color: '#ccc', marginTop: '12px', fontSize: '14px' }}>{lookupResult}</p>
        )}
      </div>

      {/* Upload Section */}
      <div className="form-card" style={{ marginBottom: '24px' }}>
        <h3>Upload POS Export</h3>
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>
          Export your member list from the POS system as a CSV file and upload it below.
          The import will match existing customers by email or phone and update their data.
          New customers will be added automatically.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            className="btn btn-secondary"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            📂 Choose CSV File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          {fileName && (
            <span style={{ color: '#ccc' }}>
              {fileName} — {records.length} records parsed
            </span>
          )}
        </div>
      </div>

      {/* Preview Section */}
      {records.length > 0 && (
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>Preview ({records.length} records)</h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div className="stat-card">
              <div className="stat-value">{records.length}</div>
              <div className="stat-label">Total Records</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{withEmail}</div>
              <div className="stat-label">With Email</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{withPhone}</div>
              <div className="stat-label">With Phone</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPoints.toFixed(0)}</div>
              <div className="stat-label">Total Points</div>
            </div>
          </div>

          <div style={{ maxHeight: '400px', overflow: 'auto', marginBottom: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Card #</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Points</th>
                  <th>Total Pts</th>
                  <th>Registered</th>
                  <th>Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      ...{r.card_number.slice(-6)}
                    </td>
                    <td>{r.first} {r.last}</td>
                    <td style={{ fontSize: '12px' }}>{r.email}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.phone}</td>
                    <td style={{ textAlign: 'right' }}>{r.points.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{r.total_points.toFixed(2)}</td>
                    <td>{r.register_date}</td>
                    <td>{r.last_visit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? 'Importing...' : `Import ${records.length} Records`}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setRecords([]); setFileName(''); }}
              disabled={importing}
            >
              Cancel
            </button>
          </div>

          <p style={{ color: '#888', fontSize: '12px', marginTop: '12px' }}>
            ℹ️ Existing customers (matched by email/phone) will be updated.
            New customers will be added. Points use the higher of POS vs app values.
          </p>
        </div>
      )}

      {/* Import History */}
      {importLogs.length > 0 && (
        <div className="form-card">
          <h3>Import History</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
                <th>New Subs</th>
                <th>Updated Subs</th>
                <th>New Loyalty</th>
                <th>Updated Loyalty</th>
              </tr>
            </thead>
            <tbody>
              {importLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {new Date(log.imported_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td>{log.total_records}</td>
                  <td style={{ color: '#4ade80' }}>{log.new_subscribers}</td>
                  <td>{log.updated_subscribers}</td>
                  <td style={{ color: '#4ade80' }}>{log.new_loyalty}</td>
                  <td>{log.updated_loyalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
