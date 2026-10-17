// Utilitários dos testes: rodam contra o Firebase Emulator Suite (projeto demo-, sem credenciais
// e sem tocar em produção). Execute com `npm test`, que sobe os emuladores e roda node --test.
import { initializeApp as adminInit, getApps as adminApps } from 'firebase-admin/app';
import { getFirestore as adminFs, FieldValue } from 'firebase-admin/firestore';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getStorage as adminStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

export const PROJECT = 'demo-lgpdsan';
export const BUCKET = `${PROJECT}.appspot.com`;
const HOST = '127.0.0.1';
const SENHA = 'senha-de-teste-123';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Rode pelos emuladores: npm test');
if (!adminApps().length) adminInit({ projectId: PROJECT, storageBucket: BUCKET });
export const admin = { db: adminFs(), auth: adminAuth(), bucket: adminStorage().bucket(BUCKET), FieldValue };

const RUN = Date.now().toString(36);
export const uid = n => `${n}-${RUN}`;
export const DEFAULT_CATS = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores', 'Segurança da Informação',
  'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura', 'Mapeamento de Dados'];

// Cenário: duas contabilidades e um usuário de cada perfil.
export async function seed() {
  const A = uid('contabA'), B = uid('contabB');
  await admin.db.doc(`contabilidades/${A}`).set({ nome: 'Contabilidade A ' + RUN });
  await admin.db.doc(`contabilidades/${B}`).set({ nome: 'Contabilidade B ' + RUN });
  await admin.db.doc('config/app').set({ lista: DEFAULT_CATS });
  const pessoas = {
    admin: { role: 'admin', contabilidades: [] },
    edicaoA: { role: 'edicao', contabilidades: [A] },
    consultaA: { role: 'consulta', contabilidades: [A] },
    edicaoB: { role: 'edicao', contabilidades: [B] }
  };
  const users = {};
  for (const [k, p] of Object.entries(pessoas)) {
    const email = `${k.toLowerCase()}-${RUN}@teste.local`;
    const u = await admin.auth.createUser({ uid: uid(k), email, password: SENHA });
    await admin.db.doc(`users/${u.uid}`).set({ nome: 'Pessoa ' + k, email, role: p.role, ativo: true, contabilidades: p.contabilidades });
    users[k] = { uid: u.uid, email };
  }
  return { A, B, users };
}

// Cliente "navegador" autenticado como um usuário, apontando para os emuladores.
export async function clientAs(user) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, storageBucket: BUCKET, appId: 'demo' }, user.email + Math.random());
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const fs = getFirestore(app); connectFirestoreEmulator(fs, HOST, 8080);
  const st = getStorage(app); connectStorageEmulator(st, HOST, 9199);
  const fn = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fn, HOST, 5001);
  await signInWithEmailAndPassword(auth, user.email, SENHA);
  return { app, auth, fs, st, uid: auth.currentUser.uid, call: async (n, d) => (await httpsCallable(fn, n)(d)).data };
}

const PDF = new TextEncoder().encode('%PDF-1.4\n% teste LGPDSAN\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
export const pdfBytes = () => PDF.slice();
export const snapBase = (extra = {}) => ({ titulo: 'Contrato com operador X', categoria: 'Contratos e Operadores', descricao: 'Texto inicial',
  status: 'Rascunho', prioridade: 'Média', responsavel: '', prazo: '', revisao: '', evidencias: '', ...extra });

// Falha esperada por permissão (Firestore/Storage/Functions usam códigos diferentes).
export const negado = e => /permission-denied|PERMISSION_DENIED|storage\/unauthorized|unauthenticated/i.test(`${e.code} ${e.message}`);
export const invalido = e => /invalid-argument|failed-precondition|aborted/i.test(`${e.code}`);

export const auditoriaDe = async (cid, recId) => (await admin.db.collection(`contabilidades/${cid}/auditoria`).where('recId', '==', recId).get()).docs.map(d => d.data());
export const versoesDe = async (cid, id) => (await admin.db.collection(`contabilidades/${cid}/registros/${id}/versoes`).get()).docs
  .map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.n - b.n);
