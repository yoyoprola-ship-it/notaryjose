'use client';
import { useState } from 'react';
import AppointmentSection from './components/AppointmentSection';
import CancelSection from './components/CancelSection';

// Landing pública de Notary Jose. Portea la sección de la app original
// (lafayette-market/app/services/providers/NotaryJose) como subdomain
// propio. Bilingüe EN/ES — el switch está arriba a la derecha.

// ─── Copy bilingüe ─────────────────────────────────────────────

interface CopyBlock {
  nav: { services: string; book: string; cancel: string; location: string; language: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
  };
  servicesTitle: string;
  services: { icon: string; title: string; desc: string }[];
  locationTitle: string;
  directions: string;
  footer: string;
}

const COPY: { en: CopyBlock; es: CopyBlock } = {
  en: {
    nav: { services: 'Services', book: 'Book', cancel: 'Cancel appt', location: 'Location', language: 'ES' },
    hero: {
      eyebrow: 'Bilingual notary public — Lafayette, Louisiana',
      title: 'Jose E. Garcia',
      subtitle:
        'Notary public serving Lafayette and surrounding parishes. Powers of attorney, immigration forms, contracts, tax preparation — English and Spanish, in one place.',
      cta: 'Request an appointment',
      ctaSecondary: 'Call (337) 849-4503',
    },
    servicesTitle: 'Services',
    services: [
      {
        icon: '✍️',
        title: 'Powers of Attorney',
        desc: 'General, special, and durable powers of attorney for any legal matter requiring authorized representation.',
      },
      {
        icon: '🏠',
        title: 'Purchase & Sale',
        desc: 'Real estate transactions, purchase-sale agreements, and property transfer documentation.',
      },
      {
        icon: '📋',
        title: 'Contracts',
        desc: 'Business contracts, personal agreements, and legally binding document notarization.',
      },
      {
        icon: '💼',
        title: 'Taxes',
        desc: 'Tax preparation and filing assistance for individuals, families, and small businesses.',
      },
      {
        icon: '🗽',
        title: 'USCIS / NVC Forms',
        desc: 'Immigration petitions, USCIS applications, and National Visa Center document preparation.',
      },
      {
        icon: '🛡️',
        title: 'Asylum Assistance',
        desc: 'Guidance and document preparation for asylum seekers and their families.',
      },
      {
        icon: '🛂',
        title: 'Passports',
        desc: 'Passport application assistance, passport photos, and official document notarization.',
      },
      {
        icon: '🏛️',
        title: 'Consular Appointments',
        desc: 'Scheduling assistance and full document preparation for consular appointments.',
      },
    ],
    locationTitle: 'Location',
    directions: 'Get directions',
    footer: 'Notary services in Lafayette, LA · English and Spanish',
  },
  es: {
    nav: { services: 'Servicios', book: 'Reservar', cancel: 'Cancelar cita', location: 'Ubicación', language: 'EN' },
    hero: {
      eyebrow: 'Notario público bilingüe — Lafayette, Luisiana',
      title: 'Jose E. Garcia',
      subtitle:
        'Notario público al servicio de Lafayette y las parroquias vecinas. Poderes, formas de inmigración, contratos, impuestos — en inglés y español, en un solo lugar.',
      cta: 'Solicitar una cita',
      ctaSecondary: 'Llamar al (337) 849-4503',
    },
    servicesTitle: 'Servicios',
    services: [
      {
        icon: '✍️',
        title: 'Poderes',
        desc: 'Poderes generales, especiales y duraderos para cualquier asunto legal que requiera representación autorizada.',
      },
      {
        icon: '🏠',
        title: 'Compra-venta',
        desc: 'Transacciones inmobiliarias, contratos de compra-venta y documentación de transferencia de propiedad.',
      },
      {
        icon: '📋',
        title: 'Contratos',
        desc: 'Contratos comerciales, acuerdos personales y notarización de documentos legalmente vinculantes.',
      },
      {
        icon: '💼',
        title: 'Impuestos',
        desc: 'Preparación y presentación de impuestos para individuos, familias y pequeños negocios.',
      },
      {
        icon: '🗽',
        title: 'Formas USCIS / NVC',
        desc: 'Peticiones de inmigración, solicitudes de USCIS y preparación de documentos para el National Visa Center.',
      },
      {
        icon: '🛡️',
        title: 'Asilo',
        desc: 'Orientación y preparación de documentos para solicitantes de asilo y sus familias.',
      },
      {
        icon: '🛂',
        title: 'Pasaportes',
        desc: 'Asistencia con solicitudes de pasaporte, fotos y notarización de documentos oficiales.',
      },
      {
        icon: '🏛️',
        title: 'Citas consulares',
        desc: 'Asistencia con el agendamiento y preparación completa de documentos para citas consulares.',
      },
    ],
    locationTitle: 'Ubicación',
    directions: 'Cómo llegar',
    footer: 'Servicios notariales en Lafayette, LA · Inglés y español',
  },
};

