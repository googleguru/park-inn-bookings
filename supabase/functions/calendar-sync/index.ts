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
const CONFIRMED = ["approved", "booked"];
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
    const url = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.bookingId !== undefined && !UUID_RE.test(String(body.bookingId))) {
      return json({ error: "Invalid bookingId" }, 400);
    }

    // Resolve the caller from their own JWT; the anon key alone identifies no user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    // Ask the database with the caller's own token so the Google-only and
    // single-device admin checks in is_admin() apply here too.
    const isAdmin = async () => {
      if (!user) return false;
      const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await asCaller.rpc("is_admin");
      return data === true;
    };

    const headers = gatewayHeaders();

    // -------- CREATE event (admins, confirmed bookings only) --------
    if (body.action === "create") {
      if (!body.bookingId) return json({ error: "bookingId required" }, 400);
      if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);

      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (error || !booking) return json({ error: "booking not found" }, 404);
      if (!CONFIRMED.includes(booking.status)) {
        return json({ error: "Only approved bookings are added to Google Calendar" }, 409);
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

      const res = await fetch(`${GATEWAY_URL}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE", headers,
      });
      // 410 Gone is fine — already deleted upstream
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        console.error("calendar delete failed:", await res.text());
        return json({ error: "Google Calendar delete failed" }, 502);
      }
      await res.text();
      await supabase
        .from("bookings")
        .update({ google_calendar_event_id: null })
        .eq("id", body.bookingId);
      return json({ ok: true });
    }

    // -------- PULL: the admin's Google Calendar is the master for dates --------
    if (body.action === "pull") {
      if (Date.now() - lastPullAt < PULL_INTERVAL_MS) return json({ ok: true, skipped: true });
      lastPullAt = Date.now();

      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 86400000);
      const windowEnd = new Date(now.getTime() + 365 * 86400000);

      // Read every page: a missing event is only treated as deleted when the
      // listing is known to be complete.
      const items: GoogleEvent[] = [];
      let pageToken: string | undefined;
      do {
        const listUrl = new URL(`${GATEWAY_URL}/calendars/primary/events`);
        listUrl.searchParams.set("timeMin", windowStart.toISOString());
        listUrl.searchParams.set("timeMax", windowEnd.toISOString());
        listUrl.searchParams.set("singleEvents", "true");
        listUrl.searchParams.set("maxResults", "250");
        if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

        const res = await fetch(listUrl.toString(), { headers });
        const data = await res.json();
        if (!res.ok) {
          console.error("calendar pull failed:", JSON.stringify(data));
          lastPullAt = 0;
          return json({ error: "Google Calendar pull failed" }, 502);
        }
        items.push(...((data.items ?? []) as GoogleEvent[]));
        pageToken = data.nextPageToken;
      } while (pageToken);

      const startDateOf = (ev: GoogleEvent) =>
        ev.start?.date ?? (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
      const live = new Map<string, GoogleEvent>();
      for (const ev of items) if (ev.status !== "cancelled" && startDateOf(ev)) live.set(ev.id, ev);

      const from = windowStart.toISOString().slice(0, 10);
      const to = windowEnd.toISOString().slice(0, 10);
      const { data: linked, error: linkedError } = await supabase
        .from("bookings")
        .select("id, booking_date, status, is_blocked, google_calendar_event_id")
        .not("google_calendar_event_id", "is", null)
        .gte("booking_date", from)
        .lte("booking_date", to);
      if (linkedError) throw linkedError;

      const known = new Set<string>();
      let inserted = 0, moved = 0, removed = 0;

      for (const b of linked ?? []) {
        const eventId = b.google_calendar_event_id as string;
        known.add(eventId);
        const ev = live.get(eventId);

        if (!ev) {
          if (b.is_blocked) {
            // Blocked date that came from Google and was deleted there.
            await supabase.from("bookings").delete().eq("id", b.id);
            removed++;
          } else if (CONFIRMED.includes(b.status)) {
            await supabase.from("bookings").update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              admin_notes: "Event was deleted from the admin Google Calendar",
            }).eq("id", b.id);
            removed++;
          }
          continue;
        }

        const date = startDateOf(ev)!;
        if (date !== b.booking_date) {
          const { error } = await supabase.from("bookings").update({ booking_date: date }).eq("id", b.id);
          if (error) console.error("could not move booking", b.id, error.message);
          else moved++;
        }
      }

      for (const ev of live.values()) {
        if (known.has(ev.id) || ev.extendedProperties?.private?.lovable_booking_id) continue;
        const { error } = await supabase.from("bookings").insert({
          booking_date: startDateOf(ev)!,
          status: "booked",
          name: ev.summary ?? "Google Calendar event",
          event_type: "external",
          notes: ev.description ?? null,
          is_blocked: true,
          google_calendar_event_id: ev.id,
        });
        if (error) console.error("could not import event", ev.id, error.message);
        else inserted++;
      }

      return json({ ok: true, processed: items.length, inserted, moved, removed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("calendar-sync error:", e instanceof Error ? e.message : String(e));
    return json({ error: "Internal error" }, 500);
  }
});
