// Testes das regras do Firestore para a preferência de tema do perfil (users/{uid}.tema).
// Aceitos: 'claro' e 'estelar'. Rodar em tests/rules: npm test.
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const REGRAS = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const AUTH_TIME = Math.floor(Date.now() / 1000);

const PERFIS = {
  consulta: { nome: 'Consulta Teste', email: 'consulta@teste.local', role: 'consulta', ativo: true, contabilidades: ['c1'] },
  edicao: { nome: 'Edicao Teste', email: 'edicao@teste.local', role: 'edicao', ativo: true, contabilidades: ['c1'] },
  inativo: { nome: 'Inativo Teste', email: 'inativo@teste.local', role: 'consulta', ativo: false, contabilidades: ['c1'] },
};

let env;
const dbDe = uid => env.authenticatedContext(uid, { auth_time: AUTH_TIME }).firestore();

before(async () => {
  // projectId próprio: os outros arquivos de teste rodam em paralelo e limpam o projeto deles no fim.
  // Usa o emulador indicado por FIRESTORE_EMULATOR_HOST (definido pelo `emulators:exec`); sem ela, 127.0.0.1:8080.
  const [host, porta] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({ projectId: 'lgpdsan-test-temas', firestore: { rules: REGRAS, host, port: Number(porta) } });
  await env.withSecurityRulesDisabled(async c => {
    for (const [uid, perfil] of Object.entries(PERFIS)) await setDoc(doc(c.firestore(), 'users', uid), perfil);
  });
});
after(async () => { await env?.cleanup(); });

describe('tema do próprio perfil', () => {
  for (const tema of ['claro', 'estelar']) {
    it(`Consulta pode escolher "${tema}"`, () => assertSucceeds(updateDoc(doc(dbDe('consulta'), 'users', 'consulta'), { tema })));
    it(`Edição pode escolher "${tema}"`, () => assertSucceeds(updateDoc(doc(dbDe('edicao'), 'users', 'edicao'), { tema })));
  }
  // temas removidos na v2.44.0 não são mais aceitos
  for (const tema of ['azul', 'lilas', 'escuro', 'escuro-azul', 'cf', 'cf-escuro', 'auto', '', 'qualquer-coisa']) {
    it(`recusa o tema removido/inválido "${tema}"`, () => assertFails(updateDoc(doc(dbDe('consulta'), 'users', 'consulta'), { tema })));
  }
  it('recusa tema que não é texto', () => assertFails(updateDoc(doc(dbDe('consulta'), 'users', 'consulta'), { tema: 1 })));
});

describe('o tema não abre brecha para outros campos', () => {
  it('Consulta não consegue virar admin junto com o tema', () =>
    assertFails(updateDoc(doc(dbDe('consulta'), 'users', 'consulta'), { tema: 'estelar', role: 'admin' })));
  it('Consulta não consegue ampliar as próprias contabilidades junto com o tema', () =>
    assertFails(updateDoc(doc(dbDe('consulta'), 'users', 'consulta'), { tema: 'claro', contabilidades: ['c1', 'c2'] })));
  it('ninguém altera o tema de outro usuário', () => assertFails(updateDoc(doc(dbDe('consulta'), 'users', 'edicao'), { tema: 'claro' })));
  it('usuário bloqueado não altera nem o próprio tema', () => assertFails(updateDoc(doc(dbDe('inativo'), 'users', 'inativo'), { tema: 'claro' })));
});
