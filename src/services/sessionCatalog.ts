import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ExamSession } from '../types/index';

export async function fetchBuiltInSessions(): Promise<ExamSession[]> {
  const response = await fetch('/data/built_in_sessions.json');
  if (!response.ok) return [];
  return (await response.json()) as ExamSession[];
}

export async function fetchFirestoreSessions(): Promise<ExamSession[]> {
  const snap = await getDocs(collection(db, 'exam_sessions'));
  const loaded: ExamSession[] = [];
  snap.forEach((entry) => loaded.push({ ...(entry.data() as ExamSession), id: entry.id }));
  return loaded;
}

export function mergeSessionCatalog(firestoreSessions: ExamSession[], builtInSessions: ExamSession[]): ExamSession[] {
  const byId = new Map<string, ExamSession>();
  builtInSessions.forEach((session) => byId.set(session.id, session));
  firestoreSessions.forEach((session) => byId.set(session.id, session));
  return [...byId.values()].sort((left, right) =>
    String(right.startsAt ?? right.createdAt).localeCompare(String(left.startsAt ?? left.createdAt)),
  );
}

export async function syncBuiltInSessionsToFirestore(
  builtInSessions: ExamSession[],
  firestoreSessions: ExamSession[],
): Promise<{ syncedIds: string[]; failedIds: string[] }> {
  const existingIds = new Set(firestoreSessions.map((session) => session.id));
  const missing = builtInSessions.filter((session) => !existingIds.has(session.id));
  const syncedIds: string[] = [];
  const failedIds: string[] = [];

  for (const session of missing) {
    try {
      await setDoc(doc(db, 'exam_sessions', session.id), session);
      syncedIds.push(session.id);
    } catch (error) {
      console.error(`Session sync failed for ${session.id}:`, error);
      failedIds.push(session.id);
    }
  }

  return { syncedIds, failedIds };
}
