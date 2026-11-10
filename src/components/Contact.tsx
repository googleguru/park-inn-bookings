import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { BlurFade } from "@/components/magicui/blur-fade";

const CONTACT_EMAIL = "info@dhanlakshmiparkinn.com";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Enquiry from ${formData.name.trim()}`;
    const phone = formData.phone.trim();
    const body =
      `${formData.message.trim()}\n\nName: ${formData.name.trim()}\nEmail: ${formData.email.trim()}` +
      (phone ? `\nPhone: ${phone}` : "");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success("Opening your email app to send the message…");
  };

  const details = [
    {
      icon: MapPin,
      title: "Address",
      body: (
        <p className="text-muted-foreground leading-relaxed">
          Dhanlakshmi Park Inn
          <br />
          4/3 V.V Giri Salai, Pachaiyappan St,
          <br />
          West Jafferkhanpet, Chennai,
          <br />
          Tamil Nadu 600083
        </p>
      ),
    },
    {
      icon: Phone,
      title: "Phone",
      body: (
        <a href="tel:+919841414699" className="text-muted-foreground hover:text-primary transition-colors">
          098414 14699
        </a>
      ),
    },
    {
      icon: Mail,
      title: "Email",
      body: (
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          {CONTACT_EMAIL}
        </a>
      ),
    },
  ];

  return (
    <section id="contact" className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <BlurFade inView className="text-center mb-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Contact</p>
          <h2 className="text-4xl md:text-5xl font-semibold mb-4">Get In Touch</h2>
          <p className="text-lg text-muted-foreground">
            Got questions? We're just a call away.
          </p>
        </BlurFade>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          <BlurFade inView delay={0.05}>
            <Card className="h-full rounded-3xl border-border/70 p-6 md:p-10 shadow-soft">
              <h3 className="text-2xl font-semibold mb-8">Contact Information</h3>

              <div className="space-y-7">
                {details.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-accent/60">
                      <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h4 className="font-sans text-sm font-semibold uppercase tracking-wider mb-1">{title}</h4>
                      {body}
                    </div>
                  </div>
                ))}

                <div className="mt-8 h-64 overflow-hidden rounded-2xl border border-border">
                  <iframe
                    src="https://www.google.com/maps?q=4/3+V.V+Giri+Salai,+Pachaiyappan+St,+West+Jafferkhanpet,+Chennai,+Tamil+Nadu+600083&output=embed"
                    className="h-full w-full border-0 grayscale-[35%] transition-[filter] duration-500 hover:grayscale-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Dhanlakshmi Park Inn location"
                  />
                </div>
              </div>
            </Card>
          </BlurFade>

          <BlurFade inView delay={0.15}>
            <Card className="h-full rounded-3xl border-border/70 p-6 md:p-10 shadow-soft">
              <h3 className="text-2xl font-semibold mb-8">Send us a Message</h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name *</Label>
                  <Input
                    id="contact-name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    className="h-12 rounded-xl"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    className="h-12 rounded-xl"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your.email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    maxLength={20}
                    autoComplete="tel"
                    className="h-12 rounded-xl"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    required
                    maxLength={2000}
                    className="rounded-xl"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your event or questions..."
                    rows={5}
                  />
                </div>

                <Button type="submit" className="group h-12 w-full rounded-full" size="lg">
                  <Send className="w-4 h-4 mr-2 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  Send Message
                </Button>
              </form>
            </Card>
          </BlurFade>
        </div>
      </div>
    </section>
  );
};

export default Contact;
