import { useEffect, useMemo, useState } from "react";
import { Calendar, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SECTIONS = [
  { value: "grand_hall", label: "Grand Hall" },
  { value: "sky_pavilion", label: "Sky Pavilion" },
] as const;

const EVENT_TYPES = ["wedding", "birthday", "corporate", "family"] as const;
const TIME_SLOTS = ["morning", "afternoon", "evening", "night"] as const;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onBookingSuccess: () => void;
}

interface FormState {
  name: string;
  mobile: string;
  email: string;
  eventType: string;
  guests: string;
  timeSlot: string;
  notes: string;
  venueSection: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  mobile: "",
  email: "",
  eventType: "",
  guests: "",
  timeSlot: "",
  notes: "",
  venueSection: "",
};

const BookingModal = ({
  open,
  onOpenChange,
  selectedDate,
  onBookingSuccess,
}: BookingModalProps) => {
  const [bookedSections, setBookedSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);

  const bookingDate = useMemo(
    () => selectedDate?.toISOString().split("T")[0] ?? "",
    [selectedDate],
  );

  useEffect(() => {
    const loadSections = async () => {
      if (!bookingDate || !open) return;

      const { data, error } = await supabase
        .from("bookings")
        .select("venue_section")
        .eq("booking_date", bookingDate)
        .in("status", ["booked", "advanced"]);

      if (error) {
        toast.error("Unable to load section availability.");
        return;
      }

      setBookedSections((data ?? []).map((x) => x.venue_section).filter(Boolean));
    };

    loadSections();
  }, [bookingDate, open]);

  const paymentUrl = useMemo(() => {
    if (!bookingDate || !formData.venueSection) return "";

    const params = new URLSearchParams({
      date: bookingDate,
      section: formData.venueSection,
      guest_count: formData.guests || "0",
    });

    return `https://payments.dhanlakshmiparkinn.com/checkout?${params.toString()}`;
  }, [bookingDate, formData.guests, formData.venueSection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !formData.venueSection || !formData.eventType || !formData.timeSlot) {
      toast.error("Please complete all required fields.");
      return;
    }

    if (bookedSections.includes(formData.venueSection)) {
      toast.error("This section is no longer available. Please choose the other section.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("bookings").insert({
      booking_date: bookingDate,
      status: "booked",
      name: formData.name,
      mobile: formData.mobile,
      email: formData.email,
      event_type: formData.eventType,
      guest_count: formData.guests ? parseInt(formData.guests, 10) : null,
      time_slot: formData.timeSlot,
      notes: formData.notes,
      venue_section: formData.venueSection,
      payment_link: paymentUrl,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create booking. Please try again.");
      return;
    }

    toast.success("Booking created. Payment link generated successfully.");
    setFormData(INITIAL_FORM);
    onBookingSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Reserve Your Event Slot</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{selectedDate?.toDateString()}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile *</Label>
              <Input id="mobile" required value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="guests">Guests *</Label>
              <Input id="guests" type="number" required min={1} value={formData.guests} onChange={(e) => setFormData({ ...formData, guests: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Venue Section *</Label>
            <Select value={formData.venueSection} onValueChange={(value) => setFormData({ ...formData, venueSection: value })}>
              <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>
                {SECTIONS.map((section) => (
                  <SelectItem key={section.value} value={section.value} disabled={bookedSections.includes(section.value)}>
                    {section.label}{bookedSections.includes(section.value) ? " (Booked)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event Type *</Label>
            <Select value={formData.eventType} onValueChange={(value) => setFormData({ ...formData, eventType: value })}>
              <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map((event) => <SelectItem key={event} value={event}>{event}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Time Slot *</Label>
            <Select value={formData.timeSlot} onValueChange={(value) => setFormData({ ...formData, timeSlot: value })}>
              <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
          </div>

          {paymentUrl && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Secure Payment Link
              </div>
              <p className="text-muted-foreground break-all mt-1">{paymentUrl}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={loading} className="flex-1" type="submit">{loading ? "Booking..." : "Confirm & Generate Payment Link"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
