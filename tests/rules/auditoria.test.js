// Testes das regras do Firestore para a auditoria (Fases 1 a 3).
// Rodar em tests/rules: npm test (sobe o emulador via firebase emulators:exec).
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

const REGRAS = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const AUTH_TIME = Math.floor(Date.now() / 1000); // active() exige auth_time >= sessaoMinima

const PERFIS = {
  admin: { nome: 'Admin Teste', email: 'admin@teste.local', role: 'admin', ativo: true, contabilidades: [] },
  edicao: { nome: 'Edicao Teste', email: 'edicao@teste.local', role: 'edicao', ativo: true, contabilidades: ['c1'] },
  consulta: { nome: 'Consulta Teste', email: 'consulta@teste.local', role: 'consulta', ativo: true, contabilidades: ['c1'] },
  edicao2: { nome: 'Edicao Dois', email: 'edicao2@teste.local', role: 'edicao', ativo: true, contabilidades: ['c2'] },
  inativo: { nome: 'Inativo Teste', email: 'inativo@teste.local', role: 'edicao', ativo: false, contabilidades: ['c1'] },
};

let env;
const dbs = new Map();
const dbDe = uid => {
  if (!dbs.has(uid)) dbs.set(uid, env.authenticatedContext(uid, { auth_time: AUTH_TIME }).firestore());
  return dbs.get(uid);
};
let dbAnonimo = null;
const dbAnon = () => (dbAnonimo ||= env.unauthenticatedContext().firestore());

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lgpdsan-test',
    firestore: { rules: REGRAS, host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    for (const [uid, perfil] of Object.entries(PERFIS)) await setDoc(doc(db, 'users', uid), perfil);
    await setDoc(doc(db, 'contabilidades', 'c1'), { nome: 'Contabilidade 01' });
    await setDoc(doc(db, 'contabilidades', 'c2'), { nome: 'Contabilidade 02' });
    await setDoc(doc(db, 'contabilidades', 'c1', 'auditoria', 'fixo'), {
      ts: Timestamp.now(), userId: 'edicao', user: PERFIS.edicao.nome, userEmail: PERFIS.edicao.email,
      role: 'edicao', acao: 'Edição', recId: null, recTitulo: '', detalhe: 'evento existente',
      escopo: 'registro', contabId: 'c1',
    });
    await setDoc(doc(db, 'auditoria', 'sistema-fixo'), {
      ts: Timestamp.now(), userId: 'admin', user: PERFIS.admin.nome, userEmail: PERFIS.admin.email,
      role: 'admin', acao: 'Login', recId: null, recTitulo: '', detalhe: '', escopo: 'sistema', contabId: null,
    });
    await setDoc(doc(db, 'rate_limit', 'existente'), { contagem: 1, ipHash: 'x' });
  });
});

after(async () => { await env?.cleanup(); });

// Evento no formato do cliente (assets/app.js), com ts do servidor.
const evento = (uid, extra = {}) => {
  const p = PERFIS[uid];
  return {
    ts: serverTimestamp(), userId: uid, user: p.nome, userEmail: p.email, role: p.role,
    acao: 'Edição', recId: 'r1', recTitulo: 'Registro 1', detalhe: 'teste',
    escopo: 'registro', contabId: 'c1', ...extra,
  };
};
const criar = (uid, id, extra = {}) => setDoc(doc(dbDe(uid), 'contabilidades', 'c1', 'auditoria', id), evento(uid, extra));
const refEvento = id => doc(dbDe('edicao'), 'contabilidades', 'c1', 'auditoria', id);
const criarSistema = (id, extra = {}) => setDoc(doc(dbDe('admin'), 'auditoria', id), {
  ts: serverTimestamp(), userId: 'admin', user: PERFIS.admin.nome, userEmail: PERFIS.admin.email, role: 'admin',
  acao: 'Login', recId: null, recTitulo: '', detalhe: '', escopo: 'sistema', contabId: null, ...extra,
});

