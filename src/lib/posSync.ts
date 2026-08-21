import type { SupabaseClient } from '@supabase/supabase-js';
import type { FocusInquiryResult } from './focusPos';
import { normalizePosPhone } from './focusPos';

export interface PosSyncInput {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}

export interface PosSyncResult {
  synced: boolean;
  found: boolean;
  message: string;
  points?: number;
  cardNumber?: string;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Guest', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function formatPhoneE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

function computeTier(points: number): string {
  if (points >= 300) return 'gold';
  if (points >= 100) return 'silver';
  return 'bronze';
}

export async function applyInquiryToDatabase(
  supabaseAdmin: SupabaseClient,
  inquiry: FocusInquiryResult,
  input: PosSyncInput,
): Promise<PosSyncResult> {
  if (!inquiry.found) {
    return {
      synced: false,
      found: false,
      message: inquiry.message || 'Customer not found in POS.',
    };
  }

  const email = (input.email || inquiry.email || '').trim().toLowerCase();
  const phoneRaw = input.phone || inquiry.mobileNumber || '';
  const phone = formatPhoneE164(phoneRaw);
  const posPhone = normalizePosPhone(phoneRaw);

  const nameFromInput = input.name?.trim();
  const nameFromPos = [inquiry.firstName, inquiry.lastName].filter(Boolean).join(' ').trim();
  const name = nameFromInput || nameFromPos || 'JTAPS Guest';
  const { first, last } = splitName(name);

  const cardNumber = inquiry.cardNumber?.trim();
  const posPoints = Math.round(inquiry.balance ?? inquiry.purchase ?? 0);

  if (!email && !phone) {
    return {
      synced: false,
      found: true,
      message: 'POS member found but no email or phone available to sync locally.',
      points: posPoints,
      cardNumber,
    };
  }

  // Upsert newsletter subscriber
  if (email || phone) {
    let existingSub: { id: number } | null = null;

    if (email) {
      const { data } = await supabaseAdmin
        .from('newsletter_subscribers')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      existingSub = data;
    }

    if (!existingSub && phone) {
      const { data } = await supabaseAdmin
        .from('newsletter_subscribers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      existingSub = data;
    }

    const subData: Record<string, unknown> = {
      name,
      pos_card_number: cardNumber || null,
      sms_opt_in: !!phone,
      email_opt_in: !!email,
    };
    if (email) subData.email = email;
    if (phone) subData.phone = phone;

    if (existingSub) {
      await supabaseAdmin.from('newsletter_subscribers').update(subData).eq('id', existingSub.id);
    } else if (email || phone) {
      await supabaseAdmin.from('newsletter_subscribers').insert(subData);
    }
  }

  // Upsert loyalty member when email is available
  if (email) {
    const { data: existingLoyalty } = await supabaseAdmin
      .from('loyalty_members')
      .select('id, points')
      .eq('email', email)
      .maybeSingle();

    const loyaltyData: Record<string, unknown> = {
      name,
      phone: phone || null,
      pos_card_number: cardNumber || null,
      pos_points: posPoints,
      pos_total_points: posPoints,
      pos_last_synced: new Date().toISOString(),
      points: existingLoyalty
        ? Math.max(existingLoyalty.points || 0, posPoints)
        : posPoints,
      tier: computeTier(existingLoyalty
        ? Math.max(existingLoyalty.points || 0, posPoints)
        : posPoints),
    };

    if (existingLoyalty) {
      await supabaseAdmin.from('loyalty_members').update(loyaltyData).eq('id', existingLoyalty.id);
    } else {
      loyaltyData.email = email;
      loyaltyData.joined_at = new Date().toISOString();
      await supabaseAdmin.from('loyalty_members').insert(loyaltyData);
    }
  }

  // Keep customer profile phone/card in sync when possible
  if (email) {
    await supabaseAdmin
      .from('customer_profiles')
      .update({
        phone: phone || null,
        name,
      })
      .eq('email', email);
  }

  return {
    synced: true,
    found: true,
    message: `Synced ${first}${last ? ` ${last}` : ''} — ${posPoints} POS points.`,
    points: posPoints,
    cardNumber,
  };
}

export function posRecordFromInquiry(
  inquiry: FocusInquiryResult,
  input: PosSyncInput,
): {
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
} {
  const name = input.name?.trim() || [inquiry.firstName, inquiry.lastName].filter(Boolean).join(' ').trim();
  const { first, last } = splitName(name);
  const points = inquiry.balance ?? inquiry.purchase ?? 0;

  return {
    card_number: inquiry.cardNumber || '',
    first,
    last,
    email: (input.email || inquiry.email || '').trim().toLowerCase(),
    phone: input.phone || inquiry.mobileNumber || '',
    points,
    total_points: points,
    dollars: 0,
    address: '',
    city: '',
    state: '',
    zip: '',
    birthday: '',
    gender: '',
    register_date: '',
    last_visit: '',
    loyalty_status: 'active',
  };
}
