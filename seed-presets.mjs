import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const presetsPath = path.join(process.cwd(), 'public', 'data', 'built_in_presets.json');
const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));

console.log('Seeding exam_presets collection from public/data/built_in_presets.json...\n');

for (const preset of presets) {
  await db.collection('exam_presets').doc(preset.id).set(preset);
  console.log(`OK  ${preset.id}  "${preset.name}"  (${preset.questions.length} questions)`);
}

console.log(`\nDone. ${presets.length} presets are now live in Firestore.`);
console.log('They can be edited or replaced from the Admin Console -> Preset Manager tab.');
