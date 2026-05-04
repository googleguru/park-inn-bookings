import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock, Calendar } from "lucide-react";

type Booking = {
  id: string;
  booking_date: string;
  status: "pending" | "approved" | "rejected" | "booked";
  name: string | null;
  mobile: string | null;
  email: string | null;
  event_type: string | null;
  guest_count: number | null;
  time_slot: string | null;
  notes: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
};

const Admin = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch bookings");
      console.error("Error fetching bookings:", error);
      return;
    }

    setBookings(data || []);
    setLoading(false);
  };

  const updateBookingStatus = async (id: string, status: "pending" | "approved" | "rejected" | "booked") => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update booking status");
      console.error("Error updating booking:", error);
      return;
    }

    // If approved, create Google Calendar event
    if (status === "approved") {
      await createGoogleCalendarEvent(id);
    }

    toast.success(`Booking ${status}`);
    fetchBookings();
  };

  const createGoogleCalendarEvent = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          id: booking.id,
          booking_date: booking.booking_date,
          name: booking.name,
          event_type: booking.event_type,
          time_slot: booking.time_slot,
          notes: booking.notes,
        }
      });

      if (error) {
        console.error('Error creating calendar event:', error);
        toast.error('Failed to create Google Calendar event');
        return;
      }

      toast.success('Google Calendar event created successfully');
      console.log('Calendar event created:', data);
    } catch (err) {
      console.error('Error invoking function:', err);
      toast.error('Failed to create Google Calendar event');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "booked":
        return <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />Booked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
            Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage booking requests at Dhanlakshmi Park Inn
          </p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Booking Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{new Date(booking.booking_date).toLocaleDateString()}</TableCell>
                    <TableCell>{booking.name}</TableCell>
                    <TableCell>
                      <div>
                        <div>{booking.email}</div>
                        <div className="text-sm text-muted-foreground">{booking.mobile}</div>
                      </div>
                    </TableCell>
                    <TableCell>{booking.event_type}</TableCell>
                    <TableCell>{booking.guest_count}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell>
                      <Select
                        value={booking.status}
                        onValueChange={(value: "pending" | "approved" | "rejected" | "booked") =>
                          updateBookingStatus(booking.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approve</SelectItem>
                          <SelectItem value="rejected">Reject</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;