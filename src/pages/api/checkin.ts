import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { pushWalletUpdateForUser } from "../../lib/apns";

const POINTS_PER_CHECKIN = 10;
const STREAK_BONUS = 5; // extra points for 3+ day streak

// JTAPS location: 6441 Glenway Ave, Cincinnati, OH 45211
const JTAPS_LAT = 39.1455;
const JTAPS_LNG = -84.6175;
const MAX_DISTANCE_MILES = 0.3; // ~0.3 mile radius

function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getUserFromToken(authHeader?: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const user = await getUserFromToken(request.headers.get("Authorization"));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized. Please log in." }), { status: 401, headers });
    }

    const body = await request.json();
    const { latitude, longitude } = body;

    // Validate geolocation if provided
    let method = "manual";
    if (latitude != null && longitude != null) {
      const distance = getDistanceMiles(latitude, longitude, JTAPS_LAT, JTAPS_LNG);
      if (distance > MAX_DISTANCE_MILES) {
        return new Response(
          JSON.stringify({
            error: "You need to be at JTAPS to check in! You appear to be too far away.",
            distance: Math.round(distance * 100) / 100
          }),
          { status: 400, headers }
        );
      }
      method = "geo";
    }

    // Check if user already checked in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: existingCheckin } = await supabaseAdmin
      .from("customer_checkins")
      .select("id")
      .eq("user_id", user.id)
      .gte("checked_in_at", todayStart.toISOString())
      .lte("checked_in_at", todayEnd.toISOString())
      .maybeSingle();

    if (existingCheckin) {
      return new Response(
        JSON.stringify({ error: "You've already checked in today! Come back tomorrow." }),
        { status: 400, headers }
      );
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: profile } = await supabaseAdmin
      .from("customer_profiles")
      .select("checkin_points, total_checkins, current_streak, longest_streak, last_checkin_date")
      .eq("user_id", user.id)
      .single();

    let currentStreak = 1;
    let longestStreak = profile?.longest_streak || 0;

    if (profile?.last_checkin_date === yesterdayStr) {
      // Consecutive day — extend streak
      currentStreak = (profile?.current_streak || 0) + 1;
    }
    // If last check-in was today (shouldn't happen due to guard above) or earlier, reset to 1

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Calculate points
    let pointsAwarded = POINTS_PER_CHECKIN;
    if (currentStreak >= 3) {
      pointsAwarded += STREAK_BONUS; // streak bonus
    }

    // Insert check-in record
    const { error: insertError } = await supabaseAdmin
      .from("customer_checkins")
      .insert({
        user_id: user.id,
        points_awarded: pointsAwarded,
        latitude: latitude || null,
        longitude: longitude || null,
        method
      });

    if (insertError) {
      console.error("Check-in insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record check-in. Please try again." }),
        { status: 500, headers }
      );
    }

    // Update customer profile with points and streak
    const todayStr = new Date().toISOString().split("T")[0];
    const newTotalCheckins = (profile?.total_checkins || 0) + 1;
    const newCheckinPoints = (profile?.checkin_points || 0) + pointsAwarded;

    await supabaseAdmin
      .from("customer_profiles")
      .update({
        checkin_points: newCheckinPoints,
        total_checkins: newTotalCheckins,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_checkin_date: todayStr
      })
      .eq("user_id", user.id);

    // Fire-and-forget: notify Apple Wallet devices of the points change
    pushWalletUpdateForUser(supabaseAdmin, user.id).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        points_awarded: pointsAwarded,
        total_points: newCheckinPoints,
        total_checkins: newTotalCheckins,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        streak_bonus: currentStreak >= 3
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Check-in error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Check-in failed" }),
      { status: 500, headers }
    );
  }
};

// GET: Fetch check-in status and history for the logged-in user
export const GET: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const user = await getUserFromToken(request.headers.get("Authorization"));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    // Get profile stats
    const { data: profile } = await supabaseAdmin
      .from("customer_profiles")
      .select("checkin_points, total_checkins, current_streak, longest_streak, last_checkin_date")
      .eq("user_id", user.id)
      .single();

    // Check if already checked in today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: todayCheckin } = await supabaseAdmin
      .from("customer_checkins")
      .select("id")
      .eq("user_id", user.id)
      .gte("checked_in_at", todayStart.toISOString())
      .lte("checked_in_at", todayEnd.toISOString())
      .maybeSingle();

    // Get recent check-in history
    const { data: history } = await supabaseAdmin
      .from("customer_checkins")
      .select("id, points_awarded, checked_in_at, method")
      .eq("user_id", user.id)
      .order("checked_in_at", { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        checked_in_today: Boolean(todayCheckin),
        checkin_points: profile?.checkin_points || 0,
        total_checkins: profile?.total_checkins || 0,
        current_streak: profile?.current_streak || 0,
        longest_streak: profile?.longest_streak || 0,
        last_checkin_date: profile?.last_checkin_date || null,
        history: history || []
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Check-in status error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch check-in status" }),
      { status: 500, headers }
    );
  }
};
