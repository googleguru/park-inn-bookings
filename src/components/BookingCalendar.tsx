import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Clock } from "lucide-react";
import BookingModal from "./BookingModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DateStatus = "available" | "advanced" | "booked";

const SECTIONS = ["grand_hall", "sky_pavilion"] as const;

const BookingCalendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookedDates, setBookedDates] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("booking_date, status");

    if (error) {
      console.error("Error fetching bookings:", error);
      return;
    }

    const bookingsMap: Record<string, number> = {};
    data?.forEach((booking) => {
      if (booking.status === "booked" || booking.status === "advanced") {
        bookingsMap[booking.booking_date] = (bookingsMap[booking.booking_date] || 0) + 1;
      }
    });
    setBookedDates(bookingsMap);
  };

  const getDateStatus = (date: Date): DateStatus => {
    const dateString = date.toISOString().split("T")[0];
    const count = bookedDates[dateString] || 0;
    if (count >= SECTIONS.length) return "booked";
    if (count === 1) return "advanced";
    return "available";
  };

  const handleDateClick = (selected: Date | undefined) => {
    if (!selected) return;
    setDate(selected);

    if (getDateStatus(selected) === "booked") {
      toast.error("All sections are booked for this day. Please choose another date.");
      return;
    }

    setSelectedDate(selected);
    setShowBookingModal(true);
  };

  return (
    <section id="calendar" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Smart Availability Calendar</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Each date supports up to 2 section reservations. Secure payment links are generated after booking confirmation.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="p-8 shadow-elegant">
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-success/10 border-success/30"><CheckCircle className="w-4 h-4 text-success" />Available</Badge>
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-warning/30"><Clock className="w-4 h-4 text-warning" />1 of 2 sections booked</Badge>
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-destructive/30"><Lock className="w-4 h-4 text-destructive" />Fully booked (2/2)</Badge>
            </div>

            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateClick}
                modifiers={{
                  booked: (d) => getDateStatus(d) === "booked",
                  advanced: (d) => getDateStatus(d) === "advanced",
                  available: (d) => getDateStatus(d) === "available",
                }}
                modifiersStyles={{
                  booked: { backgroundColor: "hsl(var(--destructive))", color: "white", fontWeight: "bold" },
                  advanced: { backgroundColor: "hsl(var(--warning))", color: "hsl(var(--warning-foreground))", fontWeight: "bold" },
                  available: { backgroundColor: "hsl(var(--success) / 0.1)", color: "hsl(var(--success))", fontWeight: "500" },
                }}
                className="rounded-md border shadow-soft"
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </Card>
        </div>
      </div>

      <BookingModal open={showBookingModal} onOpenChange={setShowBookingModal} selectedDate={selectedDate} onBookingSuccess={fetchBookings} />
    </section>
  );
};

export default BookingCalendar;
