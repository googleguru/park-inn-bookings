import { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Calendar, LogOut, Mail, X } from "lucide-react";
import { api, ApiError, type CustomerBooking } from "@/lib/api";
import { BOOKING_STATUS, eventTypeLabel, slotLabel } from "@/lib/booking";

const ACCESS_LABEL: Record<string, string> = {
  none: "Not requested yet",
  pending: "Waiting for admin approval",
  approved: "Approved to book online",
  rejected: "Not approved for online booking",
  blocked: "Not approved for online booking",
};

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const Profile = () => {
  const { customer, token, loading, signOut } = useClientAuth();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [fetching, setFetching] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<CustomerBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await api<{ bookings: CustomerBooking[] }>("myBookings", {}, token);
      setBookings(res.bookings);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load your bookings.");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api("myBookingCancel", { id: cancelTarget.id }, token);
      toast.success("Booking request cancelled.");
      setBookings((prev) => prev.map((b) => (b.id === cancelTarget.id ? { ...b, status: "cancelled" } : b)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel. Please try again.");
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!customer) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-28 pb-16 max-w-4xl space-y-8">
        <Card className="rounded-3xl shadow-elegant">
          <CardHeader className="flex flex-row flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent font-serif text-2xl text-primary">
              {(customer.name || customer.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-2xl">{customer.name || "Welcome"}</CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1.5">
                <Mail size={13} /> <span className="truncate">{customer.email}</span>
              </CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">{ACCESS_LABEL[customer.access]}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5 rounded-full">
              <LogOut size={14} /> Sign out
            </Button>
          </CardHeader>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar size={20} className="text-primary" /> My Bookings
            </CardTitle>
            <CardDescription>Your booking requests at Dhanlakshmi Park Inn</CardDescription>
          </CardHeader>
          <CardContent>
            {fetching ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" size={22} />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">No bookings yet.</p>
                <Button asChild className="rounded-full">
                  <Link to="/">Book your first event</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{longDate(b.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {eventTypeLabel(b.eventType)} · {slotLabel(b.slot)}
                        {b.guests ? ` · ${b.guests} guests` : ""}
                      </p>
                    </div>
                    <Badge className={`w-fit border-0 ${BOOKING_STATUS[b.status]?.cls ?? ""}`}>
                      {BOOKING_STATUS[b.status]?.label ?? b.status}
                    </Badge>
                    {b.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setCancelTarget(b)}
                      >
                        <X size={14} /> Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Your pending request for <strong>{longDate(cancelTarget.date)}</strong> will be cancelled.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="animate-spin mr-1.5" size={14} /> Cancelling…
                </>
              ) : (
                "Yes, cancel"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
