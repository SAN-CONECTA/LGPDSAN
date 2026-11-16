// Testes das regras do Firestore para users/{uid} (autoria das permissões) e sessoes/{sid}
// (sessão revogada não é apagada pelo dono). Rodar em tests/rules: npm test.
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';

const REGRAS = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const AUTH_TIME = Math.floor(Date.now() / 1000);

const PERFIS = {
  admin: { nome: 'Admin Teste', email: 'admin@teste.local', role: 'admin', ativo: true, contabilidades: [] },
  admin2: { nome: 'Admin Dois', email: 'admin2@teste.local', role: 'admin', ativo: true, contabilidades: [] },
  edicao: { nome: 'Edicao Teste', email: 'edicao@teste.local', role: 'edicao', ativo: true, contabilidades: ['c1'] },
  // Última alteração de permissão feita por admin2: serve para testar a assinatura "herdada".
  alvo: { nome: 'Alvo Teste', email: 'alvo@teste.local', role: 'consulta', ativo: true, contabilidades: ['c1'], atualizadoPor: 'admin2' },
};

let env;
const dbDe = uid => env.authenticatedContext(uid, { auth_time: AUTH_TIME }).firestore();
const sessao = (uid, revogada) => ({ userId: uid, user: PERFIS[uid].nome, userEmail: PERFIS[uid].email, role: PERFIS[uid].role, revogada });

before(async () => {
  // projectId próprio: os outros arquivos de teste rodam em paralelo e limpam o projeto deles no fim.
  const [host, porta] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({ projectId: 'lgpdsan-test-usuarios', firestore: { rules: REGRAS, host, port: Number(porta) } });
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    for (const [uid, perfil] of Object.entries(PERFIS)) await setDoc(doc(db, 'users', uid), perfil);
    await setDoc(doc(db, 'sessoes', 's-ativa'), sessao('edicao', false));
    await setDoc(doc(db, 'sessoes', 's-revogada'), sessao('edicao', true));
    await setDoc(doc(db, 'sessoes', 's-revogada-admin'), sessao('edicao', true));
  });
});
after(async () => { await env?.cleanup(); });

const alvo = uid => doc(dbDe(uid), 'users', 'alvo');
const novo = (id, extra = {}) => setDoc(doc(dbDe('admin'), 'users', id),
  { nome: 'Novo', email: id + '@teste.local', role: 'consulta', ativo: true, contabilidades: ['c1'], ...extra });

describe('autoria das permissões em users/{uid}', () => {
  it('admin cria usuário assinando com o próprio uid', () => assertSucceeds(novo('novo-ok', { atualizadoPor: 'admin' })));
  it('admin não cria usuário sem assinatura', () => assertFails(novo('novo-sem')));
  it('admin não cria usuário assinando como outro admin', () => assertFails(novo('novo-forjado', { atualizadoPor: 'admin2' })));

  it('admin muda o perfil assinando', () => assertSucceeds(updateDoc(alvo('admin'), { role: 'edicao', atualizadoPor: 'admin' })));
  it('admin não muda o perfil com a assinatura antiga de outro admin', () => assertFails(updateDoc(alvo('admin2'), { role: 'consulta' })));
  it('admin não muda vínculos assinando como outro admin', () => assertFails(updateDoc(alvo('admin'), { contabilidades: [], atualizadoPor: 'admin2' })));
  it('admin não bloqueia sem assinar', async () => {
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'users', 'alvo'), { atualizadoPor: 'admin2' }));
    await assertFails(updateDoc(alvo('admin'), { ativo: false }));
  });
  it('admin encerra sessões sem precisar assinar', () => assertSucceeds(updateDoc(alvo('admin'), { sessaoMinima: AUTH_TIME })));
  it('edição não altera outro usuário nem assinando', () => assertFails(updateDoc(alvo('edicao'), { role: 'admin', atualizadoPor: 'edicao' })));
  it('admin remove o acesso', () => assertSucceeds(deleteDoc(doc(dbDe('admin'), 'users', 'novo-ok'))));
});

describe('sessão revogada', () => {
  it('dono não apaga a própria sessão revogada', () => assertFails(deleteDoc(doc(dbDe('edicao'), 'sessoes', 's-revogada'))));
  it('dono não reativa a sessão revogada', () => assertFails(updateDoc(doc(dbDe('edicao'), 'sessoes', 's-revogada'), { revogada: false })));
  it('dono apaga a própria sessão ativa', () => assertSucceeds(deleteDoc(doc(dbDe('edicao'), 'sessoes', 's-ativa'))));
  it('admin apaga sessão revogada', () => assertSucceeds(deleteDoc(doc(dbDe('admin'), 'sessoes', 's-revogada-admin'))));
});
