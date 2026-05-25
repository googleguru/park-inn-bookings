import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Lock, Clock, LogIn } from "lucide-react";
import BookingModal from "./BookingModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/contexts/ClientAuthContext";

type DateStatus = "available" | "pending" | "approved" | "rejected" | "booked";

const BookingCalendar = () => {
  const { clientUser, signIn, signInWithEmail, signUpWithEmail, loading } = useClientAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookedDates, setBookedDates] = useState<Record<string, DateStatus>>({});
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookedDates, setBookedDates] = useState<Record<string, DateStatus>>({});

  useEffect(() => {
    // Pull latest Google Calendar events into our DB, then load availability.
    supabase.functions
      .invoke("calendar-sync", { body: { action: "pull" } })
      .catch((err) => console.warn("Google Calendar pull skipped:", err))
      .finally(fetchBookings);

    // Live updates whenever bookings change in the DB.
    const channel = supabase
      .channel("bookings-availability")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchBookings(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBookings = async () => {
    const { data, error } = await (supabase as any).rpc("get_booked_dates");
    if (error) {
      console.error("Error fetching availability:", error);
      return;
    }
    const bookingsMap: Record<string, DateStatus> = {};
    (data ?? []).forEach((row: { booking_date: string; status: string }) => {
      bookingsMap[row.booking_date] = row.status as DateStatus;
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

    if (status === "booked" || status === "approved") {
      toast.error(
        "This date is already booked at Dhanlakshmi Park Inn. Please choose another date 💛",
        { duration: 4000 }
      );
      return;
    }

    setSelectedDate(date);

    if (!clientUser) {
      setShowSignInPrompt(true);
      return;
    }

    setShowBookingModal(true);
  };

  const modifiers = {
    booked:    (date: Date) => getDateStatus(date) === "booked",
    approved:  (date: Date) => getDateStatus(date) === "approved",
    pending:   (date: Date) => getDateStatus(date) === "pending",
    available: (date: Date) => getDateStatus(date) === "available",
  };

  const modifiersStyles = {
    booked:    { backgroundColor: "hsl(var(--destructive))", color: "white", fontWeight: "bold" },
    approved:  { backgroundColor: "hsl(var(--destructive))", color: "white", fontWeight: "bold" },
    pending:   { backgroundColor: "hsl(var(--warning))", color: "hsl(var(--warning-foreground))", fontWeight: "bold" },
    available: { backgroundColor: "hsl(var(--success) / 0.1)", color: "hsl(var(--success))", fontWeight: "500" },
  };

  return (
    <section id="calendar" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Booking Calendar</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select an available date to book your event at Dhanlakshmi Park Inn
          </p>
          {!clientUser && !loading && (
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in with Google to request a booking
            </p>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="p-8 shadow-elegant">
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-success/10 border-success/30">
                <CheckCircle className="w-4 h-4 text-success" />Available
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-warning/30">
                <Clock className="w-4 h-4 text-warning" />Advanced Booked
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-destructive/30">
                <Lock className="w-4 h-4 text-destructive" />Booked
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

      {/* Sign-in prompt overlay */}
      {showSignInPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="text-center space-y-2">
              <LogIn className="mx-auto h-10 w-10 text-primary" />
              <h3 className="text-lg font-semibold">Sign in to Book</h3>
              <p className="text-sm text-muted-foreground">
                Please sign in with your Google account to request a booking. Admin approval is required before confirmation.
              </p>
            </div>
            <Button className="w-full gap-3 h-11" onClick={signIn}>
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowSignInPrompt(false)}>
              Cancel
            </Button>
          </Card>
        </div>
      )}

      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        selectedDate={selectedDate}
        onBookingSuccess={fetchBookings}
        clientUser={clientUser}
      />
    </section>
  );
};

export default BookingCalendar;
