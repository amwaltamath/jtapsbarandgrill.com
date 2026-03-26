import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";

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

async function validateAdminAccess(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const { data: adminRow } = await supabaseAdmin
      .from("admin_users")
      .select("id, role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!adminRow) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function parseDateField(val: string): string | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
  // Try MM/DD/YYYY format
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try M/D/YYYY format
  if (parts.length === 2) return null;
  return null;
}

function computeTier(points: number): string {
  if (points >= 300) return "gold";
  if (points >= 100) return "silver";
  return "bronze";
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { "Content-Type": "application/json" };

  try {
    const userId = await validateAdminAccess(
      request.headers.get("Authorization") ?? ""
    );
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    const body = await request.json();
    const { records } = body as { records: POSRecord[] };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "No records provided" }),
        { status: 400, headers }
      );
    }

    let newSubscribers = 0;
    let updatedSubscribers = 0;
    let newLoyalty = 0;
    let updatedLoyalty = 0;
    const errors: string[] = [];

    for (const rec of records) {
      const email = rec.email?.trim().toLowerCase();
      const phone = formatPhone(rec.phone || "");
      const name = `${(rec.first || "").trim()} ${(rec.last || "").trim()}`.trim();
      const cardNumber = rec.card_number?.trim();

      if (!email && !phone) {
        errors.push(`Skipped: ${name || cardNumber} - no email or phone`);
        continue;
      }

      // --- Upsert newsletter_subscribers ---
      try {
        // Check if subscriber exists by email, phone, or pos_card_number
        let existingSub = null;
        if (email) {
          const { data } = await supabaseAdmin
            .from("newsletter_subscribers")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          existingSub = data;
        }
        if (!existingSub && phone) {
          const { data } = await supabaseAdmin
            .from("newsletter_subscribers")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();
          existingSub = data;
        }
        if (!existingSub && cardNumber) {
          const { data } = await supabaseAdmin
            .from("newsletter_subscribers")
            .select("id")
            .eq("pos_card_number", cardNumber)
            .maybeSingle();
          existingSub = data;
        }

        const subData: Record<string, unknown> = {
          name: name || null,
          pos_card_number: cardNumber || null,
          sms_opt_in: !!phone,
          email_opt_in: !!email,
          birthday: rec.birthday || null,
          address: rec.address?.trim() || null,
          city: rec.city?.trim() || null,
          state: rec.state?.trim() || null,
          zip: rec.zip?.trim() || null,
          gender: rec.gender?.trim() || null,
          pos_register_date: parseDateField(rec.register_date)
            ? new Date(parseDateField(rec.register_date)!).toISOString()
            : null,
          pos_last_visit: parseDateField(rec.last_visit)
            ? new Date(parseDateField(rec.last_visit)!).toISOString()
            : null,
        };
        if (email) subData.email = email;
        if (phone) subData.phone = phone;

        if (existingSub) {
          await supabaseAdmin
            .from("newsletter_subscribers")
            .update(subData)
            .eq("id", existingSub.id);
          updatedSubscribers++;
        } else {
          const { error: insertErr } = await supabaseAdmin
            .from("newsletter_subscribers")
            .insert(subData);
          if (insertErr) {
            errors.push(`Sub insert failed for ${name}: ${insertErr.message}`);
          } else {
            newSubscribers++;
          }
        }
      } catch (err) {
        errors.push(
          `Subscriber error for ${name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // --- Upsert loyalty_members ---
      if (email) {
        try {
          const { data: existingLoyalty } = await supabaseAdmin
            .from("loyalty_members")
            .select("id, points")
            .eq("email", email)
            .maybeSingle();

          const posPoints = parseFloat(String(rec.points)) || 0;
          const posTotalPoints = parseFloat(String(rec.total_points)) || 0;
          const posDollars = parseFloat(String(rec.dollars)) || 0;

          const loyaltyData: Record<string, unknown> = {
            name: name || null,
            phone: phone || null,
            pos_card_number: cardNumber || null,
            pos_points: posPoints,
            pos_total_points: posTotalPoints,
            pos_dollars: posDollars,
            pos_last_synced: new Date().toISOString(),
          };

          if (existingLoyalty) {
            // Use higher of existing app points or POS points
            const appPoints = existingLoyalty.points || 0;
            const effectivePoints = Math.max(appPoints, Math.round(posPoints));
            loyaltyData.points = effectivePoints;
            loyaltyData.tier = computeTier(effectivePoints);

            if (parseDateField(rec.last_visit)) {
              loyaltyData.last_visit = new Date(
                parseDateField(rec.last_visit)!
              ).toISOString();
            }

            await supabaseAdmin
              .from("loyalty_members")
              .update(loyaltyData)
              .eq("id", existingLoyalty.id);
            updatedLoyalty++;
          } else {
            loyaltyData.email = email;
            loyaltyData.points = Math.round(posPoints);
            loyaltyData.tier = computeTier(Math.round(posPoints));
            loyaltyData.joined_at = parseDateField(rec.register_date)
              ? new Date(parseDateField(rec.register_date)!).toISOString()
              : new Date().toISOString();

            if (parseDateField(rec.last_visit)) {
              loyaltyData.last_visit = new Date(
                parseDateField(rec.last_visit)!
              ).toISOString();
            }

            const { error: insertErr } = await supabaseAdmin
              .from("loyalty_members")
              .insert(loyaltyData);
            if (insertErr) {
              errors.push(
                `Loyalty insert failed for ${name}: ${insertErr.message}`
              );
            } else {
              newLoyalty++;
            }
          }
        } catch (err) {
          errors.push(
            `Loyalty error for ${name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // Log the import
    try {
      await supabaseAdmin.from("pos_import_log").insert({
        total_records: records.length,
        new_subscribers: newSubscribers,
        updated_subscribers: updatedSubscribers,
        new_loyalty: newLoyalty,
        updated_loyalty: updatedLoyalty,
        imported_by: userId,
      });
    } catch (logErr) {
      console.error("Failed to log POS import:", logErr);
    }

    return new Response(
      JSON.stringify({
        total: records.length,
        newSubscribers,
        updatedSubscribers,
        newLoyalty,
        updatedLoyalty,
        errors,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("POS import error:", err);
    const msg =
      err instanceof Error ? err.message : "Something went wrong";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers,
    });
  }
};
