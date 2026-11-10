import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = new Set([
  "https://googleguru.github.io",
  "http://localhost:8080",
  "http://localhost:5173",
]);

const corsHeadersFor = (origin: string | null): Record<string, string> => ({
  ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-isolate throttle: "pull" is triggered by every public page view.
const PULL_INTERVAL_MS = 5 * 60 * 1000;
let lastPullAt = 0;

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

interface Body {
  action: "create" | "delete" | "pull";
  bookingId?: string;
}

const gatewayHeaders = () => {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gcalKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
  if (!gcalKey) throw new Error("GOOGLE_CALENDAR_API_KEY not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gcalKey,
    "Content-Type": "application/json",
  };
};

const timeSlotToHours = (slot: string | null | undefined): [number, number] => {
  switch (slot) {
    case "morning": return [9, 12];
    case "afternoon": return [12, 16];
    case "evening": return [16, 20];
    case "night": return [20, 24];
    case "fullday":
    default: return [9, 22];
  }
};

const toIsoDateTime = (date: string, hour: number) => {
  const h = String(Math.min(23, Math.max(0, hour))).padStart(2, "0");
  return `${date}T${h}:00:00`;
};

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get("Origin"));
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.bookingId !== undefined && !UUID_RE.test(String(body.bookingId))) {
      return json({ error: "Invalid bookingId" }, 400);
    }

    // Resolve the caller from their own JWT; the anon key alone identifies no user.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    const isAdmin = async () => {
      if (!user?.email) return false;
      const { data } = await supabase
        .from("admin_roles")
        .select("id")
        .eq("email", user.email)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    };

    const headers = gatewayHeaders();

    // -------- CREATE event --------
    if (body.action === "create") {
      if (!body.bookingId) return json({ error: "bookingId required" }, 400);

      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (error || !booking) return json({ error: "booking not found" }, 404);
      if (!user || (booking.email !== user.email && !(await isAdmin()))) {
        return json({ error: "Forbidden" }, 403);
      }
      if (booking.google_calendar_event_id) return json({ ok: true, eventId: booking.google_calendar_event_id });

      const [startH, endH] = timeSlotToHours(booking.time_slot);
      const event = {
        summary: `${booking.event_type ?? "Event"} — ${booking.name ?? "Guest"}`,
        description: [
          `Status: ${booking.status}`,
          booking.email ? `Email: ${booking.email}` : "",
          booking.mobile ? `Mobile: ${booking.mobile}` : "",
          booking.guest_count ? `Guests: ${booking.guest_count}` : "",
          booking.notes ? `Notes: ${booking.notes}` : "",
        ].filter(Boolean).join("\n"),
        start: { dateTime: toIsoDateTime(booking.booking_date, startH), timeZone: "Asia/Kolkata" },
        end:   { dateTime: toIsoDateTime(booking.booking_date, endH),   timeZone: "Asia/Kolkata" },
        extendedProperties: { private: { lovable_booking_id: booking.id } },
      };

      const res = await fetch(`${GATEWAY_URL}/calendars/primary/events`, {
        method: "POST", headers, body: JSON.stringify(event),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("calendar create failed:", JSON.stringify(data));
        return json({ error: "Google Calendar create failed" }, 502);
      }

      await supabase
        .from("bookings")
        .update({ google_calendar_event_id: data.id })
        .eq("id", booking.id);

      return json({ ok: true, eventId: data.id });
    }

    // -------- DELETE event --------
    if (body.action === "delete") {
      if (!body.bookingId) return json({ error: "bookingId required" }, 400);

      const { data: booking } = await supabase
        .from("bookings")
        .select("google_calendar_event_id, email, status")
        .eq("id", body.bookingId)
        .maybeSingle();

      const isOwnerPending = !!user && booking?.email === user.email && booking?.status === "pending";
      if (!user || (!isOwnerPending && !(await isAdmin()))) {
        return json({ error: "Forbidden" }, 403);
      }

      const eventId = booking?.google_calendar_event_id;
      if (!eventId) return json({ ok: true, skipped: true });

      const res = await fetch(`${GATEWAY_URL}/calendars/primary/events/${eventId}`, {
        method: "DELETE", headers,
      });
      // 410 Gone is fine — already deleted upstream
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        console.error("calendar delete failed:", await res.text());
        return json({ error: "Google Calendar delete failed" }, 502);
      }
      await res.text();
      return json({ ok: true });
    }

    // -------- PULL: upsert external Google events as blocked dates --------
    if (body.action === "pull") {
      if (Date.now() - lastPullAt < PULL_INTERVAL_MS) return json({ ok: true, skipped: true });
      lastPullAt = Date.now();

      const now = new Date();
      const timeMin = new Date(now.getTime() - 7 * 86400000).toISOString();
      const timeMax = new Date(now.getTime() + 365 * 86400000).toISOString();
      const url = new URL(`${GATEWAY_URL}/calendars/primary/events`);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("orderBy", "startTime");

      const res = await fetch(url.toString(), { headers });
      const data = await res.json();
      if (!res.ok) {
        console.error("calendar pull failed:", JSON.stringify(data));
        return json({ error: "Google Calendar pull failed" }, 502);
      }

      const items: GoogleEvent[] = data.items ?? [];
      let upserts = 0;

      for (const ev of items) {
        const lovableId = ev.extendedProperties?.private?.lovable_booking_id;
        if (lovableId) continue; // already mirrors our booking — skip

        const startDate =
          ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
        if (!startDate) continue;

        // Skip cancelled
        if (ev.status === "cancelled") continue;

        // Upsert by google_calendar_event_id (find existing first)
        const { data: existing } = await supabase
          .from("bookings")
          .select("id")
          .eq("google_calendar_event_id", ev.id)
          .maybeSingle();

        if (existing) continue;

        await supabase.from("bookings").insert({
          booking_date: startDate,
          status: "booked",
          name: ev.summary ?? "Google Calendar event",
          event_type: "external",
          notes: ev.description ?? null,
          is_blocked: true,
          google_calendar_event_id: ev.id,
        });
        upserts++;
      }

      return json({ ok: true, processed: items.length, inserted: upserts });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("calendar-sync error:", e instanceof Error ? e.message : String(e));
    return json({ error: "Internal error" }, 500);
  }
});
