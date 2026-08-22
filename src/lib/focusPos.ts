/**
 * Focus POS / Shift4 myFocus loyalty TStream API client.
 * Credentials and endpoint must be configured via environment variables.
 */

export interface FocusPosConfig {
  apiUrl: string;
  userId: string;
  password: string;
  merchantId: string;
  memo: string;
  operatorId: string;
  requestFormat: 'form' | 'xml';
  /** Form field name for TStream payload — `xmlData` (cloud) or `sendxmlData` (local Comm Engine) */
  xmlParam: string;
}

export interface FocusInquiryResult {
  ok: boolean;
  found: boolean;
  status: string;
  message: string;
  cardNumber?: string;
  balance?: number;
  purchase?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  rawTags: Record<string, string>;
  rawResponse?: string;
}

export interface FocusAddMemberResult {
  ok: boolean;
  status: string;
  message: string;
  cardNumber?: string;
  rawTags: Record<string, string>;
  rawResponse?: string;
}

export function getFocusPosConfig(): FocusPosConfig | null {
  const apiUrl = import.meta.env.FOCUS_POS_API_URL?.trim();
  const userId = import.meta.env.FOCUS_POS_USER_ID?.trim();
  const password = import.meta.env.FOCUS_POS_PASSWORD?.trim();
  const merchantId = import.meta.env.FOCUS_POS_MERCHANT_ID?.trim();

  if (!apiUrl || !userId || !password || !merchantId) {
    return null;
  }

  const format = import.meta.env.FOCUS_POS_REQUEST_FORMAT?.trim().toLowerCase();
  const xmlParam = import.meta.env.FOCUS_POS_XML_PARAM?.trim() || 'xmlData';
  return {
    apiUrl,
    userId,
    password,
    merchantId,
    memo: import.meta.env.FOCUS_POS_MEMO?.trim() || '10.1.250717',
    operatorId: import.meta.env.FOCUS_POS_OPERATOR_ID?.trim() || 'JTAPS-Web',
    requestFormat: format === 'xml' ? 'xml' : 'form',
    xmlParam,
  };
}

export function isFocusPosConfigured(): boolean {
  return getFocusPosConfig() !== null;
}

/** 10-digit US mobile for Focus POS lookups */
export function normalizePosPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.slice(0, 10);
}

function posCheckFileDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${mm}${dd}${yyyy}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTransactionXml(fields: Record<string, string | number | undefined>, innerBlocks = ''): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `  <${key}>${escapeXml(String(value))}</${key}>`);

  return `<?xml version="1.0"?>\n<TStream>\n<Transaction>\n${lines.join('\n')}\n${innerBlocks}</Transaction>\n</TStream>`;
}

export function buildInquiryXml(mobileNumber: string, config: FocusPosConfig, invoiceNo = '1'): string {
  const accountBlock = `<Account>
  <Track2>Manual</Track2>
  <AcctNo></AcctNo>
  <MobileNumber>${escapeXml(mobileNumber)}</MobileNumber>
</Account>`;

  return buildTransactionXml(
    {
      UserID: config.userId,
      Password: config.password,
      Memo: config.memo,
      HardwareKeyNumber: '0',
      MerchantID: config.merchantId,
      OperatorID: config.operatorId,
      TranCode: 'INQUIRY',
      CheckFileDate: posCheckFileDate(),
      InvoiceNo: invoiceNo,
      SeatNumber: '1',
      Source: 'POS',
      RefNo: invoiceNo,
    },
    accountBlock,
  );
}

export function buildAddMemberXml(
  input: {
    mobileNumber: string;
    firstName: string;
    lastName: string;
    email: string;
  },
  config: FocusPosConfig,
): string {
  return buildTransactionXml({
    UserID: config.userId,
    Password: config.password,
    Memo: config.memo,
    HardwareKeyNumber: '0',
    MerchantID: config.merchantId,
    OperatorID: config.operatorId,
    TranCode: 'ADDMEMBER',
    RefNo: '',
    Source: 'POS',
    MobileNumber: input.mobileNumber,
    FirstName: input.firstName,
    LastName: input.lastName,
    Email: input.email,
  });
}

