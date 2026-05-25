import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Calendar, LogOut, Mail, User as UserIcon, X } from "lucide-react";

interface BookingRow {
  id: string;
  booking_date: string;
  status: string;
  event_type: string | null;
  guest_count: number | null;
  time_slot: string | null;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/40",
  approved: "bg-success/15 text-success border-success/40",
  booked: "bg-destructive/15 text-destructive border-destructive/40",
  rejected: "bg-muted text-muted-foreground border-border",
};

const Profile = () => {
  const { clientUser, loading, signOut } = useClientAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = async () => {
    if (!clientUser) return;
    setFetching(true);
    const { data } = await supabase
      .from("bookings")
      .select("id,booking_date,status,event_type,guest_count,time_slot,created_at")
      .eq("email", clientUser.email)
      .order("booking_date", { ascending: false });
    setBookings((data ?? []) as BookingRow[]);
    setFetching(false);
  };

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientUser]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      // 1. Remove the matching Google Calendar event first (best-effort).
      try {
        await supabase.functions.invoke("calendar-sync", {
          body: { action: "delete", bookingId: cancelTarget.id },
        });
      } catch (err) {
        console.warn("Google Calendar delete skipped:", err);
      }

      // 2. Delete the booking (RLS allows only own pending rows).
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", cancelTarget.id);

      if (error) {
        toast.error("Could not cancel booking. Please try again.");
        console.error(error);
      } else {
        toast.success("Booking cancelled.");
        setBookings((prev) => prev.filter((b) => b.id !== cancelTarget.id));
      }
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

  if (!clientUser) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-28 pb-16 max-w-4xl space-y-8">
        <Card className="shadow-elegant">
          <CardHeader className="flex flex-row items-center gap-4">
            {clientUser.avatarUrl ? (
              <img
                src={clientUser.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full border-2 border-primary/20"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="text-primary" />
              </div>
            )}
            <div className="flex-1">
              <CardTitle className="text-2xl">{clientUser.name}</CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <Mail size={13} /> {clientUser.email}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut size={14} /> Sign out
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar size={20} className="text-primary" /> My Bookings
            </CardTitle>
            <CardDescription>
              Your booking requests at Dhanlakshmi Park Inn
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetching ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" size={22} />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">No bookings yet.</p>
                <Button asChild>
                  <Link to="/#calendar">Book your first event</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        {new Date(b.booking_date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {b.event_type ?? "Event"} · {b.time_slot ?? "—"}
                        {b.guest_count ? ` · ${b.guest_count} guests` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize ${statusStyles[b.status] ?? ""}`}
                    >
                      {b.status}
                    </Badge>
                    {b.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
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
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Your pending booking for{" "}
                  <strong>
                    {new Date(cancelTarget.booking_date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>{" "}
                  will be removed and the date will become available again.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep booking</AlertDialogCancel>
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
