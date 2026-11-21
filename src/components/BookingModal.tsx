import { useEffect, useState } from "react";
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
import { Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { api, ApiError } from "@/lib/api";
import { EVENT_TYPES, TIME_SLOTS } from "@/lib/booking";
import { checkRateLimit } from "@/lib/security";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onBookingSuccess: () => void;
}

const EMPTY = { name: "", mobile: "", eventType: "", guests: "", timeSlot: "", notes: "" };

const BookingModal = ({ open, onOpenChange, selectedDate, onBookingSuccess }: BookingModalProps) => {
  const { customer, token } = useClientAuth();
  const [formData, setFormData] = useState(EMPTY);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || customer.name,
        mobile: prev.mobile || customer.mobile,
      }));
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !customer || submitting) return;
    if (!acceptedTerms) {
      toast.error("Please confirm that the venue may contact you about your booking.");
      return;
    }

    const name = formData.name.trim();
    const mobile = formData.mobile.replace(/[\s-]/g, "");
    const guests = parseInt(formData.guests, 10);
    if (!name) {
      toast.error("Please enter your name.");
      return;
    }
    if (!/^\+?\d{10,13}$/.test(mobile)) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 5000) {
      toast.error("Please enter a valid number of guests.");
      return;
    }
    if (!formData.eventType || !formData.timeSlot) {
      toast.error("Please choose an event type and time slot.");
      return;
    }
    if (!checkRateLimit("booking-submit", 3, 60_000)) {
      toast.error("Too many attempts. Please wait a minute and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await api(
        "bookingRequest",
        {
          // Local calendar date; toISOString() would shift to the previous day in IST.
          date: format(selectedDate, "yyyy-MM-dd"),
          slot: formData.timeSlot,
          eventType: formData.eventType,
          guests,
          name,
          mobile,
          notes: formData.notes.trim(),
        },
        token,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send your request. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    toast.success(
      `Booking request sent for ${formatDate(selectedDate)}. We'll review it and email you soon.`,
      { duration: 6000 },
    );
    setFormData(EMPTY);
    setAcceptedTerms(false);
    onBookingSuccess();
    onOpenChange(false);
  };

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Let's Plan Your Event</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{formatDate(selectedDate)}</span>
          </DialogDescription>
        </DialogHeader>

        {customer && (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            Booking as <span className="font-medium text-foreground truncate">{customer.email}</span>
            <span className="ml-auto shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300">
              Admin confirms each request
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
                maxLength={100}
                autoComplete="name"
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
                maxLength={16}
                autoComplete="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Type of Event *</Label>
              <Select
                required
                value={formData.eventType}
                onValueChange={(value) => setFormData({ ...formData, eventType: value })}
              >
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guests">Expected Number of Guests *</Label>
              <Input
                id="guests"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={5000}
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
              <SelectTrigger id="timeSlot">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Special Requirements / Notes</Label>
            <Textarea
              id="notes"
              maxLength={1000}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any specific requirements for décor, catering, audio-visual, etc."
              rows={4}
            />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">How the venue handles your request</summary>
            <p className="mt-2 text-muted-foreground">
              Venue staff use your contact and event details to review your request. The venue stores these details
              in its booking spreadsheet and adds confirmed events to its calendar. You can cancel a pending
              request from your profile. For changes to a confirmed event, call the venue.
            </p>
          </details>
          <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-xs font-normal leading-relaxed cursor-pointer">
              I understand that the venue must confirm my request and agree to be contacted about this booking.
            </Label>
          </div>

          <div className="flex gap-4 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-full">
              Cancel
            </Button>
            <Button type="submit" disabled={!acceptedTerms || submitting} className="flex-1 gap-2 rounded-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Sending…" : "Submit Booking Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