export function unwrapFocusResponse(body: string): string {
  const trimmed = body.trim();
  const stringMatch = trimmed.match(/<string[^>]*>([\s\S]*?)<\/string>/i);
  if (stringMatch) {
    return stringMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  return trimmed;
}

export function extractXmlTags(xml: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const regex = /<([A-Za-z0-9:_-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let match = regex.exec(xml);
  while (match) {
    tags[match[1]] = match[2].trim();
    match = regex.exec(xml);
  }
  return tags;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isApprovedStatus(status: string, message: string): boolean {
  const normalized = status.toLowerCase();
  if (normalized === 'approved' || normalized === 'success') return true;
  if (message.toLowerCase().includes('notfound')) return false;
  return false;
}

export function parseInquiryResponse(rawBody: string): FocusInquiryResult {
  const xml = unwrapFocusResponse(rawBody);
  const tags = extractXmlTags(xml);
  const status = tags.CmdStatus || '';
  const message = tags.TextResponse || tags.UserTraceData || 'Unknown response';

  if (message.toLowerCase().includes('phonenumbernotfound') || message.toLowerCase().includes('not found')) {
    return {
      ok: true,
      found: false,
      status,
      message,
      rawTags: tags,
      rawResponse: xml,
    };
  }

  const approved = isApprovedStatus(status, message);
  const balance = parseAmount(tags.Balance);
  const purchase = parseAmount(tags.Purchase);

  return {
    ok: approved,
    found: approved,
    status,
    message,
    cardNumber: tags.AcctNo || undefined,
    balance,
    purchase,
    firstName: tags.FirstName,
    lastName: tags.LastName,
    email: tags.Email,
    mobileNumber: tags.MobileNumber,
    rawTags: tags,
    rawResponse: xml,
  };
}

export function parseAddMemberResponse(rawBody: string): FocusAddMemberResult {
  const xml = unwrapFocusResponse(rawBody);
  const tags = extractXmlTags(xml);
  const status = tags.CmdStatus || '';
  const message = tags.TextResponse || tags.UserTraceData || 'Unknown response';
  const approved = isApprovedStatus(status, message);

  return {
    ok: approved,
    status,
    message,
    cardNumber: tags.AcctNo || undefined,
    rawTags: tags,
    rawResponse: xml,
  };
}

export async function sendFocusPosRequest(xml: string, config: FocusPosConfig): Promise<string> {
  let response: Response;

  if (config.requestFormat === 'xml') {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: xml,
    });
  } else {
    const body = new URLSearchParams({ [config.xmlParam]: xml });
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Focus POS HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  return text;
}

export async function inquiryByPhone(mobileNumber: string): Promise<FocusInquiryResult> {
  const config = getFocusPosConfig();
  if (!config) {
    throw new Error('Focus POS is not configured.');
  }

  const phone = normalizePosPhone(mobileNumber);
  if (phone.length !== 10) {
    throw new Error('A valid 10-digit mobile number is required.');
  }

  const xml = buildInquiryXml(phone, config);
  const raw = await sendFocusPosRequest(xml, config);
  return parseInquiryResponse(raw);
}

export async function addMember(input: {
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<FocusAddMemberResult> {
  const config = getFocusPosConfig();
  if (!config) {
    throw new Error('Focus POS is not configured.');
  }

  const phone = normalizePosPhone(input.mobileNumber);
  if (phone.length !== 10) {
    throw new Error('A valid 10-digit mobile number is required.');
  }

  const xml = buildAddMemberXml(
    {
      mobileNumber: phone,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
    },
    config,
  );

  const raw = await sendFocusPosRequest(xml, config);
  return parseAddMemberResponse(raw);
}
