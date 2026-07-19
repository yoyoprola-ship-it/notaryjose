import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from './firebaseAdmin';

export const OWNER_SESSION_FIELD = 'notaryjoseOwnerSessionAt' as const;
export const OWNER_SESSION_WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours

interface OwnerUserData {
  role?: string;
  notaryjoseOwnerSessionAt?: { toMillis: () => number } | null;
  [k: string]: unknown;
}

export type OwnerAuthOk = { ok: true; uid: string };
export type OwnerAuthFail = { ok: false; response: NextResponse };
export type OwnerAuthResult = OwnerAuthOk | OwnerAuthFail;

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '').slice(-10);
}

async function verifyOwnerIdentity(request: NextRequest): Promise<OwnerAuthResult> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing auth token' }, { status: 401 }),
    };
  }

  let uid: string;
  let tokenPhone: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
    tokenPhone = decoded.phone_number || '';
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid auth token' }, { status: 401 }),
    };
  }

  // Owner identified by phone number matching OWNER_PHONE env var
  const ownerPhone = normalizePhone(process.env.OWNER_PHONE || '');
  const userPhone = normalizePhone(tokenPhone);
  if (ownerPhone && userPhone && userPhone === ownerPhone) {
    return { ok: true, uid };
  }

  // Lafayette Market admin is also authorized
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }),
      };
    }
    const data = snap.data() as OwnerUserData;
    if (data.role !== 'admin') {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }),
      };
    }
    return { ok: true, uid };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Auth error' }, { status: 500 }),
    };
  }
}

/** Used by grant-session — checks identity only, no session timestamp. */
export async function requireOwnerWithoutSession(
  request: NextRequest
): Promise<OwnerAuthResult> {
  return verifyOwnerIdentity(request);
}

/** Used by all other owner API routes — checks identity AND active session. */
export async function requireOwner(request: NextRequest): Promise<OwnerAuthResult> {
  const base = await verifyOwnerIdentity(request);
  if (!base.ok) return base;

  try {
    const snap = await adminDb.collection('users').doc(base.uid).get();
    const data = snap.data() as OwnerUserData | undefined;
    const sessionAt = data?.[OWNER_SESSION_FIELD];
    const sessionMs =
      sessionAt && typeof sessionAt.toMillis === 'function' ? sessionAt.toMillis() : 0;
    if (!sessionMs || Date.now() - sessionMs > OWNER_SESSION_WINDOW_MS) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Session expired', needLogin: true },
          { status: 403 }
        ),
      };
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Auth error' }, { status: 500 }),
    };
  }

  return base;
}
