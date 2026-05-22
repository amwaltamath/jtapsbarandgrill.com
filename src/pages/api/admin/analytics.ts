import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { GoogleAuth } from 'google-auth-library';

const requireAdmin = async (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return { error: 'Missing authorization token', status: 401 };
  if (!supabaseAdmin) return { error: 'Supabase not configured', status: 500 };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid or expired session', status: 401 };

  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (adminError) return { error: 'Failed to verify admin access', status: 500 };
  if (!adminRow) return { error: 'Forbidden', status: 403 };

  return { user: data.user };
};

export const GET: APIRoute = async ({ request }) => {
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const propertyId = import.meta.env.GA4_PROPERTY_ID;
  const serviceAccountEmail = import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyB64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;

  if (!propertyId || !serviceAccountEmail || !keyB64) {
    return new Response(
      JSON.stringify({ error: 'Google Analytics not configured. Set GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const privateKey = Buffer.from(keyB64, 'base64').toString('utf-8');

    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to obtain access token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch summary metrics for the last 30 days
    const summaryResp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'newUsers' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        }),
      }
    );

    // Fetch top pages for the last 30 days
    const pagesResp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 8,
        }),
      }
    );

    // Fetch daily sessions for the last 14 days (sparkline data)
    const trendResp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
        }),
      }
    );

    if (!summaryResp.ok || !pagesResp.ok || !trendResp.ok) {
      const errText = await summaryResp.text();
      return new Response(
        JSON.stringify({ error: 'GA4 API error', details: errText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [summaryData, pagesData, trendData] = await Promise.all([
      summaryResp.json(),
      pagesResp.json(),
      trendResp.json(),
    ]);

    // Parse summary metrics
    const metricValues = summaryData.rows?.[0]?.metricValues ?? [];
    const metricHeaders: string[] = summaryData.metricHeaders?.map((h: any) => h.name) ?? [];
    const summary: Record<string, number> = {};
    metricHeaders.forEach((name, i) => {
      summary[name] = parseFloat(metricValues[i]?.value ?? '0');
    });

    // Parse top pages
    const topPages = (pagesData.rows ?? []).map((row: any) => ({
      path: row.dimensionValues?.[0]?.value ?? '',
      title: row.dimensionValues?.[1]?.value ?? '',
      views: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    }));

    // Parse trend data
    const trend = (trendData.rows ?? []).map((row: any) => ({
      date: row.dimensionValues?.[0]?.value ?? '',
      sessions: parseInt(row.metricValues?.[0]?.value ?? '0', 10),
      users: parseInt(row.metricValues?.[1]?.value ?? '0', 10),
    }));

    return new Response(
      JSON.stringify({ summary, topPages, trend }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('GA4 analytics error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
