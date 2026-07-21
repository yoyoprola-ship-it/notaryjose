'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { auth } from '@/app/lib/firebase';
import type { Booking } from '@/app/types';
import { ctDateStr, next7DaysCT } from '@/app/lib/timeSlots';

interface MonthStats { label: string; bookings: number; calls: number; consults: number; minutes: number; dueDate: string }

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<{ current: MonthStats; previous: MonthStats } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dates = next7DaysCT(7);
        const token = await auth.currentUser?.getIdToken();

        const [bookingSnap, statsRes] = await Promise.all([
          getDocs(query(
            collection(db, 'notaryjose_bookings'),
            where('slotDate', 'in', dates),
            where('status', '==', 'confirmed'),
          )),
          token
            ? fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve(null),
        ]);

        setBookings(bookingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
        if (statsRes?.ok) {
          const data = await statsRes.json();
          setStats(data as { current: MonthStats; previous: MonthStats });
        }
      } catch (err) {
        console.error('[admin] dashboard load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = ctDateStr();
  const todayCount = useMemo(() => bookings.filter((b) => b.slotDate === today).length, [bookings, today]);
  const nextBooking = useMemo(
    () => [...bookings].sort((a, b) => a.slot.localeCompare(b.slot)).find((b) => b.slotDate >= today) ?? null,
    [bookings, today]
  );

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight mb-1">Dashboard</h1>
      <p className="text-sm text-slate-500 mb-8">Overview of your bookings and activity.</p>

      {/* Upcoming */}
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Upcoming</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Today" value={String(todayCount)} hint="confirmed appointments" />
        <StatCard label="Next 7 days" value={String(bookings.length)} hint="confirmed total" accent />
        <StatCard
          label="Next up"
          value={nextBooking ? nextBooking.customerName : '—'}
          hint={nextBooking ? `${nextBooking.slotDate} at ${nextBooking.slotHour}:00` : 'no upcoming'}
        />
      </div>

      {/* Monthly stats */}
      {stats && (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Monthly activity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <MonthCard m={stats.current} accent />
            <MonthCard m={stats.previous} />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Revenue</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <BillingCard m={stats.current} accent />
            <BillingCard m={stats.previous} />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 mb-10">
        <Link href="/admin/bookings" className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded text-sm font-bold uppercase tracking-wide">
          Manage bookings
        </Link>
        <Link href="/admin/hours" className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded text-sm font-bold uppercase tracking-wide text-slate-700">
          Working hours
        </Link>
        <Link href="/admin/billing" className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded text-sm font-bold uppercase tracking-wide text-slate-700">
          Billing
        </Link>
      </div>

      <div className="border border-stone-200 bg-white rounded p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Quick info</p>
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

function MonthCard({ m, accent }: { m: MonthStats; accent?: boolean }) {
  return (
    <div className={`p-5 rounded border ${accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
      <p className={`text-sm font-black uppercase tracking-wide mb-4 ${accent ? 'text-amber-800' : 'text-slate-500'}`}>
        {m.label}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Bookings</p>
          <p className="text-2xl font-black text-slate-900">{m.bookings}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Calls</p>
          <p className="text-2xl font-black text-slate-900">{m.calls}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Consults</p>
          <p className="text-2xl font-black text-slate-900">{m.consults}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Minutes</p>
          <p className="text-2xl font-black text-slate-900">{m.minutes}</p>
        </div>
      </div>
    </div>
  );
}

function BillingCard({ m, accent }: { m: MonthStats; accent?: boolean }) {
  const bookingFee = m.bookings * 0.85;
  const minutesFee = m.minutes * 0.59;
  const total = bookingFee + minutesFee;
  const due = new Date(m.dueDate + 'T12:00:00');
  const isPast = due < new Date();
  const dueLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className={`p-5 rounded border ${accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
      <p className={`text-sm font-black uppercase tracking-wide mb-4 ${accent ? 'text-amber-800' : 'text-slate-500'}`}>
        {m.label} — Revenue
      </p>
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">{m.bookings} bookings × $0.85</span>
          <span className="font-bold">${bookingFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">{m.minutes} min × $0.59</span>
          <span className="font-bold">${minutesFee.toFixed(2)}</span>
        </div>
        <div className="border-t border-stone-200 pt-2 flex justify-between items-baseline">
          <span className="font-black text-slate-900">Total</span>
          <span className="text-2xl font-black text-slate-900">${total.toFixed(2)}</span>
        </div>
      </div>
      <p className={`text-xs font-bold ${isPast ? 'text-slate-400' : 'text-amber-700'}`}>
        {isPast ? `Payment was due ${dueLabel}` : `Payment due before ${dueLabel}`}
      </p>
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded border ${accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-amber-900' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
