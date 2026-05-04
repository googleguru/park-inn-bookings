import { useState } from "react";
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

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onBookingSuccess: () => void;
}

const BookingModal = ({
  open,
  onOpenChange,
  selectedDate,
  onBookingSuccess,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) return;

    const bookingDate = selectedDate.toISOString().split("T")[0];

    const { error } = await supabase.from("bookings").insert({
      booking_date: bookingDate,
      status: "pending",
      name: formData.name,
      mobile: formData.mobile,
      email: formData.email,
      event_type: formData.eventType,
      guest_count: formData.guests ? parseInt(formData.guests) : null,
      time_slot: formData.timeSlot,
      notes: formData.notes,
    });

    if (error) {
      toast.error("Failed to create booking. Please try again.");
      console.error("Error creating booking:", error);
      return;
    }

    toast.success(
      `Booking request submitted at Dhanlakshmi Park Inn for ${formatDate(
        selectedDate
      )}. Our team will review and contact you soon.`,
      {
        duration: 5000,
      }
    );

    // Reset form
    setFormData({
      name: "",
      mobile: "",
      email: "",
      eventType: "",
      guests: "",
      timeSlot: "",
      notes: "",
    });

    onBookingSuccess();
    onOpenChange(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Let's Plan Your Event
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{formatDate(selectedDate)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, mobile: e.target.value })
                }
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
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="your.email@example.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Type of Event *</Label>
              <Select
                required
                value={formData.eventType}
                onValueChange={(value) =>
                  setFormData({ ...formData, eventType: value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, guests: e.target.value })
                }
                placeholder="e.g., 150"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeSlot">Preferred Time Slot *</Label>
            <Select
              required
              value={formData.timeSlot}
              onValueChange={(value) =>
                setFormData({ ...formData, timeSlot: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                <SelectItem value="afternoon">
                  Afternoon (12 PM - 4 PM)
                </SelectItem>
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
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any specific requirements for décor, catering, audio-visual, etc."
              rows={4}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
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
