// Registros, versões e aprovação: o navegador não grava; as Functions gravam registro + versão + auditoria juntos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { seed, clientAs, admin, snapBase, negado, invalido, auditoriaDe, versoesDe } from './helpers.mjs';

let S, ed, co, adm, edB;
before(async () => {
  S = await seed();
  [ed, co, adm, edB] = await Promise.all([clientAs(S.users.edicaoA), clientAs(S.users.consultaA), clientAs(S.users.admin), clientAs(S.users.edicaoB)]);
});
after(async () => { await Promise.all([ed, co, adm, edB].map(c => c && deleteApp(c.app))); });

test('criar registro grava registro, versão 1 e auditoria na mesma operação', async () => {
  const r = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação inicial' });
  const rec = (await admin.db.doc(`contabilidades/${S.A}/registros/${r.id}`).get()).data();
  assert.equal(rec.versao, 1); assert.equal(rec.deleted, false); assert.equal(rec.criadoPor, ed.uid);
  const vs = await versoesDe(S.A, r.id);
  assert.deepEqual(vs.map(v => v.n), [1]); assert.equal(vs[0].autorId, ed.uid); assert.equal(vs[0].autor, 'Pessoa edicaoA');
  const au = await auditoriaDe(S.A, r.id);
  assert.equal(au.length, 1); assert.equal(au[0].acao, 'Criação'); assert.equal(au[0].userId, ed.uid); assert.equal(au[0].fonte, 'servidor');
});

test('diagnóstico guiado é persistido como registro versionado no backend', async () => {
  const dados = {
    dgPorte: 'Microempresa (ME)', dgLimite: 'Sim', dgGrupo: 'Não',
    dgTitulares: 'Até 500', dgSaude: 'Não', dgSind: 'Não', dgBio: 'Não',
    dgIA: 'Não', dgMonit: 'Não', dgDecis: 'Não'
  };
  const r = await ed.call('saveRecord', {
    cid: S.A,
    snap: snapBase({
      titulo: 'Diagnóstico inicial de enquadramento LGPD',
      categoria: 'Governança e Políticas',
      descricao: 'Diagnóstico guiado inicial.',
      status: 'Em revisão',
      prioridade: 'Média',
      responsavel: 'Pessoa edicaoA',
      revisao: '2027-01-17',
      dados
    }),
    just: 'Diagnóstico guiado inicial'
  });
  const rec = (await admin.db.doc(`contabilidades/${S.A}/registros/${r.id}`).get()).data();
  assert.deepEqual(rec.snap.dados, dados);
  assert.equal((await versoesDe(S.A, r.id)).length, 1);
});

test('servidor recusa autor, versão e papel enviados pelo navegador', async () => {
  await assert.rejects(ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'x', autor: 'Outra pessoa' }), invalido);
  await assert.rejects(ed.call('saveRecord', { cid: S.A, snap: { ...snapBase(), versao: 99 }, just: 'x' }), invalido);
  await assert.rejects(ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'x', role: 'admin' }), invalido);
});

test('Edição não altera registro direto (sem gerar versão)', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  const ref = doc(ed.fs, 'contabilidades', S.A, 'registros', id);
  // nem com o snapshot igual, nem incrementando a versão "corretamente", nem com a versão avulsa junto
  await assert.rejects(updateDoc(ref, { snap: snapBase({ descricao: 'alterado sem versão' }) }), negado);
  await assert.rejects(updateDoc(ref, { snap: snapBase({ descricao: 'alterado' }), versao: 2 }), negado);
  await assert.rejects(setDoc(doc(ed.fs, 'contabilidades', S.A, 'registros', 'novo-direto'), { snap: snapBase(), versao: 1, deleted: false }), negado);
  await assert.rejects(deleteDoc(ref), negado);
  const rec = (await admin.db.doc(`contabilidades/${S.A}/registros/${id}`).get()).data();
  assert.equal(rec.versao, 1); assert.equal(rec.snap.descricao, 'Texto inicial');
});

