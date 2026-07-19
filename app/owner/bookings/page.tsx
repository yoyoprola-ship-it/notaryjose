'use client';
import { useEffect, useMemo, useState } from 'react';
import { auth } from '@/app/lib/firebase';
import type { Booking } from '@/app/types';
import { formatDateShort, formatSlotRange } from '@/app/lib/timeSlots';

type FilterKey = 'upcoming' | 'confirmed' | 'cancelled' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

function formatPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return p;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function OwnerBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) { setLoadError('Not authenticated'); setLoading(false); return; }
      const res = await fetch('/api/owner/bookings', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(data.error || 'Failed to load'); setLoading(false); return; }
      setItems(data.bookings as Booking[]);
    } catch (err) {
      console.error('[owner/bookings] load failed:', err);
      setLoadError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const now = new Date().toISOString().slice(0, 19);
    if (filter === 'upcoming') {
      return items.filter((b) => b.status === 'confirmed' && b.slot >= now);
    }
    if (filter === 'confirmed') return items.filter((b) => b.status === 'confirmed');
    if (filter === 'cancelled') return items.filter((b) => b.status === 'cancelled');
    return items;
  }, [items, filter]);

  const cancelBooking = async (b: Booking) => {
    if (busyId) return;
    if (!confirm(`Cancel appointment for ${b.customerName} on ${b.slotDate}?`)) return;
    setBusyId(b.id);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) { alert('Not authenticated'); setBusyId(null); return; }
      const res = await fetch('/api/owner/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ bookingId: b.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || 'Cancel failed'); setBusyId(null); return; }
      setItems((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, status: 'cancelled' } : x))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Bookings</h1>
          <p className="text-sm text-slate-500">
            All appointments. Cancel from here if needed.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded text-sm font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors ${
              filter === f.key
                ? 'bg-amber-800 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-stone-100 hover:bg-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-stone-200 bg-white rounded p-8 text-center">
          <p className="text-slate-500">No bookings in this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              busy={busyId === b.id}
              onCancel={() => cancelBooking(b)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  b,
  busy,
  onCancel,
}: {
  b: Booking;
  busy: boolean;
  onCancel: () => void;
}) {
  const isCancelled = b.status === 'cancelled';
  return (
    <div
      className={`border rounded p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 transition-opacity bg-white ${
        busy ? 'opacity-50' : ''
      } ${isCancelled ? 'border-stone-200 opacity-70' : 'border-amber-200'}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              isCancelled
                ? 'bg-stone-100 text-slate-500 border border-stone-300'
                : 'bg-amber-50 text-amber-800 border border-amber-300'
            }`}
          >
            {b.status}
          </span>
          <p className="font-bold text-slate-900">{b.customerName}</p>
          <a
            href={`tel:+1${b.customerPhone}`}
            className="text-sm text-slate-600 hover:text-slate-900 underline decoration-stone-300"
          >
            {formatPhone(b.customerPhone)}
          </a>
        </div>
        <p className="text-sm text-slate-700">
          <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold mr-1">
            When
          </span>
          {formatDateShort(b.slotDate)} · {formatSlotRange(b.slotHour)}
        </p>
        {b.notes && (
          <p className="text-sm text-slate-600 mt-2 border-l-2 border-stone-300 pl-3">
            {b.notes}
          </p>
        )}
      </div>
      <div className="flex md:flex-col gap-2">
        {!isCancelled && (
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 rounded text-xs font-bold uppercase tracking-wide"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
