import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

interface Body {
  action: "create" | "delete" | "pull";
  bookingId?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
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
      if (!res.ok) return json({ error: "Google Calendar create failed", details: data }, 502);

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
        .select("google_calendar_event_id")
        .eq("id", body.bookingId)
        .maybeSingle();

      const eventId = booking?.google_calendar_event_id;
      if (!eventId) return json({ ok: true, skipped: true });

      const res = await fetch(`${GATEWAY_URL}/calendars/primary/events/${eventId}`, {
        method: "DELETE", headers,
      });
      // 410 Gone is fine — already deleted upstream
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        const detail = await res.text();
        return json({ error: "Google Calendar delete failed", details: detail }, 502);
      }
      await res.text();
      return json({ ok: true });
    }

    // -------- PULL: upsert external Google events as blocked dates --------
    if (body.action === "pull") {
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
      if (!res.ok) return json({ error: "Google Calendar pull failed", details: data }, 502);

      const items: any[] = data.items ?? [];
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
    const msg = e instanceof Error ? e.message : String(e);
    console.error("calendar-sync error:", msg);
    return json({ error: msg }, 500);
  }
});
