'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthChange, signOut } from '@/app/lib/auth';
import { db } from '@/app/lib/firebase';

const OWNER_SESSION_WINDOW_MS = 8 * 60 * 60 * 1000;

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const isLoginPage = pathname === '/owner/login';

  useEffect(() => {
    if (isLoginPage) { setReady(true); return; }
    const unsub = onAuthChange(async (u) => {
      if (!u) { router.replace('/owner/login'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const sessionAt = snap.data()?.notaryjoseOwnerSessionAt;
        const sessionMs = sessionAt?.toMillis?.() ?? 0;
        if (!sessionMs || Date.now() - sessionMs > OWNER_SESSION_WINDOW_MS) {
          router.replace('/owner/login');
          return;
        }
      } catch {
        router.replace('/owner/login');
        return;
      }
      setReady(true);
    });
    return () => unsub();
  }, [router, isLoginPage]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/owner/login');
  };

  if (isLoginPage) return <>{children}</>;
  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50 text-slate-500">
        Verifying access…
      </main>
    );
  }

  const navItems = [
    { href: '/owner', label: 'Dashboard' },
    { href: '/owner/bookings', label: 'Bookings' },
    { href: '/owner/hours', label: 'Hours' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/owner" className="text-xl font-black tracking-tight">
            Notary Jose
            <span className="text-slate-400 text-xs font-medium tracking-normal ml-2 uppercase">
              owner
            </span>
          </Link>
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/owner' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded text-sm font-bold uppercase tracking-wide transition-colors ${
                    active
                      ? 'bg-amber-800 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-900 border border-stone-300 hover:border-stone-500 rounded"
        >
          Sign out
        </button>
      </header>
      <div className="flex-1 p-6 max-w-6xl w-full mx-auto">{children}</div>
    </div>
  );
}
