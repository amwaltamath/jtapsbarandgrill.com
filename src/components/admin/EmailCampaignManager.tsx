import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  email_opt_in: boolean;
}

interface Campaign {
  id: number;
  subject: string;
  sent_count: number;
  created_at: string;
  sent_at: string | null;
}

export default function EmailCampaignManager() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSubscribers, setSelectedSubscribers] = useState<number[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [pageIndex, setPageIndex] = useState(0);
  const [progressLoading, setProgressLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    sent: number;
    remaining: number;
    total: number;
    nextOffset: number;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });

  useEffect(() => {
    fetchSubscribers();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(subscribers.length / pageSize));
    if (pageIndex >= totalPages) {
      setPageIndex(totalPages - 1);
    }
  }, [subscribers.length, pageSize, pageIndex]);

  const fetchSubscribers = async () => {
    // Supabase limits responses to 1000 rows by default, so we paginate
    const PAGE_SIZE = 1000;
    let allData: Subscriber[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('email_opt_in', true)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching subscribers:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += PAGE_SIZE;
        // If we got fewer than PAGE_SIZE rows, we've reached the end
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    setSubscribers(allData);
  };

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampaigns(data);
    }
  };

  const handleSelectSubscriber = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedSubscribers([...selectedSubscribers, id]);
    } else {
      setSelectedSubscribers(selectedSubscribers.filter(s => s !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubscribers(subscribers.map(s => s.id));
    } else {
      setSelectedSubscribers([]);
    }
  };

  const selectRange = (startIndex: number, endIndex: number) => {
    const rangeIds = subscribers.slice(startIndex, endIndex).map(s => s.id);
    setSelectedSubscribers(rangeIds);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTestLoading(true);

    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Subject and message are required for test email');
      setTestLoading(false);
      return;
    }

    if (!testEmail.trim()) {
      setError('Please enter a test email address');
      setTestLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      setError('Please enter a valid email address');
      setTestLoading(false);
      return;
    }

    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setTestLoading(false);
        return;
      }

      const response = await fetch('/api/send-promotional-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject: `[TEST] ${formData.subject}`,
          message: formData.message,
          subscribers: [{ email: testEmail, name: 'Test Recipient' }]
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email');
      }

      setSuccess(`Test email sent successfully to ${testEmail}!`);
      setTestEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setTestLoading(false);
    }
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string): Array<{ email: string; name?: string }> => {
    // Normalize line endings
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];

    // Auto-detect delimiter (comma, tab, or pipe)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    }

    // Parse header row
    const headerFields = parseCSVLine(lines[0], delimiter);
    const header = headerFields.map(h => 
      h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, ' ')
    );

    console.log('Detected delimiter:', delimiter === '\t' ? 'TAB' : delimiter);
    console.log('Parsed headers:', header);

    // Find email column (supports various formats)
    const emailIndex = header.findIndex(h => 
      h === 'email' || 
      h === 'email_address' || 
      h === 'email address' || 
      h === 'e-mail' ||
      h === 'emailaddress'
    );

    // Find name column
    const nameIndex = header.findIndex(h => 
      h === 'name' || 
      h === 'full_name' || 
      h === 'full name' || 
      h === 'customer name' ||
      h === 'firstname' ||
      h === 'first name'
    );

    if (emailIndex === -1) {
      throw new Error(`CSV must have an email column. Found columns: ${header.join(', ')}`);
    }

    console.log(`Email column index: ${emailIndex}, Name column index: ${nameIndex}`);

    const records = [];
    const errors: string[] = [];
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        const email = values[emailIndex]?.trim().replace(/['"]/g, '');
        const name = nameIndex >= 0 ? values[nameIndex]?.trim().replace(/['"]/g, '') : undefined;

        if (!email) {
          errors.push(`Line ${i + 1}: Empty email field`);
          continue;
        }

        if (!emailRegex.test(email)) {
          errors.push(`Line ${i + 1}: Invalid email format: ${email}`);
          continue;
        }

        records.push({
          email: email.toLowerCase(),
          name: name || undefined
        });
      } catch (err) {
        errors.push(`Line ${i + 1}: Parse error - ${err}`);
      }
    }

    // Log first 10 errors for debugging
    if (errors.length > 0) {
      console.log(`Found ${errors.length} parsing errors. First 10:`, errors.slice(0, 10));
    }

    console.log(`Successfully parsed ${records.length} records from ${lines.length - 1} data lines`);

    return records;
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setImportLoading(true);
    setImportedCount(0);
    setDuplicateCount(0);

    try {
      const text = await file.text();
      
      console.log('Starting CSV parse...');
      const records = parseCSV(text);
      console.log(`Parsed ${records.length} valid records`);

      if (records.length === 0) {
        setError('No valid email addresses found in CSV. Check browser console for details.');
        setImportLoading(false);
        return;
      }

      // Deduplicate within CSV file (keep first occurrence)
      const seenEmails = new Set<string>();
      const uniqueRecords = records.filter(r => {
        const emailLower = r.email.toLowerCase();
        if (seenEmails.has(emailLower)) {
          return false; // Skip duplicate
        }
        seenEmails.add(emailLower);
        return true;
      });

      const csvDuplicates = records.length - uniqueRecords.length;
      console.log(`Found ${csvDuplicates} duplicates within CSV file`);

      // Get existing emails to check for database duplicates
      const { data: existingSubscribers } = await supabase
        .from('newsletter_subscribers')
        .select('email');

      const existingEmails = new Set(existingSubscribers?.map(s => s.email.toLowerCase()) || []);

      // Filter out database duplicates
      const newRecords = uniqueRecords.filter(r => !existingEmails.has(r.email.toLowerCase()));
      const dbDuplicates = uniqueRecords.length - newRecords.length;
      const totalDuplicates = csvDuplicates + dbDuplicates;

      if (newRecords.length === 0) {
        let msg = ``;
        if (csvDuplicates > 0 && dbDuplicates > 0) {
          msg = `All ${records.length} email(s) are duplicates (${csvDuplicates} within file, ${dbDuplicates} already in database)`;
        } else if (csvDuplicates > 0) {
          msg = `All ${csvDuplicates} email(s) from file are duplicates within the CSV`;
        } else {
          msg = `All ${records.length} email(s) already exist in the database`;
        }
        setError(msg);
        setImportLoading(false);
        return;
      }

      // Batch upsert in chunks of 100 to avoid API limits
      // Using upsert to handle any edge-case duplicates gracefully
      const BATCH_SIZE = 100;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = newRecords.slice(i, i + BATCH_SIZE);
        
        try {
          const { error: upsertError } = await supabase
            .from('newsletter_subscribers')
            .upsert(
              batch.map(r => ({
                email: r.email.toLowerCase(),
                name: r.name || null,
                email_opt_in: true,
                sms_opt_in: false
              })),
              { onConflict: 'email', ignoreDuplicates: false }
            );

          if (upsertError) {
            console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, upsertError);
            failureCount += batch.length;
          } else {
            successCount += batch.length;
          }
        } catch (batchErr) {
          console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, batchErr);
          failureCount += batch.length;
        }
      }

      if (successCount === 0) {
        setError('Failed to import any emails. Please try again.');
        setImportLoading(false);
        return;
      }

      setImportedCount(successCount);
      setDuplicateCount(totalDuplicates);
      
      let message = `Successfully imported ${successCount} email(s)`;
      if (csvDuplicates > 0) {
        message += ` (${csvDuplicates} CSV duplicate${csvDuplicates !== 1 ? 's' : ''} removed)`;
      }
      if (dbDuplicates > 0) {
        message += ` (${dbDuplicates} already in database)`;
      }
      if (failureCount > 0) {
        message += ` - ${failureCount} failed to import. Check browser console for error details.`;
      } else {
        message += '!';
      }
      
      setSuccess(message);

      // Refresh subscriber list
      await fetchSubscribers();

      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setImportLoading(false);
    }
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Subject and message are required');
      setLoading(false);
      return;
    }

    if (selectedSubscribers.length === 0) {
      setError('Please select at least one subscriber');
      setLoading(false);
      return;
    }

    try {
      // Get selected subscriber details
      const selectedData = subscribers.filter(s => selectedSubscribers.includes(s.id));

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/send-promotional-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject: formData.subject,
          message: formData.message,
          subscribers: selectedData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send campaign');
      }

      setSuccess(`Campaign sent successfully! (${result.sent} sent, ${result.failed} failed)`);
      setFormData({ subject: '', message: '' });
      setSelectedSubscribers([]);
      setShowForm(false);
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNextBatch = async () => {
    setError('');
    setSuccess('');
    setProgressLoading(true);

    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Subject and message are required');
      setProgressLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setProgressLoading(false);
        return;
      }

      const response = await fetch('/api/send-promotional-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject: formData.subject,
          message: formData.message,
          useProgress: true,
          batchSize: pageSize
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send batch');
      }

      setBatchProgress({
        sent: result.sent || 0,
        remaining: result.remaining || 0,
        total: result.total || 0,
        nextOffset: result.nextOffset || 0
      });

      if ((result.remaining || 0) === 0) {
        setSuccess('Batch sent. Campaign complete.');
      } else {
        setSuccess(`Batch sent. ${result.remaining} remaining.`);
      }

      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send batch');
    } finally {
      setProgressLoading(false);
    }
  };

  const handleProgressAction = async (action: 'status' | 'reset') => {
    setError('');
    setSuccess('');

    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Subject and message are required');
      return;
    }

    if (action === 'reset') {
      const confirmed = window.confirm('Reset progress for this campaign? This will restart the batch offset.');
      if (!confirmed) {
        return;
      }
    }

    setProgressLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        setProgressLoading(false);
        return;
      }

      const response = await fetch('/api/send-promotional-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subject: formData.subject,
          message: formData.message,
          action
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch progress');
      }

      setBatchProgress({
        sent: result.sent || 0,
        remaining: result.remaining || 0,
        total: result.total || 0,
        nextOffset: result.nextOffset || 0
      });

      if (action === 'reset') {
        setSuccess('Progress reset. Ready to send from the beginning.');
      } else {
        setSuccess('Progress refreshed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch progress');
    } finally {
      setProgressLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(subscribers.length / pageSize));
  const pageStart = pageIndex * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, subscribers.length);
  const pagedSubscribers = subscribers.slice(pageStart, pageEnd);

  return (
    <div className="campaign-manager">
      <h2>📧 Email Campaigns</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="import-section">
        <h3>📥 Import Email Subscribers</h3>
        <p className="section-description">Upload a CSV file with email addresses to add them to your subscriber list</p>
        
        <div className="import-info">
          <strong>CSV Format Required:</strong>
          <ul>
            <li>First row should be headers: <code>email</code> and optional <code>name</code></li>
            <li>Columns can also be: <code>email_address</code>, <code>full_name</code></li>
            <li>One subscriber per row</li>
            <li>Duplicates will be automatically skipped</li>
            <li>Supports files with 100+ emails (processed in batches)</li>
          </ul>
        </div>

        <div className="csv-example">
          <strong>Example CSV:</strong>
          <pre><code>{`email,name
john@example.com,John Smith
jane@example.com,Jane Doe
contact@business.com,`}</code></pre>
        </div>

        <label className="file-input-label">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            disabled={importLoading}
            className="file-input"
          />
          <span className="file-input-button">
            {importLoading ? '📤 Importing...' : '📤 Choose CSV File'}
          </span>
        </label>
      </div>

      <div className="campaign-stats">
        <div className="stat-box">
          <div className="stat-number">{subscribers.length}</div>
          <div className="stat-label">Email Subscribers</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{campaigns.length}</div>
          <div className="stat-label">Campaigns Sent</div>
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="primary-button">
          + Create New Email Campaign
        </button>
      ) : (
        <>
          <div className="test-email-section">
            <h3>📬 Send Test Email</h3>
            <p className="section-description">Preview your campaign before sending to all subscribers</p>
            <form onSubmit={handleSendTestEmail} className="test-email-form">
              <div className="form-row">
                <div className="form-group test-email-input">
                  <label htmlFor="testEmail">Test Email Address *</label>
                  <input
                    id="testEmail"
                    type="email"
                    placeholder="your-email@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="form-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={testLoading || !formData.subject.trim() || !formData.message.trim()}
                  className="primary-button test-send-btn"
                >
                  {testLoading ? 'Sending Test...' : 'Send Test Email'}
                </button>
              </div>
            </form>
          </div>

          <div className="campaign-form">
          <h3>Create Email Campaign</h3>
          <form onSubmit={handleSendCampaign}>
            <div className="form-group">
              <label htmlFor="subject">Email Subject *</label>
              <input
                id="subject"
                type="text"
                placeholder="e.g., Special Wings Deal This Weekend!"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="form-input"
                maxLength={100}
              />
              <small>{formData.subject.length}/100</small>
            </div>

            <div className="form-group">
              <label htmlFor="message">Email Message *</label>
              <textarea
                id="message"
                placeholder="Write your promotional message here. You can use HTML."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="form-textarea"
                rows={6}
              />
              <small>{formData.message.length} characters</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={selectedSubscribers.length === subscribers.length && subscribers.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="form-checkbox"
                />
                {' '}Select All ({subscribers.length} subscribers)
              </label>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Send In Batches</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSendNextBatch}
                  disabled={progressLoading || !formData.subject.trim() || !formData.message.trim()}
                >
                  {progressLoading ? 'Sending Batch...' : `Send Next ${pageSize} (Auto)`}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setPageIndex(0);
                    selectRange(0, Math.min(pageSize, subscribers.length));
                  }}
                  disabled={subscribers.length === 0}
                >
                  Select First {pageSize}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const nextIndex = Math.min(pageIndex + 1, totalPages - 1);
                    setPageIndex(nextIndex);
                    const start = nextIndex * pageSize;
                    selectRange(start, Math.min(start + pageSize, subscribers.length));
                  }}
                  disabled={subscribers.length === 0 || pageIndex >= totalPages - 1}
                >
                  Select Next {pageSize}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const prevIndex = Math.max(pageIndex - 1, 0);
                    setPageIndex(prevIndex);
                    const start = prevIndex * pageSize;
                    selectRange(start, Math.min(start + pageSize, subscribers.length));
                  }}
                  disabled={subscribers.length === 0 || pageIndex === 0}
                >
                  Select Prev {pageSize}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => selectRange(pageStart, pageEnd)}
                  disabled={subscribers.length === 0}
                >
                  Select This Page
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleProgressAction('status')}
                  disabled={progressLoading || !formData.subject.trim() || !formData.message.trim()}
                >
                  {progressLoading ? 'Working...' : 'Refresh Progress'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleProgressAction('reset')}
                  disabled={progressLoading || !formData.subject.trim() || !formData.message.trim()}
                >
                  Reset Progress
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Page Size
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={pageSize}
                    onChange={(e) => setPageSize(Math.max(1, Number(e.target.value) || 1))}
                    className="form-input"
                    style={{ width: '90px', padding: '6px 8px' }}
                  />
                </label>
                <span style={{ color: '#666', fontSize: '0.9rem' }}>
                  Showing {subscribers.length === 0 ? 0 : pageStart + 1}-{pageEnd} of {subscribers.length}
                </span>
                {batchProgress && (
                  <span style={{ color: '#444', fontSize: '0.9rem' }}>
                    Progress: {Math.max(batchProgress.total - batchProgress.remaining, 0)}/{batchProgress.total} sent
                  </span>
                )}
              </div>
            </div>

            <div className="subscribers-list">
              <h4>Recipients ({selectedSubscribers.length} selected)</h4>
              <div className="subscribers-container">
                {pagedSubscribers.length === 0 ? (
                  <p className="empty-state">No email subscribers yet</p>
                ) : (
                  pagedSubscribers.map(subscriber => (
                    <label key={subscriber.id} className="subscriber-item">
                      <input
                        type="checkbox"
                        checked={selectedSubscribers.includes(subscriber.id)}
                        onChange={(e) => handleSelectSubscriber(subscriber.id, e.target.checked)}
                        className="form-checkbox"
                      />
                      <span>{subscriber.name || 'No name'}</span>
                      <span className="subscriber-email">{subscriber.email}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || selectedSubscribers.length === 0}
                className="primary-button"
              >
                {loading ? 'Sending...' : 'Send Campaign'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ subject: '', message: '' });
                  setSelectedSubscribers([]);
                }}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        </>
      )}

      <div className="campaigns-history">
        <h3>Campaign History</h3>
        {campaigns.length === 0 ? (
          <p className="empty-state">No campaigns sent yet</p>
        ) : (
          <div className="campaigns-table">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Sent Count</th>
                  <th>Created</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(campaign => (
                  <tr key={campaign.id}>
                    <td>{campaign.subject}</td>
                    <td>{campaign.sent_count}</td>
                    <td>{new Date(campaign.created_at).toLocaleDateString()}</td>
                    <td>{campaign.sent_at ? new Date(campaign.sent_at).toLocaleDateString() : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
