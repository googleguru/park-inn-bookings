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
      <button className="venue-skip" onClick={() => document.getElementById("booking-main")?.focus()}>Skip to main content</button>
      <Header />
      <main id="booking-main" tabIndex={-1}>
      <Hero onDate={d => { setVisitDate(d); document.getElementById("calendar")?.scrollIntoView({ block: "start" }); }} />
      <BookingCalendar visitDate={visitDate} />
      <About />
      <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
