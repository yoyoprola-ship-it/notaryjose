'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import type { WorkingHours } from '@/app/types';
import { DEFAULT_HOURS } from '@/app/types';
import { formatHour } from '@/app/lib/timeSlots';

// Admin configura qué horas están abiertas cada día de la semana.
// Doc único: notaryjose_config/hours. Rule permite admin write.
//
// Model: hoursByDayOfWeek[dow] = array de horas abiertas 8..19.
// Ausente para un dow = usa DEFAULT_HOURS. Un array vacío = cerrado.

const DAYS = [
  { dow: 0, label: 'Sunday' },
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
];

const ALL_HOURS = DEFAULT_HOURS as unknown as number[];

export default function HoursPage() {
  const [config, setConfig] = useState<WorkingHours>({
    hoursByDayOfWeek: {},
    blockedDates: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [blockDate, setBlockDate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'notaryjose_config', 'hours'));
        if (snap.exists()) setConfig(snap.data() as WorkingHours);
      } catch (err) {
        console.error('[hours] load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hoursFor = (dow: number): number[] => {
    if (config.hoursByDayOfWeek?.[dow] !== undefined) {
      return config.hoursByDayOfWeek[dow] as number[];
    }
    return ALL_HOURS.slice();
  };

  const toggleHour = (dow: number, h: number) => {
    const current = hoursFor(dow);
    const isOn = current.includes(h);
    const next = isOn ? current.filter((x) => x !== h) : [...current, h].sort((a, b) => a - b);
    setConfig({
      ...config,
      hoursByDayOfWeek: {
        ...(config.hoursByDayOfWeek || {}),
        [dow]: next,
      },
    });
    setSaved(false);
  };

  const toggleAll = (dow: number, on: boolean) => {
    setConfig({
      ...config,
      hoursByDayOfWeek: {
        ...(config.hoursByDayOfWeek || {}),
        [dow]: on ? ALL_HOURS.slice() : [],
      },
    });
    setSaved(false);
  };

  const addBlockedDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      setError('Use YYYY-MM-DD format.'); return;
    }
    setError('');
    const list = config.blockedDates || [];
    if (list.includes(blockDate)) return;
    setConfig({ ...config, blockedDates: [...list, blockDate].sort() });
    setBlockDate('');
    setSaved(false);
  };

  const removeBlockedDate = (d: string) => {
    setConfig({
      ...config,
      blockedDates: (config.blockedDates || []).filter((x) => x !== d),
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await setDoc(
        doc(db, 'notaryjose_config', 'hours'),
        {
          hoursByDayOfWeek: config.hoursByDayOfWeek || {},
          blockedDates: config.blockedDates || [],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-1">Working hours</h1>
          <p className="text-sm text-slate-500">
            Pick which hours are open per day of the week. Slots are one hour each.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded text-sm font-bold uppercase tracking-wide"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="border border-stone-200 rounded overflow-hidden bg-white mb-8">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-slate-500 uppercase tracking-wider text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-bold w-[140px]">Day</th>
              <th className="text-left px-2 py-3 font-bold" colSpan={ALL_HOURS.length}>
                Hours (click to toggle)
              </th>
              <th className="text-right px-4 py-3 font-bold w-[100px]">Bulk</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => {
              const openSet = new Set(hoursFor(day.dow));
              const anyOn = openSet.size > 0;
              return (
                <tr key={day.dow} className="border-t border-stone-200">
                  <td className="px-4 py-3 font-bold">{day.label}</td>
                  {ALL_HOURS.map((h) => {
                    const on = openSet.has(h);
                    return (
                      <td key={h} className="px-1 py-2 text-center">
                        <button
                          onClick={() => toggleHour(day.dow, h)}
                          className={`w-full min-w-[36px] px-1 py-1.5 text-[10px] font-bold rounded transition-colors ${
                            on
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                              : 'bg-stone-100 text-slate-400 border border-stone-200 hover:bg-stone-200'
                          }`}
                          title={formatHour(h)}
                        >
                          {h}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => toggleAll(day.dow, true)}
                        disabled={openSet.size === ALL_HOURS.length}
                        className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-900 disabled:opacity-30 px-1"
                      >
                        All
                      </button>
                      <button
                        onClick={() => toggleAll(day.dow, false)}
                        disabled={!anyOn}
                        className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-900 disabled:opacity-30 px-1"
                      >
                        Off
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border border-stone-200 rounded p-6 bg-white">
        <h2 className="text-lg font-black tracking-tight mb-2">Blocked dates</h2>
        <p className="text-xs text-slate-500 mb-4">
          Specific days closed (holidays, vacation). Format: YYYY-MM-DD.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            className="px-3 py-2 border border-stone-300 rounded text-sm text-slate-900 focus:outline-none focus:border-amber-700"
          />
          <button
            onClick={addBlockedDate}
            className="px-3 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded text-xs font-bold uppercase tracking-wide"
          >
            + Block
          </button>
        </div>
        {(config.blockedDates?.length || 0) === 0 ? (
          <p className="text-sm text-slate-400 italic">No blocked dates.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(config.blockedDates || []).map((d) => (
              <button
                key={d}
                onClick={() => removeBlockedDate(d)}
                className="px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 rounded text-xs font-bold"
                title="Click to remove"
              >
                {d} ×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