type Lang = 'en' | 'es';

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = COPY[lang];

  return (
    <main className="min-h-screen flex flex-col">
      <TopBar lang={lang} onToggleLang={() => setLang(lang === 'en' ? 'es' : 'en')} t={t} />
      <Hero t={t} />
      <ServicesGrid t={t} />
      <AppointmentSection lang={lang} />
      <CancelSection lang={lang} />
      <LocationSection t={t} />
      <Footer t={t} />
    </main>
  );
}

function TopBar({
  lang,
  onToggleLang,
  t,
}: {
  lang: Lang;
  onToggleLang: () => void;
  t: CopyBlock;
}) {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight text-slate-900">
            Notary Jose
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
            Lafayette, LA
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-4">
          <a
            href="#services"
            className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900"
          >
            {t.nav.services}
          </a>
          <a
            href="#book"
            className="hidden sm:inline text-sm font-bold text-amber-800 hover:text-amber-900"
          >
            {t.nav.book}
          </a>
          <a
            href="#cancel"
            className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900"
          >
            {t.nav.cancel}
          </a>
          <a
            href="#location"
            className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900"
          >
            {t.nav.location}
          </a>
          <button
            onClick={onToggleLang}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 border border-amber-300 hover:bg-amber-50 rounded"
            title={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}
          >
            {t.nav.language}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ t }: { t: CopyBlock }) {
  return (
    <section className="px-6 pt-16 pb-24 sm:pt-24">
      <div className="max-w-3xl mx-auto text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mx-auto mb-8 w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden ring-4 ring-amber-700/40 ring-offset-4 ring-offset-stone-50 shadow-lg">
          <img
            src="/jose.jpg"
            alt="Jose E. Garcia — Notary Public"
            className="w-full h-full object-cover"
            style={{ objectPosition: 'top center' }}
          />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700 mb-4">
          {t.hero.eyebrow}
        </p>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 mb-6 leading-[1.05]">
          {t.hero.title}
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto mb-10">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#book"
            className="px-8 py-3 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded transition-colors"
          >
            {t.hero.cta}
          </a>
          <a
            href="tel:+13378494503"
            className="px-8 py-3 border-2 border-slate-300 hover:border-slate-500 text-slate-800 font-bold rounded transition-colors"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}

function ServicesGrid({ t }: { t: CopyBlock }) {
  return (
    <section id="services" className="px-6 py-16 bg-white border-y border-stone-200">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700 mb-2">
            —
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            {t.servicesTitle}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.services.map((s) => (
            <div
              key={s.title}
              className="border border-stone-200 rounded-lg p-5 hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <p className="text-sm font-bold text-slate-900 mb-2">{s.title}</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocationSection({ t }: { t: CopyBlock }) {
  return (
    <section id="location" className="px-6 py-16 bg-white border-t border-stone-200">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700 mb-2">—</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">{t.locationTitle}</h2>
          <p className="text-slate-600 mt-2">100 Eva Dr, Lafayette, LA 70508</p>
        </div>
        <div className="rounded-xl overflow-hidden border border-stone-200 shadow-sm">
          <iframe
            title="Notary Jose location"
            src="https://maps.google.com/maps?q=100+Eva+Dr+Lafayette+LA+70508&output=embed&z=15"
            width="100%"
            height="380"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="mt-4">
          <a
            href="https://www.google.com/maps/dir/?api=1&destination=100+Eva+Dr+Lafayette+LA+70508"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-amber-800 hover:text-amber-900"
          >
            {t.directions} →
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer({ t }: { t: CopyBlock }) {
  return (
    <footer className="border-t border-stone-200 py-6 text-center bg-white">
      <p className="text-xs text-slate-500 mb-1">{t.footer}</p>
      <p className="text-xs text-slate-500">
        <a
          href="https://lafayettelamarket.com"
          className="text-slate-600 underline decoration-stone-300 hover:decoration-slate-500"
        >
          Lafayette Market
        </a>
      </p>
    </footer>
  );
}
