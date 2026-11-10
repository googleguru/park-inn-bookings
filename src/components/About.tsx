import {
  MapPin,
  Car,
  Sparkles,
  Users,
  Music,
  UtensilsCrossed,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { MagicCard } from "@/components/magicui/magic-card";
import ScrollRevealParagraph from "@/components/smoothui/scroll-reveal-paragraph";

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
      description: "Trusted catering partners for delicious experiences",
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
    <section id="about" className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20 mb-16 md:mb-24">
          <BlurFade inView>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              The venue
            </p>
            <h2 className="text-balance text-4xl md:text-5xl font-semibold leading-tight">
              About Dhanlakshmi <span className="italic text-primary">Park Inn</span>
            </h2>
          </BlurFade>
          <div className="space-y-6">
            <ScrollRevealParagraph
              className="font-serif text-2xl md:text-3xl leading-snug"
              paragraph="Dhanlakshmi Park Inn is designed for joy. Whether it's a dream wedding, a golden jubilee, or a power-packed corporate meet, our spaces, services, and team are here to make everything effortless and memorable."
            />
            <BlurFade inView delay={0.1}>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We believe every celebration deserves the perfect backdrop. From the moment you
                step in, our venue transforms your vision into reality with attention to every
                detail.
              </p>
            </BlurFade>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {facilities.map((facility, index) => (
            <BlurFade key={facility.title} inView delay={0.05 * index} className="rounded-2xl">
              <MagicCard
                className="h-full rounded-2xl"
                gradientColor="hsl(40 60% 88% / 0.6)"
                gradientFrom="hsl(var(--gold))"
                gradientTo="hsl(var(--primary))"
                gradientSize={260}
              >
                <div className="flex h-full flex-col gap-5 p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-accent/60">
                    <facility.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{facility.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{facility.description}</p>
                  </div>
                </div>
              </MagicCard>
            </BlurFade>
          ))}
        </div>

        <BlurFade inView className="mt-20 md:mt-28">
          <figure className="mx-auto max-w-3xl text-center">
            <span aria-hidden="true" className="block font-serif text-6xl leading-none text-gold">
              “
            </span>
            <blockquote className="text-balance font-serif text-3xl md:text-4xl italic leading-snug text-foreground">
              Creating beautiful memories, one celebration at a time
            </blockquote>
          </figure>
        </BlurFade>
      </div>
    </section>
  );
};

export default About;
