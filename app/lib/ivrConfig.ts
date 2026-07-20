import { adminDb } from './firebaseAdmin';
import { type IvrConfig, DEFAULT_IVR_CONFIG } from './ivrDefaults';

export type { IvrConfig };
export { DEFAULT_IVR_CONFIG };

export async function getIvrConfig(): Promise<IvrConfig> {
  try {
    const snap = await adminDb.collection('notaryjose_ivr_config').doc('default').get();
    if (!snap.exists) return DEFAULT_IVR_CONFIG;
    const saved = snap.data() as Partial<IvrConfig>;
    const merged = { ...DEFAULT_IVR_CONFIG };
    for (const key of Object.keys(DEFAULT_IVR_CONFIG) as (keyof IvrConfig)[]) {
      if (saved[key]) merged[key] = { ...DEFAULT_IVR_CONFIG[key], ...(saved[key] as object) } as never;
    }
    return merged;
  } catch {
    return DEFAULT_IVR_CONFIG;
  }
}
