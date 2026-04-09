import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { upsertPreset } from './writeGateway';
import type { Preset } from '../types/index';

export interface PresetSyncResult {
  syncedIds: string[];
  failedIds: string[];
}

export async function fetchFirestorePresets(): Promise<Preset[]> {
  const snap = await getDocs(collection(db, 'exam_presets'));
  const loaded: Preset[] = [];
  snap.forEach((doc) => loaded.push({ ...(doc.data() as Preset), id: doc.id }));
  return loaded;
}

export async function fetchBuiltInPresets(): Promise<Preset[]> {
  const response = await fetch('/data/built_in_presets.json');
  if (!response.ok) return [];
  return (await response.json()) as Preset[];
}

export function mergePresetCatalog(firestorePresets: Preset[], builtInPresets: Preset[]): Preset[] {
  const byId = new Map<string, Preset>();

  builtInPresets.forEach((preset) => byId.set(preset.id, preset));
  firestorePresets.forEach((preset) => byId.set(preset.id, preset));

  return [...byId.values()].sort((left, right) => {
    if (left.targetCount !== right.targetCount) return left.targetCount - right.targetCount;
    return left.name.localeCompare(right.name);
  });
}

export async function syncBuiltInPresetsToFirestore(
  builtInPresets: Preset[],
  firestorePresets: Preset[],
): Promise<PresetSyncResult> {
  const firestoreById = new Map(firestorePresets.map((preset) => [preset.id, preset]));
  const syncedIds: string[] = [];
  const failedIds: string[] = [];

  for (const preset of builtInPresets) {
    try {
      const existing = firestoreById.get(preset.id);
      const isSame =
        existing
        && JSON.stringify({ ...existing, updatedAt: preset.updatedAt })
          === JSON.stringify({ ...preset, updatedAt: preset.updatedAt });
      if (isSame) continue;
      const { id, ...payload } = preset;
      await upsertPreset(payload, id);
      syncedIds.push(id);
    } catch (error) {
      console.error(`Preset sync failed for ${preset.id}:`, error);
      failedIds.push(preset.id);
    }
  }

  return { syncedIds, failedIds };
}
