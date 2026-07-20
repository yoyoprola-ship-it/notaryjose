'use client';
import { useEffect, useMemo, useState } from 'react';
import BookingModal, { type BookingCopy } from './BookingModal';
import { ctDateStr, formatDateShort, formatHour, formatSlotRange } from '@/app/lib/timeSlots';

// Sección de reservas embebible en cualquier página. Igual UX que la
// standalone /appointments — calendar de 7 días + grid de horas 8-19
// + BookingModal con SMS verify.

type Lang = 'en' | 'es';

interface HourEntry {
  hour: number;
  iso: string;
  available: boolean;
  // Nota: el API ya no devuelve 'past' — las horas ya vencidas se
  // filtran en el server y no aparecen en la respuesta. Solo quedan
  // 'booked' y 'closed' como razones de no-disponibilidad.
  reason?: 'booked' | 'closed';
}
interface DayEntry {
  date: string;
  dayOfWeek: number;
  hours: HourEntry[];
}

export interface AppointmentCopy {
  title: string;
  subtitle: string;
  pickDay: string;
  pickHour: string;
  loading: string;
  errorLoad: string;
  refresh: string;
  labels: { available: string; booked: string; closed: string };
  modal: BookingCopy;
}

export const APPT_COPY: Record<Lang, AppointmentCopy> = {
  en: {
    title: 'Book an appointment',
    subtitle: 'Pick a day and hour. One hour per slot.',
    pickDay: 'Choose a day',
    pickHour: 'Choose a time',
    loading: 'Loading slots…',
    errorLoad: 'Could not load slots. Please refresh.',
    refresh: 'Refresh',
    labels: { available: 'Open', booked: 'Booked', closed: 'Closed' },
    modal: {
      title: 'Book your slot',
      step1of3: 'Step 1 of 2 — Your details',
      step2of3: 'Step 2 of 2 — SMS verify',
      done: 'Confirmed',
      namePlaceholder: 'Your full name',
      phonePlaceholder: '(337) 123-4567',
      sendCode: 'Verify phone to book',
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
      requiredNotes: 'Please briefly describe what you need (5+ chars).',
      invalidCode: 'Code must be 6 digits.',
      wrongCode: 'Wrong or expired code.',
      bookingConflict:
        'That time was just booked by someone else. Please pick another.',
      networkError: 'Something went wrong. Please try again.',
      slotClosedHint: 'That hour is not available.',
      bookingWith: (whenLabel) => `You're booking: ${whenLabel}`,
      notesLabel: 'What do you need? (required)',
      notesPlaceholder:
        'Briefly describe the service — e.g. Power of attorney to sell a car, USCIS I-130 filing, notarize purchase contract…',
    },
  },
  es: {
    title: 'Agendar una cita',
    subtitle: 'Elegí día y hora. Un turno por hora.',
    pickDay: 'Elegí un día',
    pickHour: 'Elegí una hora',
    loading: 'Cargando…',
    errorLoad: 'No pudimos cargar los turnos. Por favor refrescá.',
    refresh: 'Refrescar',
    labels: { available: 'Libre', booked: 'Ocupado', closed: 'Cerrado' },
    modal: {
      title: 'Reservar turno',
      step1of3: 'Paso 1 de 2 — Tus datos',
      step2of3: 'Paso 2 de 2 — Verificación SMS',
      done: 'Confirmada',
      namePlaceholder: 'Tu nombre completo',
      phonePlaceholder: '(337) 123-4567',
      sendCode: 'Verificar teléfono para agendar',
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
      requiredNotes: 'Describí brevemente lo que necesitás (5+ caracteres).',
      invalidCode: 'El código debe tener 6 dígitos.',
      wrongCode: 'Código incorrecto o expirado.',
      bookingConflict:
        'Alguien acaba de reservar ese turno. Por favor elegí otro.',
      networkError: 'Algo salió mal. Intentá de nuevo.',
      slotClosedHint: 'Esa hora no está disponible.',
      bookingWith: (whenLabel) => `Estás reservando: ${whenLabel}`,
      notesLabel: '¿Qué necesitás? (obligatorio)',
      notesPlaceholder:
        'Describí brevemente el servicio — ej. Poder para vender un auto, formulario USCIS I-130, notarizar contrato de compraventa…',
    },
  },
};

