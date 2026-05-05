const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end:   { date?: string; dateTime?: string };
}

interface BookingInfo {
  date: string;        // YYYY-MM-DD
  name: string;
  eventType: string;
  guestCount?: number | null;
  timeSlot?: string | null;
  mobile?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
}

function buildEvent(b: BookingInfo) {
  return {
    summary: `Park Inn: ${b.eventType} — ${b.name}`,
    description: [
      `Event: ${b.eventType}`,
      `Guests: ${b.guestCount ?? 'TBD'}`,
      `Time: ${b.timeSlot ?? 'TBD'}`,
      `Mobile: ${b.mobile ?? 'N/A'}`,
      b.notes      ? `Guest notes: ${b.notes}`      : null,
      b.adminNotes ? `Admin notes: ${b.adminNotes}` : null,
    ].filter(Boolean).join('\n'),
    start: { date: b.date },
    end:   { date: b.date },
    colorId: '2', // sage green
  };
}

async function callApi(url: string, method: string, token: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Google Calendar API error ${res.status}`);
  }
  return res.json();
}

export async function createCalendarEvent(token: string, booking: BookingInfo): Promise<string> {
  const data = await callApi(BASE, 'POST', token, buildEvent(booking));
  return data.id as string;
}

export async function updateCalendarEvent(token: string, eventId: string, booking: BookingInfo): Promise<void> {
  await callApi(`${BASE}/${eventId}`, 'PUT', token, buildEvent(booking));
}

export async function deleteCalendarEvent(token: string, eventId: string): Promise<void> {
  await callApi(`${BASE}/${eventId}`, 'DELETE', token);
}

export async function listCalendarEvents(token: string, timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const p = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const data = await callApi(`${BASE}?${p}`, 'GET', token);
  return (data?.items ?? []) as GCalEvent[];
}
