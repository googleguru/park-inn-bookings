import { useState } from 'react';
import { format } from 'date-fns';
import heroImage from '@/assets/venue-hero.webp';
import { isApiConfigured } from '@/lib/api';

export default function Hero({ onDate }: { onDate: (date: Date) => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [day, setDay] = useState(today);
  return <section id="home" className="relative isolate overflow-hidden bg-stone-950 text-white">
    <img src={heroImage} alt="Exterior of Dhanlakshmi Park Inn in Chennai" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/20" />
    <div className="mx-auto grid max-w-7xl items-end gap-10 px-6 pb-14 pt-44 md:min-h-[78svh] md:grid-cols-[1fr_22rem] md:px-12 md:pb-20">
      <div><p className="mb-5 text-sm tracking-widest text-amber-100">WEST JAFFERKHANPET, CHENNAI</p>
        <h2 className="max-w-2xl text-5xl leading-tight md:text-7xl">Dhanlakshmi<br /><i className="text-gold">Park Inn</i></h2>
        <p className="mt-5 max-w-lg text-lg text-white/90">An event venue for weddings, receptions and family gatherings on V.V. Giri Salai.</p>
      </div>
      <form className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-stone-900 shadow-2xl" onSubmit={e => { e.preventDefault(); onDate(new Date(day + 'T12:00:00')); }}>
        <h3 className="text-2xl">Plan your visit</h3>
        <label className="mt-5 block text-sm font-medium">Event date<input type="date" required min={today} value={day} onChange={e => setDay(e.target.value)} className="mt-2 block w-full rounded-md border bg-white p-3" /></label>
        <button className="mt-4 w-full rounded-md bg-stone-900 p-3 font-medium text-white hover:bg-stone-700">View date in calendar</button>
        {!isApiConfigured && <a className="mt-4 block text-center text-sm underline" href="tel:+919841414699">Call the venue for availability</a>}
      </form>
    </div>
  </section>;
}