interface Props {
  lang: Lang;
  /** Si true, se renderiza sin padding grande — útil para embebido. */
  compact?: boolean;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LABELS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function AppointmentSection({ lang }: Props) {
  const t = APPT_COPY[lang];
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

  // Build a map of date → DayEntry for quick lookup
  const dayMap = useMemo(
    () => new Map((days || []).map((d) => [d.date, d])),
    [days]
  );

  // 30-day rolling window starting from today in CT
  const todayCT = ctDateStr();
  const todayY = parseInt(todayCT.slice(0, 4), 10);
  const todayM = parseInt(todayCT.slice(5, 7), 10);
  const todayD = parseInt(todayCT.slice(8, 10), 10);

  const calendarCells = useMemo(() => {
    const anchor = new Date(todayY, todayM - 1, todayD);
    const cells: Array<{ day: number; date: string } | null> = [];
    // Blank offset so today aligns to its day-of-week column
    for (let i = 0; i < anchor.getDay(); i++) cells.push(null);
    for (let i = 0; i < 30; i++) {
      const d = new Date(todayY, todayM - 1, todayD + i);
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      const day = d.getDate();
      const date = `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, date });
    }
    return cells;
  }, [todayY, todayM, todayD]);

  // Range header: "Jul 20 – Aug 18, 2026"
  const locale = lang === 'es' ? 'es-US' : 'en-US';
  const rangeStart = new Date(todayY, todayM - 1, todayD);
  const rangeEnd   = new Date(todayY, todayM - 1, todayD + 29);
  const monthLabel = `${rangeStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const selectedDay = useMemo(
    () => (selectedDate ? (dayMap.get(selectedDate) ?? null) : null),
    [selectedDate, dayMap]
  );

  const dowLabels = lang === 'es' ? DOW_LABELS_ES : DOW_LABELS;

  return (
    <section
      id="book"
      className="px-6 py-16 bg-stone-50 border-y border-stone-200"
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700 mb-2">—</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-2">
            {t.title}
          </h2>
          <p className="text-sm text-slate-600">{t.subtitle}</p>
        </div>

        {loading && <p className="text-slate-500">{t.loading}</p>}
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
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {/* Month header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <p className="text-base font-black text-slate-900 capitalize">{monthLabel}</p>
              {/* Legend */}
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-sm border inline-block bg-green-100 border-green-300" />
                  {t.labels.available}
                </span>
              </div>
            </div>

            <div className="p-4">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-2">
                {dowLabels.map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar day cells */}
              <div className="grid grid-cols-7 gap-1 mb-6">
                {calendarCells.map((cell, i) => {
                  if (!cell) return <div key={`e-${i}`} />;
                  const entry = dayMap.get(cell.date);
                  const isPast = cell.date < todayCT;
                  const hasAvailable = !!entry?.hours.some((h) => h.available);
                  const hasEntry = !!entry;
                  const isSelected = selectedDate === cell.date;
                  const isToday = cell.date === todayCT;

                  let cellCls: string;
                  if (isPast || !hasEntry) {
                    cellCls = 'text-slate-300 cursor-default';
                  } else if (hasAvailable) {
                    cellCls = isSelected
                      ? 'bg-green-500 text-white border-green-600 shadow-sm cursor-pointer'
                      : 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100 cursor-pointer';
                  } else {
                    cellCls = 'bg-stone-100 text-slate-400 border-stone-200 cursor-default opacity-60';
                  }

                  return (
                    <button
                      key={cell.date}
                      disabled={isPast || !hasEntry || !hasAvailable}
                      onClick={() =>
                        setSelectedDate(isSelected ? null : cell.date)
                      }
                      className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition-all ${cellCls} ${isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                    >
                      <span className="text-sm font-black leading-none">
                        {cell.day}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Hour slots for selected day */}
              {selectedDay && (
                <div className="border-t border-stone-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    {formatDateShort(selectedDate!)} — {t.pickHour}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedDay.hours.filter((h) => h.available || h.reason === 'booked').map((h) => {
                      const isBooked = !h.available && h.reason === 'booked';
                      const btnCls = h.available
                        ? 'border-green-300 bg-green-50 hover:border-green-500 hover:shadow-sm cursor-pointer'
                        : isBooked
                          ? 'border-red-200 bg-red-50 opacity-75 cursor-not-allowed'
                          : 'border-stone-200 bg-stone-100 opacity-50 cursor-not-allowed';
                      const textCls = h.available
                        ? 'text-slate-800'
                        : isBooked
                          ? 'text-red-700'
                          : 'text-slate-400';
                      const statusCls = h.available
                        ? 'text-green-700'
                        : isBooked
                          ? 'text-red-500'
                          : 'text-slate-400';
                      return (
                        <button
                          key={h.iso}
                          disabled={!h.available}
                          onClick={() =>
                            setSelectedSlot({
                              iso: h.iso,
                              label: `${formatDateShort(selectedDate!)} · ${formatSlotRange(h.hour)}`,
                            })
                          }
                          className={`rounded-lg border px-3 py-3 text-left transition-all ${btnCls}`}
                        >
                          <p className={`text-base font-black tabular-nums leading-none ${textCls}`}>
                            {formatHour(h.hour)}
                          </p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${statusCls}`}>
                            {h.available
                              ? t.labels.available
                              : isBooked
                                ? t.labels.booked
                                : t.labels.closed}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
    </section>
  );
}
