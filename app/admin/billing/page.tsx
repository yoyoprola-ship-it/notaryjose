'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import type { Booking, FirestoreTimestampish } from '@/app/types';

const RATE = 0.85;

function tsToMs(ts: FirestoreTimestampish): number {
  if (!ts) return 0;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (ts instanceof Date) return ts.getTime();
  if ('toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if ('seconds' in ts) return (ts as { seconds: number }).seconds * 1000;
  return 0;
}

function monthKey(ts: FirestoreTimestampish): string {
  const ms = tsToMs(ts);
  if (!ms) return 'Unknown';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  if (key === 'Unknown') return 'Unknown';
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

interface MonthRow {
  key: string;
  total: number;
  confirmed: number;
  cancelled: number;
  amount: number;
}

export default function BillingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'notaryjose_bookings'));
        setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking));
      } catch (err) {
        console.error('[billing] load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo((): MonthRow[] => {
    const map = new Map<string, MonthRow>();
    for (const b of bookings) {
      const key = monthKey(b.createdAt);
      if (!map.has(key)) {
        map.set(key, { key, total: 0, confirmed: 0, cancelled: 0, amount: 0 });
      }
      const row = map.get(key)!;
      row.total += 1;
      if (b.status === 'confirmed') row.confirmed += 1;
      else row.cancelled += 1;
      row.amount = row.total * RATE;
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [bookings]);

  const grandTotal = useMemo(() => bookings.length, [bookings]);
  const grandAmount = useMemo(() => grandTotal * RATE, [grandTotal]);

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight mb-1">Billing</h1>
        <p className="text-sm text-slate-500">
          Monthly booking count at ${RATE.toFixed(2)} per appointment created.
        </p>
      </div>

      {/* Grand total */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total bookings" value={String(grandTotal)} />
        <StatCard label="Total billed" value={`$${grandAmount.toFixed(2)}`} accent />
        <StatCard label="Rate" value={`$${RATE.toFixed(2)}/appt`} />
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-400 italic">No bookings yet.</p>
      ) : (
        <div className="border border-stone-200 rounded overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-slate-500 uppercase tracking-wider text-xs border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Month</th>
                <th className="text-right px-4 py-3 font-bold">Created</th>
                <th className="text-right px-4 py-3 font-bold">Confirmed</th>
                <th className="text-right px-4 py-3 font-bold">Cancelled</th>
                <th className="text-right px-4 py-3 font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-bold text-slate-900">{monthLabel(row.key)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">{row.confirmed}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{row.cancelled}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-800">
                    ${row.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-stone-300 bg-stone-50">
              <tr>
                <td className="px-4 py-3 font-black text-slate-900">Total</td>
                <td className="px-4 py-3 text-right font-black tabular-nums">{grandTotal}</td>
                <td colSpan={2} />
                <td className="px-4 py-3 text-right font-black tabular-nums text-amber-800">
                  ${grandAmount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded border ${accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-amber-900' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
