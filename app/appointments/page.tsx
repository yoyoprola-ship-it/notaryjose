'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BookingModal, { type BookingCopy } from '@/app/components/BookingModal';
import { formatDateShort, formatHour, formatSlotRange } from '@/app/lib/timeSlots';

// Calendar público del próximo 7 días. Cada hora 8..19 es un slot.
// Bilingüe (EN/ES) — mismo toggle que la landing.

type Lang = 'en' | 'es';

interface HourEntry {
  hour: number;
  iso: string;
  available: boolean;
  reason?: 'past' | 'booked' | 'closed';
}
interface DayEntry {
  date: string;
  dayOfWeek: number;
  hours: HourEntry[];
}

const COPY: Record<Lang, {
  back: string;
  title: string;
  subtitle: string;
  pickDay: string;
  pickHour: string;
  loading: string;
  errorLoad: string;
  refresh: string;
  labels: { available: string; booked: string; closed: string; past: string };
  ctaBook: (label: string) => string;
  modal: BookingCopy;
  langToggle: string;
}> = {
  en: {
    back: '← Back to home',
    title: 'Book an appointment',
    subtitle: 'Pick a day and hour. One hour per slot, 8 AM to 8 PM.',
    pickDay: 'Choose a day',
    pickHour: 'Choose a time',
    loading: 'Loading slots…',
    errorLoad: 'Could not load slots. Please refresh.',
    refresh: 'Refresh',
    labels: { available: 'Open', booked: 'Booked', closed: 'Closed', past: 'Past' },
    ctaBook: (label) => `Book ${label}`,
    langToggle: 'ES',
    modal: {
      title: 'Book your slot',
      step1of3: 'Step 1 of 2 — Your details',
      step2of3: 'Step 2 of 2 — SMS verify',
      done: 'Confirmed',
      namePlaceholder: 'Your full name',
      phonePlaceholder: '(337) 123-4567',
      sendCode: 'Send code',
      sending: 'Sending…',
      codePlaceholder: '123456',
      verify: 'Verify & book',
      verifying: 'Booking…',
      bookedTitle: 'You are booked.',
      bookedBody: (whenLabel) =>
        `See you ${whenLabel}. If you need to reschedule, please call (337) 849-4503.`,
      close: 'Close',
      changeNumber: '← Change details',
      requiredName: 'Please enter your name (2+ chars).',
      requiredPhone: 'Please enter a valid 10-digit US phone.',
      invalidCode: 'Code must be 6 digits.',
      wrongCode: 'Wrong or expired code.',
      bookingConflict:
        'That time was just booked by someone else. Please pick another.',
      networkError: 'Something went wrong. Please try again.',
      slotClosedHint: 'That hour is not available.',
      bookingWith: (whenLabel) => `You're booking: ${whenLabel}`,
    },
  },
  es: {
    back: '← Volver al inicio',
    title: 'Agendar una cita',
    subtitle: 'Elegí día y hora. Un turno por hora, de 8 AM a 8 PM.',
    pickDay: 'Elegí un día',
    pickHour: 'Elegí una hora',
    loading: 'Cargando…',
    errorLoad: 'No pudimos cargar los turnos. Por favor refrescá.',
    refresh: 'Refrescar',
    labels: { available: 'Libre', booked: 'Ocupado', closed: 'Cerrado', past: 'Pasado' },
    ctaBook: (label) => `Reservar ${label}`,
    langToggle: 'EN',
    modal: {
      title: 'Reservar turno',
      step1of3: 'Paso 1 de 2 — Tus datos',
      step2of3: 'Paso 2 de 2 — Verificación SMS',
      done: 'Confirmada',
      namePlaceholder: 'Tu nombre completo',
      phonePlaceholder: '(337) 123-4567',
      sendCode: 'Enviar código',
      sending: 'Enviando…',
      codePlaceholder: '123456',
      verify: 'Verificar y reservar',
      verifying: 'Reservando…',
      bookedTitle: 'Cita confirmada.',
      bookedBody: (whenLabel) =>
        `Te esperamos ${whenLabel}. Si necesitás reagendar, llamá al (337) 849-4503.`,
      close: 'Cerrar',
      changeNumber: '← Cambiar datos',
      requiredName: 'Ingresá tu nombre (mínimo 2 caracteres).',
      requiredPhone: 'Ingresá un teléfono US válido de 10 dígitos.',
      invalidCode: 'El código debe tener 6 dígitos.',
      wrongCode: 'Código incorrecto o expirado.',
      bookingConflict:
        'Alguien acaba de reservar ese turno. Por favor elegí otro.',
      networkError: 'Algo salió mal. Intentá de nuevo.',
      slotClosedHint: 'Esa hora no está disponible.',
      bookingWith: (whenLabel) => `Estás reservando: ${whenLabel}`,
    },
  },
};

