import type { SupabaseClient, User } from '@supabase/supabase-js';
import { computeTier, type LoyaltyMember } from './wallet';

interface CustomerProfileRow {
  name: string | null;
  email: string | null;
  checkin_points?: number | null;
  total_checkins?: number | null;
  current_streak?: number | null;
  longest_streak?: number | null;
  created_at: string;
  member_since?: string | null;
  last_checkin_date?: string | null;
}

export interface LoyaltyMemberSnapshot {
  member: LoyaltyMember;
  longestStreak: number;
  lastCheckin: string | null;
}

async function loadCustomerProfile(
  supabaseAdmin: SupabaseClient,
  user: User
): Promise<CustomerProfileRow> {
  let { data: profile, error: fetchError } = await supabaseAdmin
    .from('customer_profiles')
    .select('name, email, checkin_points, total_checkins, current_streak, longest_streak, created_at, member_since, last_checkin_date')
    .eq('user_id', user.id)
    .single();

  if (fetchError && !profile) {
    const { data: basicProfile } = await supabaseAdmin
      .from('customer_profiles')
      .select('name, email, created_at')
      .eq('user_id', user.id)
      .single();

    if (basicProfile) {
      profile = {
        ...basicProfile,
        member_since: null,
        checkin_points: 0,
        total_checkins: 0,
        current_streak: 0,
        longest_streak: 0,
        last_checkin_date: null,
      };
    }
  }

  if (profile) {
    return profile as CustomerProfileRow;
  }

  const { data: newProfile, error: insertError } = await supabaseAdmin
    .from('customer_profiles')
    .insert({
      user_id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Member',
    })
    .select('name, email, created_at')
    .single();

  if (insertError || !newProfile) {
    throw new Error(insertError?.message || 'Could not create loyalty profile.');
  }

  return {
    ...newProfile,
    member_since: null,
    checkin_points: 0,
    total_checkins: 0,
    current_streak: 0,
    longest_streak: 0,
    last_checkin_date: null,
  } as CustomerProfileRow;
}

export async function getLoyaltyMemberSnapshot(
  supabaseAdmin: SupabaseClient,
  user: User
): Promise<LoyaltyMemberSnapshot> {
  const profile = await loadCustomerProfile(supabaseAdmin, user);

  const profileEmail = profile.email || user.email;
  let posPoints = 0;

  if (profileEmail) {
    const { data: loyaltyRow } = await supabaseAdmin
      .from('loyalty_members')
      .select('points')
      .eq('email', profileEmail.toLowerCase())
      .maybeSingle();

    if (loyaltyRow) {
      posPoints = loyaltyRow.points || 0;
    }
  }

  const points = (profile.checkin_points || 0) + posPoints;
  const tier = computeTier(points);

  return {
    member: {
      userId: user.id,
      name: profile.name || user.email?.split('@')[0] || 'Member',
      email: profile.email || user.email || '',
      points,
      tier,
      totalCheckins: profile.total_checkins || 0,
      currentStreak: profile.current_streak || 0,
      memberSince: profile.member_since || profile.created_at,
    },
    longestStreak: profile.longest_streak || 0,
    lastCheckin: profile.last_checkin_date || null,
  };
}