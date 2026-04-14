import { adminAuth } from './firebaseAdmin';

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export interface ApiRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponseLike {
  status(code: number): ApiResponseLike;
  json(payload: unknown): void;
}

export async function readJson<T>(req: ApiRequestLike): Promise<T> {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T;
  }

  return req.body as T;
}

export function sendMethodNotAllowed(res: ApiResponseLike): void {
  res.status(405).json({ error: 'Method not allowed' });
}

export async function requireAdmin(req: ApiRequestLike): Promise<{ email: string }> {
  const rawAuthorization = req.headers.authorization;
  const authHeader = Array.isArray(rawAuthorization) ? rawAuthorization[0] ?? '' : rawAuthorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new Error('Missing admin authorization token.');
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = String(decoded.email ?? '').trim().toLowerCase();

  if (!email || !ADMIN_EMAILS.includes(email)) {
    throw new Error('Unauthorized admin account.');
  }

  return { email };
}
