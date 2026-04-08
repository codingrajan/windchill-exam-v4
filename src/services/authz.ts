import { auth } from './firebase';

const parseAdminEmails = (raw: string | undefined): string[] =>
  String(raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

export const ADMIN_EMAILS = parseAdminEmails(import.meta.env.VITE_ADMIN_EMAILS);
const ADMIN_SESSION_KEY = 'windchill:admin-session';

export interface LocalAdminSession {
  email: string;
}

const readStoredAdminSession = (): LocalAdminSession | null => {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalAdminSession>;
    if (typeof parsed.email !== 'string' || !parsed.email.trim()) return null;
    return { email: parsed.email.trim().toLowerCase() };
  } catch {
    return null;
  }
};

export const getStoredAdminSession = (): LocalAdminSession | null => readStoredAdminSession();

export const persistAdminSession = (session: LocalAdminSession): void => {
  window.localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      email: session.email.trim().toLowerCase(),
    }),
  );
};

export const clearAdminSession = (): void => {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
};

export const getCurrentActorEmail = (): string =>
  auth.currentUser?.email?.trim().toLowerCase() || readStoredAdminSession()?.email || 'system';

export const isAdminEmail = (email: string | null | undefined): boolean => {
  const normalized = String(email ?? '').trim().toLowerCase();
  return normalized.length > 0 && (ADMIN_EMAILS.length === 0 || ADMIN_EMAILS.includes(normalized));
};

export const assertAdminEmail = (email: string | null | undefined): void => {
  if (!isAdminEmail(email)) {
    throw new Error('This account is not authorized for admin access.');
  }
};