export default function AppointmentsPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = COPY[lang];

  const [days, setDays] = useState<DayEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    iso: string;
    label: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/available-slots', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setDays(data.days as DayEntry[]);
      if (data.days?.[0] && !selectedDate) setSelectedDate(data.days[0].date);
    } catch (err) {
      console.error('[appointments] load failed:', err);
      setError(t.errorLoad);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentDay = useMemo(
    () => days?.find((d) => d.date === selectedDate) || null,
    [days, selectedDate]
  );

  return (
    <main className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {t.back}
          </Link>
          <button
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 border border-amber-300 hover:bg-amber-50 rounded"
          >
            {t.langToggle}
          </button>
        </div>
      </header>

      <section className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-2">
            {t.title}
          </h1>
          <p className="text-sm text-slate-600 mb-8">{t.subtitle}</p>

          {loading && (
            <p className="text-slate-500">{t.loading}</p>
          )}
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded p-4 mb-4">
              <p className="text-sm mb-3">{error}</p>
              <button
                onClick={load}
                className="text-xs font-bold uppercase tracking-wider text-red-800 border border-red-300 hover:bg-red-100 rounded px-3 py-1"
              >
                {t.refresh}
              </button>
            </div>
          )}

          {days && !loading && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {t.pickDay}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-6 px-6 sm:mx-0 sm:px-0">
                {days.map((d) => {
                  const active = d.date === selectedDate;
                  const anyOpen = d.hours.some((h) => h.available);
                  return (
                    <button
                      key={d.date}
                      onClick={() => setSelectedDate(d.date)}
                      className={`shrink-0 min-w-[92px] rounded border px-3 py-3 text-center transition-all ${
                        active
                          ? 'border-amber-700 bg-amber-50 shadow-sm'
                          : 'border-stone-200 bg-white hover:border-amber-300'
                      } ${!anyOpen ? 'opacity-40' : ''}`}
                    >
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          active ? 'text-amber-800' : 'text-slate-500'
                        }`}
                      >
                        {formatDateShort(d.date).split(',')[0]}
                      </p>
                      <p className="text-lg font-black text-slate-900 mt-1">
                        {formatDateShort(d.date).split(', ')[1] ||
                          formatDateShort(d.date)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {currentDay && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {t.pickHour}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {currentDay.hours.map((h) => {
                      const label = formatHour(h.hour);
                      const range = formatSlotRange(h.hour);
                      const disabled = !h.available;
                      return (
                        <button
                          key={h.iso}
                          disabled={disabled}
                          onClick={() =>
                            setSelectedSlot({
                              iso: h.iso,
                              label: `${formatDateShort(currentDay.date)} · ${range}`,
                            })
                          }
                          className={`rounded border px-3 py-3 text-left transition-all ${
                            disabled
                              ? 'border-stone-200 bg-stone-100 opacity-60'
                              : 'border-stone-300 bg-white hover:border-amber-700 hover:shadow-sm'
                          }`}
                        >
                          <p
                            className={`text-lg font-black tabular-nums ${
                              disabled ? 'text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {label}
                          </p>
                          <p
                            className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                              h.available
                                ? 'text-green-700'
                                : h.reason === 'booked'
                                  ? 'text-red-600'
                                  : h.reason === 'past'
                                    ? 'text-slate-400'
                                    : 'text-slate-500'
                            }`}
                          >
                            {h.available
                              ? t.labels.available
                              : h.reason === 'booked'
                                ? t.labels.booked
                                : h.reason === 'past'
                                  ? t.labels.past
                                  : t.labels.closed}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {selectedSlot && (
        <BookingModal
          open={!!selectedSlot}
          onClose={() => setSelectedSlot(null)}
          slotIso={selectedSlot.iso}
          slotLabel={selectedSlot.label}
          t={t.modal}
          onBookedRefresh={load}
        />
      )}
    </main>
  );
}
