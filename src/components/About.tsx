import {
  MapPin,
  Car,
  Sparkles,
  Users,
  Music,
  UtensilsCrossed,
} from "lucide-react";


const About = () => {
  const facilities = [
    {
      icon: MapPin,
      title: "Prime Location",
      description: "Centrally located with easy access from all parts of the city",
    },
    {
      icon: Car,
      title: "Ample Parking",
      description: "Spacious parking facility for all your guests",
    },
    {
      icon: Sparkles,
      title: "Décor Support",
      description: "Professional decoration services to match your vision",
    },
    {
      icon: UtensilsCrossed,
      title: "Catering Tie-ups",
      description: "Trusted catering partners for delicious experiences",
    },
    {
      icon: Music,
      title: "Audio-Visual",
      description: "State-of-the-art sound and lighting systems",
    },
    {
      icon: Users,
      title: "Flexible Capacity",
      description: "Suitable for intimate gatherings to grand celebrations",
    },
  ];

  return (
    <section id="about" className="venue-facilities">
      <h2>Venue facilities</h2>
      <ul>
        {facilities.map(({ icon: Icon, title, description }) => (
          <li key={title}>
            <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default About;
