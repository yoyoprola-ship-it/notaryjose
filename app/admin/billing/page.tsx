'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/app/lib/firebase';

interface Bill {
  id: string;
  period: string;
  label: string;
  bookings: number;
  minutes: number;
  bookingFee: number;
  minutesFee: number;
  total: number;
  dueDate: string;
  status: 'pending' | 'paid';
  paidAt?: { seconds: number } | null;
}

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState<string | null>(null);

  async function loadBills() {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setError('Not authenticated'); return; }
      const res = await fetch('/api/admin/bills', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError('Failed to load bills'); return; }
      const data = await res.json() as { bills: Bill[] };
      setBills(data.bills);
    } catch {
      setError('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadBills(); }, []);

  async function markPaid(period: string) {
    setMarking(period);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/bills', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      if (res.ok) {
        setBills((prev) => prev.map((b) => b.period === period ? { ...b, status: 'paid' } : b));
      }
    } finally {
      setMarking(null);
    }
  }

  const grandTotal = bills.reduce((s, b) => s + b.total, 0);
  const paidTotal  = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.total, 0);
  const pendingTotal = grandTotal - paidTotal;

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight mb-1">Billing History</h1>
        <p className="text-sm text-slate-500">
          All monthly invoices — $0.85/booking + $0.92/minute of inbound calls.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="All-time total" value={`$${grandTotal.toFixed(2)}`} accent />
        <StatCard label="Paid" value={`$${paidTotal.toFixed(2)}`} />
        <StatCard label="Pending" value={`$${pendingTotal.toFixed(2)}`} warn={pendingTotal > 0} />
      </div>

      {bills.length === 0 ? (
        <p className="text-slate-400 italic">No bills yet. Stats are saved automatically when the dashboard loads.</p>
      ) : (
        <div className="border border-stone-200 rounded overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-slate-500 uppercase tracking-wider text-xs border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Month</th>
                  <th className="text-right px-4 py-3 font-bold">Bookings</th>
                  <th className="text-right px-4 py-3 font-bold">Minutes</th>
                  <th className="text-right px-4 py-3 font-bold">Book. fee</th>
                  <th className="text-right px-4 py-3 font-bold">Min. fee</th>
                  <th className="text-right px-4 py-3 font-bold">Total</th>
                  <th className="text-right px-4 py-3 font-bold">Due</th>
                  <th className="text-right px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const due = new Date(bill.dueDate + 'T12:00:00');
                  const isPastDue = bill.status !== 'paid' && due < new Date();
                  const dueLabel = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <tr key={bill.period} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{bill.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{bill.bookings}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{bill.minutes}</td>
                      <td className="px-4 py-3 text-right tabular-nums">${bill.bookingFee.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">${bill.minutesFee.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-800">
                        ${bill.total.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums text-xs ${isPastDue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                        {dueLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {bill.status === 'paid' ? (
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">
                            Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => markPaid(bill.period)}
                            disabled={marking === bill.period}
                            className="inline-block px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
                          >
                            {marking === bill.period ? '…' : 'Mark paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-stone-300 bg-stone-50">
                <tr>
                  <td className="px-4 py-3 font-black text-slate-900">Total</td>
                  <td colSpan={4} />
                  <td className="px-4 py-3 text-right font-black tabular-nums text-amber-800">
                    ${grandTotal.toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`p-4 rounded border ${accent ? 'border-amber-300 bg-amber-50' : warn ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-amber-900' : warn ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
