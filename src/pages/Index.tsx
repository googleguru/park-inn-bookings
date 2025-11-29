import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BookingCalendar from "@/components/BookingCalendar";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <About />
      <BookingCalendar />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
