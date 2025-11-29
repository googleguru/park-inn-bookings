import { Card } from "@/components/ui/card";
import {
  MapPin,
  Car,
  Sparkles,
  Users,
  Music,
  UtensilsCrossed,
} from "lucide-react";

const About = () => {
  const facilities = [
    {
      icon: MapPin,
      title: "Prime Location",
      description: "Centrally located with easy access from all parts of the city",
    },
    {
      icon: Car,
      title: "Ample Parking",
      description: "Spacious parking facility for all your guests",
    },
    {
      icon: Sparkles,
      title: "Décor Support",
      description: "Professional decoration services to match your vision",
    },
    {
      icon: UtensilsCrossed,
      title: "Catering Tie-ups",
      description: "Premium catering partners for delicious experiences",
    },
    {
      icon: Music,
      title: "Audio-Visual",
      description: "State-of-the-art sound and lighting systems",
    },
    {
      icon: Users,
      title: "Flexible Capacity",
      description: "Suitable for intimate gatherings to grand celebrations",
    },
  ];

  return (
    <section id="about" className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            About Dhanlakshmi Park Inn
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Dhanlakshmi Park Inn is designed for joy. Whether it's a dream
              wedding, a golden jubilee, or a power-packed corporate meet, our
              spaces, services, and team are here to make everything effortless
              and memorable.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe every celebration deserves the perfect backdrop. From
              the moment you step in, our venue transforms your vision into
              reality with attention to every detail.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((facility, index) => (
            <Card
              key={index}
              className="p-6 hover:shadow-elegant transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <facility.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{facility.title}</h3>
                <p className="text-muted-foreground">{facility.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Card className="p-8 bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 border-2 border-primary/20">
            <p className="text-xl md:text-2xl font-medium text-foreground">
              "Creating beautiful memories, one celebration at a time"
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default About;
