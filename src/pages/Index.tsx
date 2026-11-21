import { useState } from 'react';
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BookingCalendar from "@/components/BookingCalendar";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  const [visitDate, setVisitDate] = useState<Date>();
  return (
    <div className="min-h-screen bg-background">
      {/* Not an href="#booking-main" link: HashRouter owns the URL fragment,
          so that would be read as a route and land on the 404 page. */}
      <button
        type="button"
        className="venue-skip"
        onClick={() => document.getElementById("booking-main")?.focus()}
      >
        Skip to main content
      </button>
      <Header />
      <main id="booking-main" tabIndex={-1}>
      {/* Explicitly instant: the root now sets scroll-behavior: smooth for the
          section nav, but this jump follows a form submit and should land
          immediately, as it did before. */}
      <Hero onDate={d => { setVisitDate(d); document.getElementById("calendar")?.scrollIntoView({ behavior: "instant", block: "start" }); }} />
      <BookingCalendar visitDate={visitDate} />
      <About />
      <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
