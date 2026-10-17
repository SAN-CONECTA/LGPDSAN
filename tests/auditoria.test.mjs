// Auditoria: só o servidor grava; o navegador pede poucos eventos, de uma lista fechada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { seed, clientAs, admin, negado, invalido } from './helpers.mjs';

let S, ed, co, adm;
before(async () => {
  S = await seed();
  [ed, co, adm] = await Promise.all([clientAs(S.users.edicaoA), clientAs(S.users.consultaA), clientAs(S.users.admin)]);
});
after(async () => { await Promise.all([ed, co, adm].map(c => c && deleteApp(c.app))); });

test('navegador não cria auditoria arbitrária (nem no formato válido antigo)', async () => {
  const valido = { ts: serverTimestamp(), userId: ed.uid, user: 'Pessoa edicaoA', role: 'edicao', acao: 'Login', recId: null, recTitulo: '', detalhe: '', escopo: 'sistema', contabId: null };
  await assert.rejects(addDoc(collection(ed.fs, 'auditoria'), valido), negado);
  await assert.rejects(addDoc(collection(ed.fs, 'contabilidades', S.A, 'auditoria'), { ...valido, escopo: 'registro', contabId: S.A, acao: 'Versão aprovada' }), negado);
  await assert.rejects(addDoc(collection(adm.fs, 'auditoria'), { ...valido, userId: adm.uid, role: 'admin', user: 'Pessoa admin' }), negado);
});

test('logEvent recusa ações fora da lista e campos extras', async () => {
  await assert.rejects(ed.call('logEvent', { acao: 'Versão aprovada' }), invalido);
  await assert.rejects(ed.call('logEvent', { acao: 'Qualquer coisa' }), invalido);
  await assert.rejects(ed.call('logEvent', { acao: 'Login', user: 'Outra pessoa' }), invalido);
  await assert.rejects(ed.call('logEvent', { acao: 'Exportação CSV', cid: S.A, quantidade: 3, detalhe: 'inventado' }), invalido);
  await assert.rejects(co.call('logEvent', { acao: 'Exportação CSV', cid: S.A, quantidade: 3 }), negado); // Consulta não exporta
  await assert.rejects(ed.call('logEvent', { acao: 'Backup completo exportado' }), negado); // só admin
});

test('Login é gravado uma vez por sessão, com a identidade do perfil', async () => {
  await ed.call('logEvent', { acao: 'Login' });
  const r = await ed.call('logEvent', { acao: 'Login' });
  assert.equal(r.repetido, true);
  const evs = (await admin.db.collection('auditoria').where('userId', '==', ed.uid).where('acao', '==', 'Login').get()).docs.map(d => d.data());
  assert.equal(evs.length, 1);
  assert.equal(evs[0].user, 'Pessoa edicaoA'); assert.equal(evs[0].role, 'edicao'); assert.equal(evs[0].escopo, 'sistema'); assert.equal(evs[0].fonte, 'servidor');
});

test('Exportação CSV: detalhe montado pelo servidor', async () => {
  await ed.call('logEvent', { acao: 'Exportação CSV', cid: S.A, quantidade: 7 });
  const evs = (await admin.db.collection(`contabilidades/${S.A}/auditoria`).where('acao', '==', 'Exportação CSV').get()).docs.map(d => d.data());
  assert.ok(evs.some(e => e.userId === ed.uid && /· 7 registro\(s\)$/.test(e.detalhe) && e.contabId === S.A));
});

test('eventos não podem ser editados; perfis e categorias só mudam pelo servidor', async () => {
  const qualquer = (await admin.db.collection('auditoria').limit(1).get()).docs[0];
  await assert.rejects(updateDoc(doc(adm.fs, 'auditoria', qualquer.id), { detalhe: 'editado' }), negado);
  await assert.rejects(updateDoc(doc(adm.fs, 'users', S.users.edicaoA.uid), { role: 'admin' }), negado);
  await assert.rejects(updateDoc(doc(ed.fs, 'users', S.users.edicaoA.uid), { role: 'admin' }), negado);
  await assert.rejects(setDoc(doc(adm.fs, 'config', 'app'), { lista: ['x'] }), negado);
  // o próprio tema continua permitido
  await updateDoc(doc(ed.fs, 'users', S.users.edicaoA.uid), { tema: 'escuro' });
});

test('administração pelo servidor gera auditoria de sistema', async () => {
  const { id } = await adm.call('adminSaveContabilidade', { nome: 'Contab nova ' + Date.now() });
  await adm.call('adminSaveContabilidade', { id, nome: 'Contab renomeada ' + Date.now(), cnpj: '' });
  await adm.call('adminCategorias', { op: 'add', nome: 'Categoria teste ' + Date.now() });
  await assert.rejects(ed.call('adminCategorias', { op: 'add', nome: 'x' }), negado);
  const acoes = (await admin.db.collection('auditoria').where('userId', '==', adm.uid).get()).docs.map(d => d.data().acao);
  for (const a of ['Contabilidade criada', 'Contabilidade renomeada', 'Categoria criada']) assert.ok(acoes.includes(a), a);
  // Consulta lê a auditoria da própria contabilidade, mas não a do sistema
  await getDocs(collection(co.fs, 'contabilidades', S.A, 'auditoria'));
  await assert.rejects(getDocs(collection(co.fs, 'auditoria')), negado);
});
