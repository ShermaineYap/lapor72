import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { currentUser, db } from './firebase';
import type { Drafts } from './ai';

// Only the redacted fact sheet and drafts are stored. The leaked records never leave the device,
// and the contact person stays as the [CONTACT_PERSON] placeholder.
export interface SavedCase {
  id: string;
  organisation: string;
  commissionerDeadline: string | null;
  sheet: object;
  drafts: Drafts | null;
  createdAt?: unknown;
}

export async function saveCase(c: Omit<SavedCase, 'createdAt'>): Promise<void> {
  const u = await currentUser();
  await setDoc(doc(db, 'users', u.uid, 'cases', c.id), { ...c, createdAt: serverTimestamp() });
}

export async function listCases(): Promise<SavedCase[]> {
  const u = await currentUser();
  const snap = await getDocs(query(collection(db, 'users', u.uid, 'cases'), orderBy('createdAt', 'desc'), limit(10)));
  return snap.docs.map((d) => d.data() as SavedCase);
}
