import BookingCalendar from "@/components/BookingCalendar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 text-primary">
            Book Your Special Day
          </h1>
          <p className="text-xl text-muted-foreground">
            Dhanlakshmi Park Inn
          </p>
          <p className="text-lg text-muted-foreground mt-2">
            Reserve your event date with just one click!
          </p>
        </div>
        <BookingCalendar />
      </div>
    </div>
  );
};

export default Index;
