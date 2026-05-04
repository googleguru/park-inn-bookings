// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BookingData {
  id: string;
  booking_date: string;
  name: string | null;
  event_type: string | null;
  time_slot: string | null;
  notes: string | null;
}

console.log("Google Calendar Event Creator Function")

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const bookingData: BookingData = await req.json()

    // In a real implementation, you would:
    // 1. Use Google Calendar API with OAuth credentials
    // 2. Create an event with the booking details
    // 3. Return the actual event ID

    // For this demo, we'll simulate creating an event
    const mockEventId = `event_${bookingData.id}_${Date.now()}`

    // Update the booking with the event ID
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { error } = await supabase
      .from('bookings')
      .update({ google_calendar_event_id: mockEventId })
      .eq('id', bookingData.id)

    if (error) {
      console.error('Error updating booking:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update booking' }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const data = {
      message: 'Google Calendar event created successfully',
      eventId: mockEventId,
      bookingId: bookingData.id
    }

    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
