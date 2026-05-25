import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ClientUser } from "@/contexts/ClientAuthContext";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onBookingSuccess: () => void;
  clientUser: ClientUser | null;
}

const BookingModal = ({
  open,
  onOpenChange,
  selectedDate,
  onBookingSuccess,
  clientUser,
}: BookingModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    eventType: "",
    guests: "",
    timeSlot: "",
    notes: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (clientUser) {
      setFormData(prev => ({
        ...prev,
        name: clientUser.name || prev.name,
        email: clientUser.email || prev.email,
      }));
    }
  }, [clientUser, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) return;
    if (!clientUser) {
      toast.error("Please sign in to submit a booking.");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Privacy Policy to continue.");
      return;
    }

    const bookingDate = selectedDate.toISOString().split("T")[0];

    const { data: inserted, error } = await supabase
      .from("bookings")
      .insert({
        booking_date: bookingDate,
        status: "pending",
        name: formData.name,
        mobile: formData.mobile,
        email: clientUser.email,
        event_type: formData.eventType,
        guest_count: formData.guests ? parseInt(formData.guests) : null,
        time_slot: formData.timeSlot,
        notes: formData.notes,
      })
      .select("id")
      .maybeSingle();

    if (error || !inserted) {
      toast.error("Failed to create booking. Please try again.");
      console.error("Error creating booking:", error);
      return;
    }

    // Mirror to Google Calendar (best-effort; non-blocking failure).
    supabase.functions
      .invoke("calendar-sync", { body: { action: "create", bookingId: inserted.id } })
      .catch((err) => console.warn("Google Calendar sync skipped:", err));

    toast.success(
      `Booking request submitted for ${formatDate(selectedDate)}. Our team will review and contact you soon.`,
      { duration: 5000 }
    );

    setFormData({ name: "", mobile: "", email: "", eventType: "", guests: "", timeSlot: "", notes: "" });
    setAcceptedTerms(false);
    onBookingSuccess();
    onOpenChange(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Let's Plan Your Event</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{formatDate(selectedDate)}</span>
          </DialogDescription>
        </DialogHeader>

        {clientUser && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {clientUser.avatarUrl && (
              <img src={clientUser.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
            )}
            Booking as <span className="font-medium text-foreground">{clientUser.email}</span>
            <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 px-1.5 py-0.5 rounded">
              Pending admin approval
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number *</Label>
              <Input
                id="mobile"
                type="tel"
                required
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              readOnly={!!clientUser}
              className={clientUser ? "bg-muted cursor-not-allowed" : ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Type of Event *</Label>
              <Select
                required
                value={formData.eventType}
                onValueChange={(value) => setFormData({ ...formData, eventType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="birthday">Birthday Party</SelectItem>
                  <SelectItem value="corporate">Corporate Meet</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guests">Expected Number of Guests *</Label>
              <Input
                id="guests"
                type="number"
                required
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                placeholder="e.g., 150"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeSlot">Preferred Time Slot *</Label>
            <Select
              required
              value={formData.timeSlot}
              onValueChange={(value) => setFormData({ ...formData, timeSlot: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                <SelectItem value="evening">Evening (4 PM - 8 PM)</SelectItem>
                <SelectItem value="night">Night (8 PM - 12 AM)</SelectItem>
                <SelectItem value="fullday">Full Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Special Requirements / Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any specific requirements for décor, catering, audio-visual, etc."
              rows={4}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-xs font-normal leading-relaxed cursor-pointer">
              I agree to the{" "}
              <a href="#terms" className="text-primary underline" target="_blank" rel="noreferrer">Terms of Service</a>
              {" "}and{" "}
              <a href="#privacy" className="text-primary underline" target="_blank" rel="noreferrer">Privacy Policy</a>,
              and consent to being contacted about this booking request.
            </Label>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!acceptedTerms}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Submit Booking Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
