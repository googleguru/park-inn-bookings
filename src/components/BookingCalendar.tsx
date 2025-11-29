import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Lock, Clock } from "lucide-react";
import BookingModal from "./BookingModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DateStatus = "available" | "advanced" | "booked";

const BookingCalendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookedDates, setBookedDates] = useState<Record<string, DateStatus>>({});

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

    const bookingsMap: Record<string, DateStatus> = {};
    data?.forEach((booking) => {
      bookingsMap[booking.booking_date] = booking.status as DateStatus;
    });
    setBookedDates(bookingsMap);
  };

  const getDateStatus = (date: Date): DateStatus => {
    const dateString = date.toISOString().split("T")[0];
    return bookedDates[dateString] || "available";
  };

  const handleDateClick = (date: Date | undefined) => {
    if (!date) return;

    const status = getDateStatus(date);

    if (status === "booked" || status === "advanced") {
      toast.error(
        "This date is already booked at Dhanlakshmi Park Inn. Please choose another date 💛",
        {
          duration: 4000,
        }
      );
      return;
    }

    setSelectedDate(date);
    setShowBookingModal(true);
  };

  const modifiers = {
    booked: (date: Date) => getDateStatus(date) === "booked",
    advanced: (date: Date) => getDateStatus(date) === "advanced",
    available: (date: Date) => getDateStatus(date) === "available",
  };

  const modifiersStyles = {
    booked: {
      backgroundColor: "hsl(var(--destructive))",
      color: "white",
      fontWeight: "bold",
    },
    advanced: {
      backgroundColor: "hsl(var(--warning))",
      color: "hsl(var(--warning-foreground))",
      fontWeight: "bold",
    },
    available: {
      backgroundColor: "hsl(var(--success) / 0.1)",
      color: "hsl(var(--success))",
      fontWeight: "500",
    },
  };

  return (
    <section id="calendar" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Booking Calendar
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select an available date to book your event at Dhanlakshmi Park Inn
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="p-8 shadow-elegant">
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Badge
                variant="outline"
                className="flex items-center gap-2 px-4 py-2 bg-success/10 border-success/30"
              >
                <CheckCircle className="w-4 h-4 text-success" />
                Available
              </Badge>
              <Badge
                variant="outline"
                className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-warning/30"
              >
                <Clock className="w-4 h-4 text-warning" />
                Advanced Booked
              </Badge>
              <Badge
                variant="outline"
                className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-destructive/30"
              >
                <Lock className="w-4 h-4 text-destructive" />
                Booked
              </Badge>
            </div>

            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateClick}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="rounded-md border shadow-soft"
                disabled={(date) => date < new Date()}
              />
            </div>

          </Card>
        </div>
      </div>

      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        selectedDate={selectedDate}
        onBookingSuccess={fetchBookings}
      />
    </section>
  );
};

export default BookingCalendar;
