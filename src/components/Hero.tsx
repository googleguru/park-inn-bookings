import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowDownRight, MapPin } from 'lucide-react';
import { isApiConfigured } from '@/lib/api';

import heroAvif640 from '@/assets/venue-hero-640.avif';
import heroAvif960 from '@/assets/venue-hero-960.avif';
import heroAvif1280 from '@/assets/venue-hero-1280.avif';
import heroAvif1920 from '@/assets/venue-hero-1920.avif';
import heroWebp640 from '@/assets/venue-hero-640.webp';
import heroWebp960 from '@/assets/venue-hero-960.webp';
import heroWebp1280 from '@/assets/venue-hero-1280.webp';
// The full-size WebP is the untouched original: re-encoding an already-lossy
// file costs visible quality for about a tenth of the bytes.
import heroWebp1920 from '@/assets/venue-hero.webp';

/**
 * How wide the photo actually paints, so the browser can pick the smallest file
 * that still covers it. Mirrors the hero's layout in index.css: one column
 * below 48rem, and the 1.12fr half of `1fr 1.12fr` above it (1.12/2.12 ≈ 53%).
 * If that grid ratio changes, this has to change with it.
 */
const HERO_SIZES = '(max-width: 48rem) 100vw, 53vw';

const avifSrcSet = [
  `${heroAvif640} 640w`,
  `${heroAvif960} 960w`,
  `${heroAvif1280} 1280w`,
  `${heroAvif1920} 1920w`,
].join(', ');

const webpSrcSet = [
  `${heroWebp640} 640w`,
  `${heroWebp960} 960w`,
  `${heroWebp1280} 1280w`,
  `${heroWebp1920} 1920w`,
].join(', ');

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
      {/* This is the LCP element. It stays a plain <img> in the markup so the
          preload scanner finds it immediately; the <picture> only adds format
          and width choices around it. `display: contents` on the picture (see
          index.css) keeps the img itself as the hero grid item. */}
      <picture>
        <source type="image/avif" sizes={HERO_SIZES} srcSet={avifSrcSet} />
        <source type="image/webp" sizes={HERO_SIZES} srcSet={webpSrcSet} />
        <img
          src={heroWebp1920}
          width={1920}
          height={1280}
          fetchPriority="high"
          alt="Exterior of Dhanlakshmi Park Inn in Chennai"
          className="venue-photo"
        />
      </picture>
    </section>
  );
}
