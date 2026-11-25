import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { fbDb } from "../firebase";

/**
 * Minimal async document-store contract used by repo.ts. Backed by Cloud Firestore (client SDK).
 * Every personal document carries `user_id`; Firestore security rules only allow a signed-in user to
 * read/write documents whose user_id equals their own uid (see firestore.rules).
 */
export type Scalar = string | number | boolean;
export type DocData = { id: string } & Record<string, unknown>;

const COL = (c: string) => `sano_${c}`;

export const store = {
  async get(col: string, id: string): Promise<DocData | null> {
    const s = await getDoc(doc(fbDb(), COL(col), id));
    return s.exists() ? (s.data() as DocData) : null;
  },
  /** Insert or fully replace. */
  async set<T extends { id: string }>(col: string, d: T): Promise<void> {
    await setDoc(doc(fbDb(), COL(col), d.id), d);
  },
  async delete(col: string, id: string): Promise<void> {
    await deleteDoc(doc(fbDb(), COL(col), id));
  },
  /** Equality filters only → no composite indexes needed. */
  async where(col: string, eq: Record<string, Scalar>): Promise<DocData[]> {
    const q = query(collection(fbDb(), COL(col)), ...Object.entries(eq).map(([k, v]) => where(k, "==", v)));
    return (await getDocs(q)).docs.map((d) => d.data() as DocData);
  },
  async deleteWhere(col: string, eq: Record<string, Scalar>): Promise<number> {
    const q = query(collection(fbDb(), COL(col)), ...Object.entries(eq).map(([k, v]) => where(k, "==", v)));
    const snap = await getDocs(q);
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(fbDb());
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return snap.size;
  },
};
export const backend = () => "firestore" as const;
