import { adminDb } from '../_lib/firebaseAdmin';
import type { ApiRequestLike, ApiResponseLike } from '../_lib/http';
import { readJson, requireAdmin, sendMethodNotAllowed } from '../_lib/http';

type AdminWriteAction =
  | 'preset_upsert'
  | 'preset_delete'
  | 'question_upsert'
  | 'session_create'
  | 'session_patch'
  | 'session_delete'
  | 'session_candidates'
  | 'results_delete'
  | 'results_delete_all';

interface AdminWritePayload {
  action: AdminWriteAction;
  data: Record<string, unknown>;
}

async function logAdminAction(
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  await adminDb.collection('audit_logs').add({
    action,
    entityType,
    entityId,
    actorEmail,
    createdAt: new Date().toISOString(),
    details,
  });
}

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    const { email } = await requireAdmin(req);
    const payload = await readJson<AdminWritePayload>(req);

    switch (payload.action) {
      case 'preset_upsert': {
        const { id, ...data } = payload.data;
        if (typeof data.name !== 'string' || !Array.isArray(data.questions) || typeof data.targetCount !== 'number') {
          res.status(400).json({ error: 'Invalid preset payload.' });
          return;
        }

        if (typeof id === 'string' && id) {
          await adminDb.collection('exam_presets').doc(id).set({ ...data, id });
          await logAdminAction(email, 'preset_updated', 'exam_presets', id, { name: data.name, targetCount: data.targetCount });
          res.status(200).json({ ok: true, preset: { ...data, id } });
          return;
        }

        const ref = await adminDb.collection('exam_presets').add(data);
        const preset = { ...data, id: ref.id };
        await adminDb.collection('exam_presets').doc(ref.id).set(preset);
        await logAdminAction(email, 'preset_created', 'exam_presets', ref.id, { name: data.name, targetCount: data.targetCount });
        res.status(200).json({ ok: true, preset });
        return;
      }

      case 'preset_delete': {
        const id = String(payload.data.id ?? '');
        const name = String(payload.data.name ?? '');
        await adminDb.collection('exam_presets').doc(id).delete();
        await logAdminAction(email, 'preset_deleted', 'exam_presets', id, { name });
        res.status(200).json({ ok: true });
        return;
      }

      case 'question_upsert': {
        const { id, ...data } = payload.data;
        const questionId = Number(data.questionId);
        if (!Number.isInteger(questionId)) {
          res.status(400).json({ error: 'Invalid question override payload.' });
          return;
        }

        const timestamp = new Date().toISOString();
        const overridePayload = {
          ...data,
          questionId,
          updatedAt: timestamp,
          updatedBy: email,
        };

        if (typeof id === 'string' && id) {
          await adminDb.collection('question_overrides').doc(id).set({ ...overridePayload, id }, { merge: true });
          await logAdminAction(email, 'question_updated', 'question_overrides', id, { questionId, status: data.status ?? null });
          res.status(200).json({ ok: true, questionOverride: { ...overridePayload, id } });
          return;
        }

        const ref = await adminDb.collection('question_overrides').add({
          ...overridePayload,
          createdAt: timestamp,
          createdBy: email,
        });
        const questionOverride = { ...overridePayload, createdAt: timestamp, createdBy: email, id: ref.id };
        await adminDb.collection('question_overrides').doc(ref.id).set(questionOverride, { merge: true });
        await logAdminAction(email, 'question_updated', 'question_overrides', ref.id, { questionId, status: data.status ?? null });
        res.status(200).json({ ok: true, questionOverride });
        return;
      }

      case 'session_create': {
        const data = payload.data;
        if (typeof data.name !== 'string' || typeof data.presetId !== 'string') {
          res.status(400).json({ error: 'Invalid session payload.' });
          return;
        }
        const ref = await adminDb.collection('exam_sessions').add(data);
        await logAdminAction(email, 'session_created', 'exam_sessions', ref.id, { name: data.name, presetId: data.presetId as string });
        res.status(200).json({ ok: true, session: { ...data, id: ref.id } });
        return;
      }

      case 'session_patch': {
        const id = String(payload.data.id ?? '');
        const changes = (payload.data.changes ?? {}) as Record<string, unknown>;
        const details = (payload.data.details ?? changes) as Record<string, unknown>;
        await adminDb.collection('exam_sessions').doc(id).set(changes, { merge: true });
        await logAdminAction(email, 'session_updated', 'exam_sessions', id, details);
        res.status(200).json({ ok: true });
        return;
      }

      case 'session_delete': {
        const id = String(payload.data.id ?? '');
        const name = String(payload.data.name ?? '');
        await adminDb.collection('exam_sessions').doc(id).delete();
        await logAdminAction(email, 'session_deleted', 'exam_sessions', id, { name });
        res.status(200).json({ ok: true });
        return;
      }

      case 'session_candidates': {
        const id = String(payload.data.id ?? '');
        const allowedCandidates = Array.isArray(payload.data.allowedCandidates) ? payload.data.allowedCandidates : [];
        await adminDb.collection('exam_sessions').doc(id).set({ allowedCandidates }, { merge: true });
        await logAdminAction(email, 'session_updated', 'exam_sessions', id, { allowedCandidatesCount: allowedCandidates.length });
        res.status(200).json({ ok: true });
        return;
      }

      case 'results_delete': {
        const ids = Array.isArray(payload.data.ids) ? [...new Set(payload.data.ids.map((value) => String(value)))] : [];
        const batch = adminDb.batch();
        ids.forEach((id) => batch.delete(adminDb.collection('exam_results').doc(id)));
        await batch.commit();
        await logAdminAction(email, 'result_deleted', 'exam_results', null, { deletedCount: ids.length, ids });
        res.status(200).json({ ok: true, deletedCount: ids.length });
        return;
      }

      case 'results_delete_all': {
        const snap = await adminDb.collection('exam_results').get();
        const batch = adminDb.batch();
        snap.docs.forEach((entry) => batch.delete(entry.ref));
        await batch.commit();
        await logAdminAction(email, 'results_deleted_all', 'exam_results', null, { deletedCount: snap.size });
        res.status(200).json({ ok: true, deletedCount: snap.size });
        return;
      }

      default:
        res.status(400).json({ error: 'Unsupported admin action.' });
    }
  } catch (error) {
    console.error('admin write error', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Admin write failed.' });
  }
}
