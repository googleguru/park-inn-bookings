import BookingCalendar from "@/components/BookingCalendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, PartyPopper, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Premium Event Destination</Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl">
            Dhanlakshmi Park Inn Booking Portal
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-3xl">
            Elegant celebrations, seamless corporate meets, and memorable family gatherings — now with smart slot booking, dual-section availability, and secure payment links.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[
              { icon: PartyPopper, title: "Celebrations", desc: "Weddings, birthdays, receptions" },
              { icon: Building2, title: "Corporate", desc: "Meetings, launches, seminars" },
              { icon: Users, title: "Family Events", desc: "Reunions and private gatherings" },
            ].map((item) => (
              <Card key={item.title} className="p-5 bg-card/70 backdrop-blur border-primary/10">
                <item.icon className="w-5 h-5 text-primary" />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Up to 2 section bookings per day (Grand Hall & Sky Pavilion)</span>
          </div>
        </div>
      </section>

      <BookingCalendar />
    </div>
  );
};

export default Index;
