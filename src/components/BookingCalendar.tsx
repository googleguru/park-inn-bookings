import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle, Lock, Clock, Hourglass, Loader2, Phone, ShieldCheck, ShieldX } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BorderBeam } from "@/components/magicui/border-beam";
import BookingModal from "./BookingModal";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { api, ApiError, isApiConfigured, type SystemStatus } from "@/lib/api";

type DateStatus = "available" | "pending" | "booked";

const BookingCalendar = ({ visitDate }: { visitDate?: Date }) => {
  const [month, setMonth] = useState(new Date());
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const { customer, loading, openSignIn, requestAccess } = useClientAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const accessDialog = useRef<HTMLDialogElement>(null);
  const [showAccessPrompt, setShowAccessPrompt] = useState(false);
  const [wantsToBook, setWantsToBook] = useState(false);
  const [bookedDates, setBookedDates] = useState<Record<string, DateStatus>>({});
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(!isApiConfigured);
  const [accessForm, setAccessForm] = useState({ name: "", mobile: "" });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => { if (visitDate) { setDate(visitDate); setMonth(visitDate); } }, [visitDate]);

  useEffect(() => {
    const dialog = accessDialog.current;
    if (showAccessPrompt && customer && dialog && !dialog.open) dialog.showModal();
  }, [showAccessPrompt, customer]);

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await api<{ dates: Record<string, DateStatus> }>("availability");
      setBookedDates(res.dates);
      setAvailabilityReady(true);
    } catch (err) {
      setAvailabilityReady(false);
      console.error("Error fetching availability:", err);
    }
  }, []);

  useEffect(() => {
    if (!isApiConfigured) return;
    const refresh = () => {
      api<SystemStatus>("status")
        .then(setStatus)
        .catch(() => setStatus(null))
        .finally(() => setStatusLoaded(true));
      void fetchAvailability();
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [fetchAvailability]);

  const bookingOpen = !!status?.configured && status.bookingEnabled && availabilityReady;

  const getDateStatus = (d: Date): DateStatus => bookedDates[format(d, "yyyy-MM-dd")] ?? "available";

  const handleDateClick = (d: Date | undefined) => {
    if (!d) return;
    if (getDateStatus(d) === "booked") {
      toast.error("This date is already booked at Dhanlakshmi Park Inn. Please choose another date 💛", { duration: 4000 });
      return;
    }
    if (!bookingOpen) {
      toast("Please call us on 098414 14699 to book this date.", { duration: 5000 });
      return;
    }
    setSelectedDate(d);
    if (!customer) {
      openSignIn(() => setWantsToBook(true));
      return;
    }
    setWantsToBook(true);
  };

  // Decide once the profile (and its approval status) is known after sign-in.
  useEffect(() => {
    if (!wantsToBook || !customer) return;
    setWantsToBook(false);
    if (customer.access === "approved") setShowBookingModal(true);
    else {
      setAccessForm({ name: customer.name, mobile: customer.mobile });
      setShowAccessPrompt(true);
    }
  }, [wantsToBook, customer]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = accessForm.name.trim();
    const mobile = accessForm.mobile.replace(/[\s-]/g, "");
    if (!name) return toast.error("Please enter your name.");
    if (!/^\+?\d{10,13}$/.test(mobile)) return toast.error("Please enter a valid mobile number.");
    setRequesting(true);
    try {
      await requestAccess(name, mobile);
      toast.success("Request sent. We'll email you once it's approved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send your request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  const modifiers = {
    booked: (d: Date) => getDateStatus(d) === "booked",
    pending: (d: Date) => getDateStatus(d) === "pending",
    available: (d: Date) => getDateStatus(d) === "available",
  };

  const modifiersStyles = {
    booked: { backgroundColor: "hsl(var(--destructive))", color: "white", fontWeight: "bold" },
    pending: { backgroundColor: "hsl(var(--warning))", color: "hsl(var(--warning-foreground))", fontWeight: "bold" },
    available: { backgroundColor: "hsl(var(--success) / 0.1)", color: "hsl(var(--success))", fontWeight: "500" },
  };

  const access = customer?.access;

  return (
    <section id="calendar" className="relative py-24 md:py-32 bg-muted/40">
      <div className="container mx-auto px-4">
        <BlurFade inView className="text-center mb-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Availability</p>
          <h2 className="text-4xl md:text-5xl font-semibold mb-4">Booking Calendar</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select an available date to book your event at Dhanlakshmi Park Inn
          </p>
          {statusLoaded && !bookingOpen && (
            <p className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/25 bg-accent/50 px-5 py-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-primary" />
              Confirm availability by phone at
              <a href="tel:+919841414699" className="font-semibold text-primary hover:underline">098414 14699</a>

            </p>
          )}
          {bookingOpen && !customer && !loading && (
            <p className="mt-3 text-sm text-muted-foreground">Sign in with your email to request a booking</p>
          )}
          {bookingOpen && customer && access !== "approved" && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              {access === "pending" ? <Hourglass className="h-3.5 w-3.5 text-primary" /> : <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
              {access === "pending" ? "Your booking access is awaiting admin approval"
                : access === "rejected" || access === "blocked" ? "Online booking isn't available for your account"
                : "Pick a date to request booking access"}
            </p>
          )}
        </BlurFade>

        <BlurFade inView delay={0.1} className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden rounded-3xl border-border/70 p-6 md:p-10 shadow-elegant">
            <BorderBeam size={120} duration={10} colorFrom="hsl(var(--gold))" colorTo="hsl(var(--primary))" borderWidth={1.5} />
            {bookingOpen && <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Badge variant="outline" className="flex items-center gap-2 rounded-full px-4 py-1.5 font-medium bg-success/10 border-success/30">
                <CheckCircle className="w-4 h-4 text-success" />Available
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2 rounded-full px-4 py-1.5 font-medium bg-warning/10 border-warning/30">
                <Clock className="w-4 h-4 text-warning" />Requested
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2 rounded-full px-4 py-1.5 font-medium bg-destructive/10 border-destructive/30">
                <Lock className="w-4 h-4 text-destructive" />Booked
              </Badge>
            </div>}
            {date && <p aria-live="polite" className="mb-4 text-center font-medium">{format(date, "EEEE, d MMMM yyyy")}{bookingOpen ? " · " + getDateStatus(date) : " · Call to confirm"}</p>}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                month={month} onMonthChange={setMonth}
                selected={date}
                onDayClick={(d, modifiers) => {
                  if (modifiers.disabled) return;
                  setDate(d);
                  handleDateClick(d);
                }}
                modifiers={bookingOpen ? modifiers : {}}
                modifiersStyles={modifiersStyles}
                className="rounded-2xl border bg-background p-4 shadow-soft"
                disabled={(d) => format(d, "yyyy-MM-dd") < format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </Card>
        </BlurFade>
      </div>

      {/* Approval gate */}
      {customer && (
        <dialog
          ref={accessDialog}
          aria-labelledby="access-title"
          aria-describedby="access-description"
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border bg-card p-7 text-center text-card-foreground shadow-elegant backdrop:bg-secondary/40 backdrop:backdrop-blur-sm"
          onClose={() => setShowAccessPrompt(false)}
        >
            <BorderBeam size={80} duration={8} colorFrom="hsl(var(--gold))" colorTo="hsl(var(--primary))" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              {access === "pending" ? <Hourglass className="h-6 w-6 text-primary" />
                : access === "rejected" || access === "blocked" ? <ShieldX className="h-6 w-6 text-destructive" />
                : <ShieldCheck className="h-6 w-6 text-primary" />}
            </div>
            <h3 id="access-title" className="text-xl font-semibold">
              {access === "pending" ? "Approval pending"
                : access === "rejected" || access === "blocked" ? "Request not approved"
                : "Request booking access"}
            </h3>
            <p id="access-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {access === "pending"
                ? "Thanks! An admin is reviewing your account. We'll email you as soon as you can book."
                : access === "rejected" || access === "blocked"
                ? "Your account wasn't approved for online booking. Please call us and we'll help you directly."
                : "To keep our calendar genuine, an admin approves each customer once before their first booking."}
            </p>
            <p className="mt-3 truncate rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">{customer.email}</p>

            {access === "none" ? (
              <form onSubmit={handleRequestAccess} className="mt-5 space-y-3 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="access-name">Your name</Label>
                  <Input
                    id="access-name"
                    autoComplete="name"
                    maxLength={100}
                    value={accessForm.name}
                    onChange={(e) => setAccessForm({ ...accessForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="access-mobile">Mobile number</Label>
                  <Input
                    id="access-mobile"
                    type="tel"
                    autoComplete="tel"
                    maxLength={16}
                    placeholder="+91 XXXXX XXXXX"
                    value={accessForm.mobile}
                    onChange={(e) => setAccessForm({ ...accessForm, mobile: e.target.value })}
                  />
                </div>
                <Button type="submit" className="h-11 w-full gap-2 rounded-full" disabled={requesting}>
                  {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {requesting ? "Sending…" : "Request access"}
                </Button>
              </form>
            ) : access === "rejected" || access === "blocked" ? (
              <Button asChild className="mt-6 h-11 w-full rounded-full">
                <a href="tel:+919841414699">Call 098414 14699</a>
              </Button>
            ) : null}
            <Button variant="ghost" className="mt-2 w-full rounded-full" onClick={() => accessDialog.current?.close()}>
              Close
            </Button>
        </dialog>
      )}

      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        selectedDate={selectedDate}
        onBookingSuccess={fetchAvailability}
      />
    </section>
  );
};

export default BookingCalendar;
