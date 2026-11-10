import { useEffect, useState } from "react";
import { Menu, X, LogIn, LogOut } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { cn } from "@/lib/utils";

const sections = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "calendar", label: "Booking Calendar" },
  { id: "contact", label: "Contact" },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const { clientUser, signIn, signOut, loading } = useClientAuth();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id));
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  // Over the dark hero photo the nav needs light text until it gains its glass background.
  const onHero = !scrolled && !isMenuOpen;

  const AuthButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (loading) return null;
    if (clientUser) {
      return (
        <div className={`flex items-center gap-2 ${mobile ? "py-2" : ""}`}>
          <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {clientUser.avatarUrl && (
              <img
                src={clientUser.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full border border-border"
              />
            )}
            <span className="text-xs text-muted-foreground hidden lg:block max-w-[120px] truncate">
              {clientUser.name}
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs rounded-full">
            <LogOut size={13} /> Sign out
          </Button>
        </div>
      );
    }
    return (
      <Button
        size="sm"
        onClick={signIn}
        className={cn(
          "gap-1.5 text-xs rounded-full",
          onHero && !mobile && "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur"
        )}
      >
        <LogIn size={13} /> Sign in with Google
      </Button>
    );
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4">
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "w-full transition-[max-width,background-color,box-shadow,border-color,padding] duration-500 ease-out",
          "rounded-2xl border",
          scrolled || isMenuOpen
            ? "max-w-5xl bg-background/75 backdrop-blur-xl border-border/70 shadow-soft px-4 py-2.5"
            : "max-w-7xl bg-transparent border-transparent px-4 py-4"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => scrollToSection("home")} className="flex flex-col text-left">
            <h1
              className={cn(
                "text-xl md:text-2xl font-semibold tracking-tight transition-colors",
                onHero ? "text-white" : "text-foreground"
              )}
            >
              Dhanlakshmi <span className={cn("italic transition-colors", onHero ? "text-gold" : "text-primary")}>Park Inn</span>
            </h1>
            <p
              className={cn(
                "hidden sm:block text-[11px] tracking-wide transition-colors",
                onHero ? "text-white/70" : "text-muted-foreground"
              )}
            >
              Where every moment becomes a beautiful memory
            </p>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={cn(
                  "relative isolate rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  onHero ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground",
                  active === id && (onHero ? "text-white" : "text-foreground")
                )}
              >
                {active === id && (
                  <motion.span
                    layoutId="nav-pill"
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full",
                      onHero ? "bg-white/15" : "bg-muted"
                    )}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {label}
              </button>
            ))}
            <Link
              to="/admin"
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                onHero ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Admin
            </Link>
            <div className="ml-2">
              <AuthButton />
            </div>
          </nav>

          <Button
            variant="ghost"
            size="icon"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className={cn("md:hidden rounded-full", onHero && "text-white hover:bg-white/10 hover:text-white")}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {isMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden"
            >
              <div className="mt-3 flex flex-col gap-1 border-t border-border/70 pt-3 pb-1">
                {sections.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className="rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <Link
                  to="/admin"
                  className="rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Admin
                </Link>
                <div className="px-2 pt-1">
                  <AuthButton mobile />
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.div>
    </header>
  );
};

export default Header;
