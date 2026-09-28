/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Instagram, Youtube, Mail, ArrowRight, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ARTIST_NAME, ARTIST_TAGLINE, SOCIAL_LINKS, UPCOMING_EVENTS, HERO_IMAGE, BIO_TEXT, BIO_VIDEO_ID } from './constants';
import type { Event } from './types';

// Helper function to cleanly parse CSV rows, respecting quoted fields
function parseCSVRow(line: string) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

// Helper to parse "MMM DD" into a Date object for the current year
// Allows sorting and chronological filtering of past gigs
function parseDateForEval(dateStr: string): Date | null {
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${dateStr} ${currentYear}`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = React.useState(false);

  // States for gigs logic
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);

  React.useEffect(() => {
    const fetchEvents = async () => {
      // Use the provided CSV Endpoint
      const sheetUrl = (import.meta as any).env.VITE_GOOGLE_SHEET_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQfNTuqakPXBccJ2-uRBydZ77-RlGZfnHk8Vqxb-q7cRO6MfRelemzPft7quLx5wMDZ2U3Jfy3F5UYu/pub?output=csv";
      
      // 3. Performance: Session Storage Caching
      const cacheKey = 'gigs_cache';
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setEvents(JSON.parse(cached));
          setIsLoadingEvents(false);
          return;
        } catch (e) {
          console.error("Cache parsing error", e);
        }
      }

      if (!sheetUrl) {
         setEvents(UPCOMING_EVENTS); // Hardcoded fallback if no config
         setIsLoadingEvents(false);
         return;
      }

      try {
        const res = await fetch(sheetUrl);
        if (!res.ok) throw new Error("Network error fetching CSV");
        
        const csv = await res.text();
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) throw new Error("Empty CSV");

        // 1. Smarter Logic: Key-Based Mapping (Headers)
        // Parses the first row dynamically to find index mappings 
        const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
        const dateIdx = headers.indexOf('date');
        const locationIdx = headers.indexOf('location');
        const venueIdx = headers.indexOf('venue');
        const statusIdx = headers.indexOf('status');
        const linkIdx = headers.findIndex(h => h === 'link' || h === 'url');
        const btnTextIdx = headers.findIndex(h => h === 'button text' || h === 'button');

        const now = new Date();
        now.setHours(0, 0, 0, 0); // normalize time to purely check days

        const parsedEvents: Event[] = lines
          .slice(1)
          .map((line, index) => {
            const parts = parseCSVRow(line);
            
            // Defensively extract based on the mapped header indices
            const date = dateIdx >= 0 ? parts[dateIdx] : 'TBA';
            const location = locationIdx >= 0 ? parts[locationIdx] : 'TBA';
            const venue = venueIdx >= 0 ? parts[venueIdx] : 'TBA';
            const status = statusIdx >= 0 ? parts[statusIdx] : 'info';
            const url = linkIdx >= 0 ? parts[linkIdx] : '';
            const buttonText = btnTextIdx >= 0 ? parts[btnTextIdx] : '';

            const rawStatus = status?.toLowerCase();
            const finalStatus = (rawStatus === 'tickets' || rawStatus === 'info') ? 'info' : (rawStatus as any) || 'info';

            return {
              id: String(index + 1),
              date: date || 'TBA',
              location: location || 'TBA',
              venue: venue || 'TBA',
              status: finalStatus,
              url: url || undefined,
              buttonText: buttonText || undefined
            };
          })
          .filter(event => {
            // 1. Smarter Logic: Auto-Filter Past Gigs
            if (event.date === 'TBA') return true;
            const parsedDate = parseDateForEval(event.date);
            if (!parsedDate) return true; 
            return parsedDate >= now; // keep only upcoming gigs
          })
          .sort((a, b) => {
             // 1. Smarter Logic: Auto-Sorting Chronologically
             const dateA = parseDateForEval(a.date);
             const dateB = parseDateForEval(b.date);
             if (dateA && dateB) {
                return dateA.getTime() - dateB.getTime();
             }
             return 0;
          });

        if (parsedEvents.length > 0) {
          setEvents(parsedEvents);
          sessionStorage.setItem(cacheKey, JSON.stringify(parsedEvents));
        } else {
           setEvents(UPCOMING_EVENTS); // Fallback
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        setEvents(UPCOMING_EVENTS); // Fallback entirely on error
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  React.useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsScrolled(latest > 100);
    });
  }, [scrollY]);

  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <div className="min-h-screen bg-brand-bg selection:bg-white selection:text-black overflow-x-hidden">
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 left-0 w-full z-50 px-6 py-8 flex justify-between items-center transition-all duration-700 ease-in-out drop-shadow-lg",
        isScrolled ? "opacity-0 -translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
      )}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-serif tracking-widest font-bold text-white"
        >
          {ARTIST_NAME}
        </motion.div>
        
        <div className="flex gap-8 items-center text-white">
          {SOCIAL_LINKS.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-xs uppercase tracking-[0.2em] font-medium hover:opacity-50 transition-opacity flex items-center gap-2"
            >
              <span className="hidden sm:inline">{link.label}</span>
              {link.label === "Instagram" && <Instagram size={14} />}
              {link.label === "YouTube" && <Youtube size={14} />}
              {link.label === "Email" && <Mail size={14} />}
            </motion.a>
          ))}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <motion.div 
          style={{ y: y1, opacity }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-black/60 z-10" />
          <img 
            src={HERO_IMAGE} 
            alt={ARTIST_NAME}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        <div className="relative z-20 text-center px-4">
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[12vw] leading-[0.8] font-serif uppercase tracking-widest md:tracking-tighter drop-shadow-2xl"
          >
            {ARTIST_NAME.split(' ').map((word, i) => (
              <span key={i} className={cn("block", i === 1 && "text-stroke tracking-[0.4em] md:tracking-[0.1em]")}>
                {word}
              </span>
            ))}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-8 text-sm uppercase tracking-[0.5em] font-light opacity-60"
          >
            {ARTIST_TAGLINE}
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">Scroll to Explore</span>
          <div className="w-[1px] h-12 bg-white/20 relative overflow-hidden">
            <motion.div 
              animate={{ y: [0, 48] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 w-full h-1/2 bg-white"
            />
          </div>
        </motion.div>
      </section>

      {/* Bio Section */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative aspect-video overflow-hidden rounded-2xl bg-black/20"
          >
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${BIO_VIDEO_ID}?autoplay=0&controls=1&rel=0`}
              title="William Kearns DJ Set"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-serif italic mb-8">Sonic Identity</h2>
            <p className="text-lg leading-relaxed text-brand-text/80 font-light">
              {BIO_TEXT}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Events Section */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-baseline mb-16 gap-4">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-serif italic"
          >
            Upcoming Sets
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs uppercase tracking-widest opacity-40 font-mono"
          >
            2026 Tour Schedule
          </motion.div>
        </div>

        <div className="space-y-0 border-t border-white/10 min-h-[400px]">
          {isLoadingEvents ? (
            /* 2. Enhanced UX: CSS Skeleton Loading State */
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="group relative grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_150px] items-center py-8 border-b border-white/10 px-4 -mx-4 cursor-default animate-pulse">
                <div className="h-4 w-16 bg-white/10 rounded mb-4 md:mb-0"></div>
                <div className="h-6 w-48 bg-white/10 rounded mb-3 md:mb-0"></div>
                <div className="h-4 w-32 bg-white/10 rounded mb-4 md:mb-0 flex items-center gap-2"><MapPin size={14} className="opacity-0"/><div className="h-full w-full bg-white/10 rounded"></div></div>
                <div className="flex justify-end">
                  <div className="h-10 w-full md:w-32 bg-white/10 rounded-sm"></div>
                </div>
              </div>
            ))
          ) : events.length === 0 ? (
            <div className="py-24 text-center text-white/40 uppercase tracking-widest text-sm">
               No upcoming sets scheduled at the moment.
            </div>
          ) : (
            events.map((event, i) => {
              // 2. Enhanced UX: Google Maps URL generation
              const mapQuery = encodeURIComponent(`${event.venue} ${event.location}`);
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

              return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_150px] items-center py-8 border-b border-white/10 hover:bg-white/[0.02] transition-colors px-4 -mx-4 cursor-default"
              >
                <div className="font-mono text-sm tracking-tighter opacity-60 mb-2 md:mb-0">
                  {event.date}
                </div>
                <div className="text-xl font-medium mb-1 md:mb-0">
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">
                    {event.location}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm opacity-40 mb-4 md:mb-0">
                  <MapPin size={14} />
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
                    {event.venue}
                  </a>
                </div>
                <div className="flex justify-end">
                  {event.url ? (
                    <a 
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full md:w-auto px-8 py-3 text-xs text-center uppercase tracking-widest border border-white/20 bg-white/5 hover:bg-white hover:text-black transition-all duration-500 font-bold"
                    >
                      {/* 2. Enhanced UX: Dynamic Button Text */}
                      {event.buttonText || 'Info'}
                    </a>
                  ) : (
                    <button 
                      disabled
                      className="w-full md:w-auto px-8 py-3 text-xs uppercase tracking-widest border border-white/5 opacity-30 cursor-not-allowed font-bold"
                    >
                      {event.buttonText || 'Info'}
                    </button>
                  )}
                </div>
              </motion.div>
            )})
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="min-h-screen flex items-center justify-center px-6 text-center bg-white text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-5xl md:text-8xl font-serif mb-12 leading-tight">
            Book <br />
            <span className="italic">William</span> Kearns.
          </h2>
          
          <motion.a
            href="mailto:WilliamKearns.DJ@gmail.com"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-4 bg-black text-white px-12 py-6 rounded-full text-sm uppercase tracking-[0.3em] font-bold hover:bg-neutral-800 transition-colors group"
          >
            Contact Me
            <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </motion.a>
        </motion.div>
      </section>
    </div>
  );
}
