import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowDownRight, MapPin } from 'lucide-react';
import heroImage from '@/assets/venue-hero.webp';
import { isApiConfigured } from '@/lib/api';

export default function Hero({ onDate }: { onDate: (date: Date) => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [day, setDay] = useState(today);

  return (
    <section id="home" tabIndex={-1} aria-labelledby="venue-title" className="venue-hero brand-dark">
      <div className="venue-intro">
        <p className="venue-location"><MapPin size={16} aria-hidden="true" /> West Jafferkhanpet, Chennai</p>
        <h1 id="venue-title">Dhanlakshmi<br /><em>Park Inn</em></h1>
        <p className="venue-description">A venue for weddings, receptions and family gatherings on V.V. Giri Salai.</p>
        <form className="venue-date" onSubmit={event => {
          event.preventDefault();
          onDate(new Date(day + 'T12:00:00'));
        }}>
          <label htmlFor="visit-date">Event date</label>
          <div className="venue-date-controls">
            <input id="visit-date" type="date" required min={today} value={day} onChange={event => setDay(event.target.value)} />
            <button type="submit">Check availability <ArrowDownRight size={17} aria-hidden="true" /></button>
          </div>
          {!isApiConfigured && <a href="tel:+919841414699">Call the venue for availability</a>}
        </form>
      </div>
      <img src={heroImage} width={1920} height={1280} fetchPriority="high"
        alt="Exterior of Dhanlakshmi Park Inn in Chennai" className="venue-photo" />
    </section>
  );
}
