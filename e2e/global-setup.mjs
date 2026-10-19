import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const E2E_PASSWORD = 'e2e-senha-123';
export const E2E_ADMIN = 'e2e-admin@teste.local';
export const E2E_CONSULTA = 'e2e-consulta@teste.local';

export default async function globalSetup() {
  process.env.GCLOUD_PROJECT = 'demo-lgpdsan';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  if (!getApps().length) initializeApp({ projectId: 'demo-lgpdsan' });
  const auth = getAuth();
  const db = getFirestore();
  const a = 'e2e-contab-a';
  const b = 'e2e-contab-b';
  await db.doc(`contabilidades/${a}`).set({ nome: 'E2E Contabilidade A' });
  await db.doc(`contabilidades/${b}`).set({ nome: 'E2E Contabilidade B' });
  await db.doc('config/app').set({ lista: ['Governança e Políticas', 'Contratos e Operadores'] });
  for (const [uid, email, role, contabilidades] of [
    ['e2e-admin', E2E_ADMIN, 'admin', []],
    ['e2e-consulta', E2E_CONSULTA, 'consulta', [a]]
  ]) {
    try { await auth.createUser({ uid, email, password: E2E_PASSWORD }); } catch (e) {
      if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e;
    }
    await db.doc(`users/${uid}`).set({ nome: uid === 'e2e-admin' ? 'Administrador E2E' : 'Consulta E2E', email, role, ativo: true, contabilidades });
  }
}
