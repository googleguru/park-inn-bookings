import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, LogOut, Mail, User as UserIcon } from "lucide-react";

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

  useEffect(() => {
    if (!clientUser) return;
    setFetching(true);
    supabase
      .from("bookings")
      .select("id,booking_date,status,event_type,guest_count,time_slot,created_at")
      .eq("email", clientUser.email)
      .order("booking_date", { ascending: false })
      .then(({ data }) => {
        setBookings((data ?? []) as BookingRow[]);
        setFetching(false);
      });
  }, [clientUser]);

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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
