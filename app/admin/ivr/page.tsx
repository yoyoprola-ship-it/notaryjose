'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/app/lib/firebase';
import type { IvrConfig } from '@/app/lib/ivrDefaults';

const EN_VOICES = [
  { value: 'Polly.Matthew',  label: 'Matthew (Man)' },
  { value: 'Polly.Joey',     label: 'Joey (Man)' },
  { value: 'Polly.Joanna',   label: 'Joanna (Woman)' },
  { value: 'Polly.Kendra',   label: 'Kendra (Woman)' },
  { value: 'Polly.Salli',    label: 'Salli (Woman)' },
];
const ES_VOICES = [
  { value: 'Polly.Miguel',   label: 'Miguel (Hombre)' },
  { value: 'Polly.Lupe',     label: 'Lupe (Mujer)' },
  { value: 'Polly.Penelope', label: 'Penelope (Mujer)' },
  { value: 'Polly.Conchita', label: 'Conchita (Mujer, España)' },
];

const SECTIONS: { title: string; fields: { key: keyof IvrConfig; label: string }[] }[] = [
  {
    title: 'Welcome',
    fields: [
      { key: 'intro',      label: 'Introduction (plays in both languages)' },
      { key: 'langPrompt', label: 'Language selection prompt' },
    ],
  },
  {
    title: 'Menu',
    fields: [
      { key: 'menu', label: 'Menu options (Press 1 / Press 2)' },
    ],
  },
  {
    title: 'Option 1 — Book appointment',
    fields: [
      { key: 'bookConfirm', label: 'Confirmation (plays after choosing option 1)' },
      { key: 'bookBye',     label: 'Goodbye' },
    ],
  },
  {
    title: 'Option 2 — Voice consultation',
    fields: [
      { key: 'consultPrompt', label: 'Recording prompt' },
      { key: 'consultNoRec',  label: 'No recording received' },
      { key: 'consultBye',    label: 'Goodbye (after recording saved)' },
    ],
  },
  {
    title: 'Fallback',
    fields: [
      { key: 'retry', label: 'Unrecognized key pressed' },
    ],
  },
];

export default function IvrConfigPage() {
  const [config, setConfig] = useState<IvrConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/ivr-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConfig(await res.json());
      setLoading(false);
    })();
  }, []);

  const handleChange = (field: keyof IvrConfig, lang: 'en' | 'es', value: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: { ...prev[field], [lang]: value } };
    });
    setStatus('idle');
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/ivr-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      setStatus(res.ok ? 'saved' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!config)  return <p className="text-red-600">Failed to load IVR config.</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-black tracking-tight mb-1">IVR Script</h1>
      <p className="text-sm text-slate-500 mb-8">
        Edit the text and voices the caller hears. Changes take effect on the next call — no deploy needed.
      </p>

      {/* Voices */}
      <div className="bg-white border border-stone-200 rounded p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Voices</p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">English voice</label>
            <select
              value={config.voices.en}
              onChange={(e) => handleChange('voices', 'en', e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {EN_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Spanish voice</label>
            <select
              value={config.voices.es}
              onChange={(e) => handleChange('voices', 'es', e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {ES_VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Text sections */}
      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-white border border-stone-200 rounded p-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{section.title}</p>
          <div className="space-y-5">
            {section.fields.map(({ key, label }) => (
              <div key={key}>
                <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-4">
                  {(['en', 'es'] as const).map((lang) => (
                    <div key={lang}>
                      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">
                        {lang === 'en' ? 'English' : 'Spanish'}
                      </label>
                      <textarea
                        value={(config[key] as { en: string; es: string })[lang]}
                        onChange={(e) => handleChange(key, lang, e.target.value)}
                        rows={3}
                        className="w-full border border-stone-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded text-sm font-bold uppercase tracking-wide"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && <p className="text-sm text-green-700 font-medium">Saved — next call will use the new script.</p>}
        {status === 'error' && <p className="text-sm text-red-600 font-medium">Error saving. Try again.</p>}
      </div>
    </div>
  );
}