test('Edição não cria versão avulsa', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  const v = n => doc(ed.fs, 'contabilidades', S.A, 'registros', id, 'versoes', String(n));
  await assert.rejects(setDoc(v(2), { n: 2, snap: snapBase({ titulo: 'falsa' }), autor: 'x', autorId: ed.uid, just: 'x' }), negado);
  await assert.rejects(setDoc(v(1), { n: 1, snap: snapBase({ titulo: 'sobrescrita' }), autorId: ed.uid }), negado);
  assert.deepEqual((await versoesDe(S.A, id)).map(x => x.n), [1]);
});

test('editar pelo servidor cria exatamente a próxima versão e audita', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  const r = await ed.call('saveRecord', { cid: S.A, id, versaoBase: 1, snap: snapBase({ descricao: 'Nova cláusula' }), just: 'Ajuste' });
  assert.equal(r.versao, 2);
  assert.deepEqual((await versoesDe(S.A, id)).map(x => x.n), [1, 2]);
  const au = await auditoriaDe(S.A, id);
  assert.ok(au.some(a => a.acao === 'Edição' && /^v2 · Descrição \/ procedimento · Ajuste$/.test(a.detalhe)));
  // versão base desatualizada é recusada (não sobrescreve a v3 de outra pessoa)
  await ed.call('saveRecord', { cid: S.A, id, versaoBase: 2, snap: snapBase({ descricao: 'v3' }), just: 'v3' });
  await assert.rejects(ed.call('saveRecord', { cid: S.A, id, versaoBase: 2, snap: snapBase({ descricao: 'atrasada' }), just: 'x' }), invalido);
  // sem mudança: nenhuma versão nova
  const igual = await ed.call('saveRecord', { cid: S.A, id, snap: snapBase({ descricao: 'v3' }), just: 'nada' });
  assert.equal(igual.semAlteracao, true);
  assert.deepEqual((await versoesDe(S.A, id)).map(x => x.n), [1, 2, 3]);
});

test('Edição não arquiva nem edita registro arquivado', async () => {
  await assert.rejects(ed.call('saveRecord', { cid: S.A, snap: snapBase({ status: 'Arquivado' }), just: 'x' }), negado);
  const { id } = await adm.call('saveRecord', { cid: S.A, snap: snapBase({ status: 'Arquivado' }), just: 'Arquivado pelo admin' });
  await assert.rejects(ed.call('saveRecord', { cid: S.A, id, snap: snapBase({ status: 'Em revisão' }), just: 'x' }), negado);
});

test('Consulta não edita (nem pela Function, nem direto)', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  await assert.rejects(co.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'x' }), negado);
  await assert.rejects(co.call('saveRecord', { cid: S.A, id, snap: snapBase({ descricao: 'consulta' }), just: 'x' }), negado);
  await assert.rejects(co.call('restoreRecordVersion', { cid: S.A, id, n: 1 }), negado);
  await assert.rejects(updateDoc(doc(co.fs, 'contabilidades', S.A, 'registros', id), { snap: snapBase({ descricao: 'consulta' }) }), negado);
  // mas lê
  assert.equal((await getDoc(doc(co.fs, 'contabilidades', S.A, 'registros', id))).data().versao, 1);
});

test('usuário de outra contabilidade não lê nem grava registros', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  await assert.rejects(getDoc(doc(edB.fs, 'contabilidades', S.A, 'registros', id)), negado);
  await assert.rejects(getDocs(collection(edB.fs, 'contabilidades', S.A, 'registros', id, 'versoes')), negado);
  await assert.rejects(getDocs(collection(edB.fs, 'contabilidades', S.A, 'auditoria')), negado);
  await assert.rejects(edB.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'x' }), negado);
  await assert.rejects(edB.call('saveRecord', { cid: S.A, id, snap: snapBase({ descricao: 'invasão' }), just: 'x' }), negado);
});

