import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import heroImage from "@/assets/venue-hero.png";

const Hero = () => {
  const scrollToCalendar = () => {
    const element = document.getElementById("calendar");
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${heroImage})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom duration-1000">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight">
            Book Your Special Day at{" "}
            <span className="text-primary">Dhanlakshmi Park Inn</span>
          </h2>

          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto">
            From intimate gatherings to grand celebrations, we're here to make
            your moments unforgettable.
          </p>

          <div className="pt-6">
            <Button
              size="lg"
              onClick={scrollToCalendar}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 rounded-full shadow-elegant hover:scale-105 transition-all duration-300"
            >
              Check Availability & Book Now
              <ArrowDown className="ml-2 animate-bounce" />
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="text-primary w-8 h-8" />
      </div>
    </section>
  );
};

export default Hero;
