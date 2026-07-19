'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import type { Booking } from '@/app/types';
import { ctDateStr, next7DaysCT } from '@/app/lib/timeSlots';

// Dashboard skeleton — muestra KPIs de bookings + link a las secciones.

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dates = next7DaysCT(7);
        // Cargamos las bookings de los próximos 7 días (activas)
        const snap = await getDocs(
          query(
            collection(db, 'notaryjose_bookings'),
            where('slotDate', 'in', dates),
            where('status', '==', 'confirmed')
          )
        );
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking)
        );
      } catch (err) {
        console.error('[admin] load bookings failed:', err);
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
  const nextCount = bookings.length;
  const nextBooking = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => a.slot.localeCompare(b.slot));
    return sorted.find((b) => b.slotDate >= today) || null;
  }, [bookings, today]);

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-8">
        Overview of your bookings and setup.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Today" value={String(todayCount)} hint="confirmed appointments" />
        <StatCard label="Next 7 days" value={String(nextCount)} hint="confirmed total" accent />
        <StatCard
          label="Next up"
          value={nextBooking ? nextBooking.customerName : '—'}
          hint={nextBooking ? `${nextBooking.slotDate} at ${nextBooking.slotHour}:00` : 'no upcoming'}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/admin/bookings"
          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded text-sm font-bold uppercase tracking-wide"
        >
          Manage bookings
        </Link>
        <Link
          href="/admin/hours"
          className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded text-sm font-bold uppercase tracking-wide text-slate-700"
        >
          Working hours
        </Link>
      </div>

      <div className="border border-stone-200 bg-white rounded p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
          Quick info
        </p>
        <ul className="text-sm text-slate-700 space-y-1.5 list-disc list-inside">
          <li>Owner phone (SMS notifications) reads from <code>OWNER_PHONE</code></li>
          <li>Slots span 8 AM – 8 PM, one appointment per hour</li>
          <li>Working hours are configurable per day of the week</li>
          <li>Customers verify via SMS before their booking is created</li>
        </ul>
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
    <div className={`p-4 rounded border ${
      accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'
    }`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-black ${
        accent ? 'text-amber-900' : 'text-slate-900'
      }`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