test('administrador aprova com horário do servidor; Edição não aprova', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase({ status: 'Em vigor' }), just: 'Criação' });
  await assert.rejects(ed.call('approveRecord', { cid: S.A, id, versao: 1 }), negado);
  await assert.rejects(updateDoc(doc(adm.fs, 'contabilidades', S.A, 'registros', id), { aprovacao: { versao: 1, porId: adm.uid } }), negado);
  const antes = Date.now();
  await adm.call('approveRecord', { cid: S.A, id, versao: 1 });
  const ap = (await admin.db.doc(`contabilidades/${S.A}/registros/${id}`).get()).data().aprovacao;
  assert.equal(ap.versao, 1); assert.equal(ap.porId, adm.uid); assert.equal(ap.por, 'Pessoa admin');
  assert.ok(ap.em.toMillis() >= antes - 5000 && ap.em.toMillis() <= Date.now() + 5000);
  assert.ok((await auditoriaDe(S.A, id)).some(a => a.acao === 'Versão aprovada' && a.userId === adm.uid));
  // aprovar versão que não é a atual é recusado
  await ed.call('saveRecord', { cid: S.A, id, snap: snapBase({ status: 'Em vigor', descricao: 'mudou' }), just: 'x' });
  await assert.rejects(adm.call('approveRecord', { cid: S.A, id, versao: 1 }), invalido);
});

test('restauração cria nova versão sem alterar as anteriores', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase({ descricao: 'original' }), just: 'Criação' });
  await ed.call('saveRecord', { cid: S.A, id, snap: snapBase({ descricao: 'segunda' }), just: 'Segunda' });
  const antes = await versoesDe(S.A, id);
  const r = await ed.call('restoreRecordVersion', { cid: S.A, id, n: 1, versaoBase: 2 });
  assert.equal(r.versao, 3);
  const depois = await versoesDe(S.A, id);
  assert.deepEqual(depois.map(v => v.n), [1, 2, 3]);
  assert.deepEqual(depois.slice(0, 2), antes); // v1 e v2 idênticas (inclusive horários)
  assert.equal(depois[2].snap.descricao, 'original'); assert.equal(depois[2].just, 'Restauração da v1');
  const rec = (await admin.db.doc(`contabilidades/${S.A}/registros/${id}`).get()).data();
  assert.equal(rec.versao, 3); assert.equal(rec.snap.descricao, 'original');
  assert.ok((await auditoriaDe(S.A, id)).some(a => a.acao === 'Restauração de versão' && a.detalhe === 'v1 → v3'));
  await assert.rejects(ed.call('restoreRecordVersion', { cid: S.A, id, n: 3 }), invalido); // a atual não se restaura
});

test('exclusão lógica, restauração e exclusão permanente só pelo administrador', async () => {
  const { id } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  await assert.rejects(ed.call('softDeleteRecord', { cid: S.A, id }), negado);
  await assert.rejects(adm.call('hardDeleteRecord', { cid: S.A, id }), invalido); // precisa excluir logicamente antes
  await adm.call('softDeleteRecord', { cid: S.A, id });
  await assert.rejects(getDoc(doc(ed.fs, 'contabilidades', S.A, 'registros', id)), negado); // excluído some para não-admin
  await adm.call('softDeleteRecord', { cid: S.A, id, restaurar: true });
  await adm.call('softDeleteRecord', { cid: S.A, id });
  await adm.call('hardDeleteRecord', { cid: S.A, id });
  assert.equal((await admin.db.doc(`contabilidades/${S.A}/registros/${id}`).get()).exists, false);
  assert.equal((await versoesDe(S.A, id)).length, 0);
  const acoes = (await auditoriaDe(S.A, id)).map(a => a.acao);
  for (const a of ['Criação', 'Exclusão lógica', 'Registro restaurado', 'Exclusão permanente']) assert.ok(acoes.includes(a), a);
});
