import { ArrowDown, ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import heroImage from "@/assets/venue-hero.webp";
import { BlurFade } from "@/components/magicui/blur-fade";
import { WordRotate } from "@/components/magicui/word-rotate";
import { Marquee } from "@/components/magicui/marquee";
import { MagneticButton } from "@/components/unlumen/magnetic-button";

const occasions = ["Weddings", "Receptions", "Birthdays", "Corporate Meets", "Anniversaries"];

const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.15]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      ref={ref}
      id="home"
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-secondary text-white"
    >
      <motion.img
        src={heroImage}
        alt=""
        aria-hidden="true"
        style={{ y: imageY, scale: imageScale }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(24_14%_6%/0.55),transparent_60%)]" />

      <div className="container relative z-10 mx-auto flex flex-1 items-center px-4 pt-32 pb-16">
        <div className="max-w-3xl space-y-7">
          <BlurFade delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/85 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              West Jafferkhanpet · Chennai
            </span>
          </BlurFade>

          <BlurFade delay={0.2}>
            <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Book Your Special Day at{" "}
              <span className="italic text-gold">Dhanlakshmi Park Inn</span>
            </h2>
          </BlurFade>

          <BlurFade delay={0.3}>
            <p className="flex flex-wrap items-baseline gap-x-2 text-lg text-white/80 md:text-xl">
              Thoughtfully hosted
              <WordRotate
                words={occasions}
                duration={2600}
                className="inline-block font-serif text-2xl italic text-white md:text-3xl"
                motionProps={{
                  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
                  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                  exit: { opacity: 0, y: -16, filter: "blur(6px)" },
                  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                }}
              />
            </p>
          </BlurFade>

          <BlurFade delay={0.4}>
            <p className="max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              From intimate gatherings to grand celebrations, we're here to make your moments
              unforgettable.
            </p>
          </BlurFade>

          <BlurFade delay={0.5}>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <MagneticButton
                size="lg"
                onClick={() => scrollTo("calendar")}
                className="h-14 rounded-full bg-gold px-8 text-base font-semibold text-secondary shadow-elegant hover:bg-gold/90"
              >
                Check Availability &amp; Book Now
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <button
                onClick={() => scrollTo("about")}
                className="group inline-flex h-14 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                Explore the venue
                <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
          </BlurFade>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-md">
        <Marquee pauseOnHover className="py-4 [--duration:35s] [--gap:3rem]">
          {occasions.map((o) => (
            <span
              key={o}
              className="flex items-center gap-12 font-serif text-lg italic text-white/70 md:text-xl"
            >
              {o}
              <span className="text-xs not-italic text-gold">✦</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
};

export default Hero;