describe('auditoria da contabilidade', () => {
  it('edição cria evento válido', () => assertSucceeds(criar('edicao', 'ok-edicao')));
  it('edição não forja outro userId', () => assertFails(criar('edicao', 'bad-userid', { userId: 'consulta' })));
  it('edição não envia ts do cliente', () => assertFails(criar('edicao', 'bad-ts', { ts: Timestamp.now() })));

  it('edição não altera evento', () => assertFails(updateDoc(refEvento('fixo'), { detalhe: 'alterado' })));
  it('edição não apaga evento', () => assertFails(deleteDoc(refEvento('fixo'))));
  it('consulta não altera evento', () => assertFails(updateDoc(doc(dbDe('consulta'), 'contabilidades', 'c1', 'auditoria', 'fixo'), { detalhe: 'x' })));
  it('admin não apaga evento', () => assertFails(deleteDoc(doc(dbDe('admin'), 'contabilidades', 'c1', 'auditoria', 'fixo'))));

  it('consulta cria Visualização de registro', () => assertSucceeds(criar('consulta', 'ok-consulta-vis', { acao: 'Visualização de registro' })));
  it('consulta cria Download de evidência', () => assertSucceeds(criar('consulta', 'ok-consulta-dl', { acao: 'Download de evidência' })));
  it('consulta não cria Edição', () => assertFails(criar('consulta', 'bad-consulta-edicao')));
  it('edição de c2 não grava em c1', () => assertFails(criar('edicao2', 'bad-outra-contab')));
  it('usuário inativo não grava', () => assertFails(criar('inativo', 'bad-inativo')));

  for (const [campo, valor] of [['origem', 'servidor'], ['ip', '203.0.113.9'], ['userAgent', 'UA'],
    ['motivo', 'x'], ['antes', 'x'], ['depois', 'x'], ['alvoId', 'x']]) {
    it(`não aceita ${campo} gravado pelo cliente`, () => assertFails(criar('edicao', `bad-${campo}`, { [campo]: valor })));
  }

  it('aceita detalhe com 500 caracteres', () => assertSucceeds(criar('edicao', 'ok-detalhe-500', { detalhe: 'x'.repeat(500) })));
  it('recusa detalhe com 501 caracteres', () => assertFails(criar('edicao', 'bad-detalhe-501', { detalhe: 'x'.repeat(501) })));

  const mud = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, { de: 'a', para: 'b' }]));
  it('aceita mudancas com 20 campos', () => assertSucceeds(criar('edicao', 'ok-mud-20', { mudancas: mud(20) })));
  it('recusa mudancas com 21 campos', () => assertFails(criar('edicao', 'bad-mud-21', { mudancas: mud(21) })));
  it('recusa mudancas como string', () => assertFails(criar('edicao', 'bad-mud-string', { mudancas: 'x' })));
});

describe('auditoria do sistema', () => {
  it('admin cria evento de login', () => assertSucceeds(criarSistema('ok-login')));
  it('edição não lê o log do sistema', () => assertFails(getDoc(doc(dbDe('edicao'), 'auditoria', 'sistema-fixo'))));
  it('admin lê o log do sistema', () => assertSucceeds(getDoc(doc(dbDe('admin'), 'auditoria', 'sistema-fixo'))));
  it('admin não grava ip pelo cliente', () => assertFails(criarSistema('bad-sis-ip', { ip: '203.0.113.9' })));
  it('admin não grava detalhe com 501', () => assertFails(criarSistema('bad-sis-det', { detalhe: 'x'.repeat(501) })));
});

describe('rate_limit (somente Admin SDK)', () => {
  it('admin não lê', () => assertFails(getDoc(doc(dbDe('admin'), 'rate_limit', 'existente'))));
  it('admin não escreve', () => assertFails(setDoc(doc(dbDe('admin'), 'rate_limit', 'novo'), { contagem: 1 })));
  it('anônimo não lê', () => assertFails(getDoc(doc(dbAnon(), 'rate_limit', 'existente'))));
});
