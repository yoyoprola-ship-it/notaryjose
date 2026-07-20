'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/app/lib/firebase';

interface Consultation {
  id: string;
  callerPhone: string; // E.164
  recordingSid: string;
  duration: number;
  lang: string;
  status: string;
  createdAt: number | null;
}

function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return e164;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatDuration(s: number): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function OwnerConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setError('Not authenticated'); return; }
      const res = await fetch('/api/owner/consultations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Load failed');
      setConsultations(data.consultations as Consultation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Voice Consultations</h1>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-800 border border-stone-300 px-3 py-1.5 rounded">
          Refresh
        </button>
      </div>

      {consultations.length === 0 ? (
        <p className="text-sm text-slate-500">No consultations yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {consultations.map((c) => (
            <ConsultationCard key={c.id} c={c} onMarkedReviewed={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConsultationCard({
  c,
  onMarkedReviewed,
}: {
  c: Consultation;
  onMarkedReviewed: () => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState('');

  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyDone, setReplyDone] = useState(false);
  const [replyError, setReplyError] = useState('');

  const [marking, setMarking] = useState(false);

  const loadAudio = async () => {
    if (audioUrl || audioLoading) return;
    setAudioLoading(true);
    setAudioError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/owner/consultations/audio?sid=${c.recordingSid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load audio');
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : 'Error');
    } finally {
      setAudioLoading(false);
    }
  };

  const sendReply = async () => {
    if (replying || !replyText.trim()) return;
    setReplying(true);
    setReplyError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/owner/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: c.callerPhone, message: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setReplyDone(true);
      setReplyText('');
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : 'Error');
    } finally {
      setReplying(false);
    }
  };

  const markReviewed = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/owner/consultations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: c.id, status: 'reviewed' }),
      });
      onMarkedReviewed();
    } finally {
      setMarking(false);
    }
  };

  const isNew = c.status === 'new';

  return (
    <div className={`border rounded-lg p-5 ${isNew ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200 bg-white'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-black text-slate-900">{formatPhone(c.callerPhone)}</span>
            {isNew && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-700 text-white px-1.5 py-0.5 rounded">
                New
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-stone-200 px-1.5 py-0.5 rounded">
              {c.lang.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {formatDate(c.createdAt)} · {formatDuration(c.duration)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`tel:${c.callerPhone}`}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide border border-green-300 text-green-800 hover:bg-green-50 rounded"
          >
            Call
          </a>
          {isNew && (
            <button
              onClick={markReviewed}
              disabled={marking}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide border border-stone-300 text-slate-600 hover:bg-stone-50 rounded disabled:opacity-50"
            >
              {marking ? '…' : 'Mark reviewed'}
            </button>
          )}
        </div>
      </div>

      {/* Audio player */}
      <div className="mb-4">
        {!audioUrl ? (
          <button
            onClick={loadAudio}
            disabled={audioLoading}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wide bg-slate-800 text-white hover:bg-slate-900 rounded disabled:opacity-50"
          >
            {audioLoading ? 'Loading…' : '▶ Play recording'}
          </button>
        ) : (
          <audio controls src={audioUrl} className="w-full h-10" />
        )}
        {audioError && <p className="text-xs text-red-600 mt-1">{audioError}</p>}
      </div>

      {/* SMS reply */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Reply by SMS
        </p>
        {replyDone ? (
          <p className="text-xs text-green-700 font-bold">Message sent ✓</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Write a message…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={320}
              className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700"
              onKeyDown={(e) => { if (e.key === 'Enter') void sendReply(); }}
            />
            <button
              onClick={sendReply}
              disabled={replying || !replyText.trim()}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold uppercase tracking-wide rounded disabled:opacity-50"
            >
              {replying ? '…' : 'Send'}
            </button>
          </div>
        )}
        {replyError && <p className="text-xs text-red-600 mt-1">{replyError}</p>}
      </div>
    </div>
  );
}
