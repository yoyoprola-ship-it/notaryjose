'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/app/lib/firebase';
import type { Booking } from '@/app/types';
import { ctDateStr, next7DaysCT } from '@/app/lib/timeSlots';

export default function OwnerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) { setError('Not authenticated'); setLoading(false); return; }
        const res = await fetch('/api/owner/bookings', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || 'Failed to load'); setLoading(false); return; }
        const dates = new Set(next7DaysCT(7));
        setBookings(
          (data.bookings as Booking[]).filter(
            (b) => b.status === 'confirmed' && dates.has(b.slotDate)
          )
        );
      } catch (err) {
        console.error('[owner-dashboard] failed:', err);
        setError('Failed to load bookings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = ctDateStr();
  const todayCount = useMemo(
    () => bookings.filter((b) => b.slotDate === today).length,
    [bookings, today]
  );
  const nextBooking = useMemo(() => {
    return (
      [...bookings]
        .sort((a, b) => a.slot.localeCompare(b.slot))
        .find((b) => b.slotDate >= today) || null
    );
  }, [bookings, today]);

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-8">
        Overview of your upcoming appointments and weekly schedule.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Today" value={String(todayCount)} hint="confirmed appointments" />
        <StatCard
          label="Next 7 days"
          value={String(bookings.length)}
          hint="confirmed total"
          accent
        />
        <StatCard
          label="Next up"
          value={nextBooking ? nextBooking.customerName : '—'}
          hint={
            nextBooking
              ? `${nextBooking.slotDate} at ${nextBooking.slotHour}:00`
              : 'no upcoming'
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/owner/bookings"
          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded text-sm font-bold uppercase tracking-wide"
        >
          Manage bookings
        </Link>
        <Link
          href="/owner/hours"
          className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded text-sm font-bold uppercase tracking-wide text-slate-700"
        >
          Working hours
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded border ${
        accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-amber-900' : 'text-slate-900'}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
