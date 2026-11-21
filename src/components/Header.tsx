import { useEffect, useRef, useState } from "react";
import { Menu, X, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { isApiConfigured } from "@/lib/api";

const sections = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "calendar", label: "Booking Calendar" },
  { id: "contact", label: "Contact" },
];

const NAV_ITEMS = ".site-nav button, .site-menu button[data-section]";

/**
 * Tracks which section is in view and marks the matching nav item.
 *
 * The platform has a declarative version of this (`scroll-target-group` plus
 * `:target-current`), but it is driven by `#fragment` links — and this app
 * routes on the URL hash via HashRouter, so a `href="#about"` would be read as
 * a route and land on the 404 page rather than scrolling. The hash belongs to
 * the router here, so the sections are scrolled to imperatively and observed
 * instead. The `.is-current` class it sets is what the stylesheet's
 * anchor-positioned indicator attaches to.
 */
function useCurrentSection(headerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const items = Array.from(header.querySelectorAll<HTMLElement>(NAV_ITEMS));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const item of items) {
            const isCurrent = item.dataset.section === entry.target.id;
            item.classList.toggle("is-current", isCurrent);
            // The class is only a visual cue; assistive technology needs the
            // state spelled out.
            if (isCurrent) item.setAttribute("aria-current", "true");
            else item.removeAttribute("aria-current");
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headerRef]);
}

/**
 * Scrolls to a section. The smooth/instant choice lives in CSS
 * (`scroll-behavior` under a prefers-reduced-motion query), so this does not
 * need to read the preference itself. Focus is moved to the section so keyboard
 * users continue from there rather than from the top of the page.
 */
function goToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "start" });
  el.focus({ preventScroll: true });
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { customer, openSignIn, signOut, loading } = useClientAuth();
  const headerRef = useRef<HTMLElement>(null);

  useCurrentSection(headerRef);

  const AuthButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (loading || !isApiConfigured) return null;
    if (customer) {
      return (
        <div className={`flex items-center gap-2 ${mobile ? "py-2" : ""}`}>
          <Link
            to="/profile"
            aria-label="My profile and bookings"
            className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/25 font-serif text-sm"
            >
              {(customer.name || customer.email)[0].toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate text-xs lg:block">
              {customer.name || customer.email}
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 rounded-full text-xs">
            <LogOut size={13} /> Sign out
          </Button>
        </div>
      );
    }
    return (
      <Button size="sm" onClick={() => openSignIn()} className="gap-1.5 rounded-full text-xs">
        <LogIn size={13} /> Sign in
      </Button>
    );
  };

  return (
    /* brand-dark makes the header its own colour context — deep green in both
       schemes — so the controls inside read tokens rather than being recoloured
       per state. The shrink-on-scroll is in CSS, off the main thread. */
    <header ref={headerRef} className="site-header brand-dark">
      <div className="site-header-inner">
        <button type="button" className="site-brand" onClick={() => goToSection("home")}>
          {/* The name is one flex item; a bare text node plus <em> would make
              the italic half a second item and break it onto its own line. */}
          <span>
            Dhanlakshmi <em>Park Inn</em>
          </span>
          <small>Event venue · Chennai</small>
        </button>

        <div className="hidden items-center gap-1 md:flex">
          <nav className="site-nav" aria-label="Sections">
            {sections.map(({ id, label }) => (
              <button key={id} type="button" data-section={id} onClick={() => goToSection(id)}>
                {label}
              </button>
            ))}
          </nav>
          <Link
            to="/admin"
            className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Admin
          </Link>
          <div className="ml-2">
            <AuthButton />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="site-menu"
          className="site-menu-toggle rounded-full"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Stays in the DOM so its height can transition, but `inert` while
          closed keeps the collapsed controls out of the tab order and the
          accessibility tree. */}
      <nav
        id="site-menu"
        aria-label="Site menu"
        className="site-menu"
        data-open={isMenuOpen}
        {/* `inert` is not in React 18's attribute types; cast rather than drop
            the attribute, which is what actually keeps the closed menu out of
            the tab order. */}
        {...(isMenuOpen ? {} : ({ inert: "" } as any))}
      >
        {sections.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-section={id}
            onClick={() => {
              setIsMenuOpen(false);
              goToSection(id);
            }}
          >
            {label}
          </button>
        ))}
        <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
          Admin
        </Link>
        <div className="px-2 pt-1">
          <AuthButton mobile />
        </div>
      </nav>
    </header>
  );
};

export default Header;
