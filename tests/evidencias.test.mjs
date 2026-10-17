// Evidências: upload só com reserva do servidor; leitura só de arquivo pronto; exclusão e limpeza pelo servidor.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { deleteApp } from 'firebase/app';
import { seed, clientAs, admin, pdfBytes, snapBase, negado, invalido } from './helpers.mjs';

let S, ed, co, adm, edB;
before(async () => {
  S = await seed();
  [ed, co, adm, edB] = await Promise.all([clientAs(S.users.edicaoA), clientAs(S.users.consultaA), clientAs(S.users.admin), clientAs(S.users.edicaoB)]);
});
after(async () => { await Promise.all([ed, co, adm, edB].map(c => c && deleteApp(c.app))); });

const PDF = { contentType: 'application/pdf' };
const reserva = (c, extra = {}) => c.call('reserveEvidence', { cid: S.A, categoria: 'Contratos e Operadores', descricao: 'Contrato assinado',
  nome: 'contrato.pdf', contentType: 'application/pdf', tamanho: pdfBytes().length, ...extra });
async function enviaPronta(c = ed, extra = {}) {
  const r = await reserva(c, extra);
  await uploadBytes(ref(c.st, r.path), pdfBytes(), PDF);
  await c.call('finalizeEvidence', { cid: S.A, evidenceId: r.evidenceId });
  return r;
}

test('upload sem reserva é negado', async () => {
  await assert.rejects(uploadBytes(ref(ed.st, `evidencias/${S.A}/qualquer-id/arquivo.pdf`), pdfBytes(), PDF), negado);
  // nem metadado direto no Firestore
  await assert.rejects(setDoc(doc(ed.fs, 'contabilidades', S.A, 'evidencias', 'x'), { path: `evidencias/${S.A}/x/a.pdf` }), negado);
  await assert.rejects(setDoc(doc(ed.fs, 'contabilidades', S.A, 'evidenciasArquivos', 'x'), { status: 'pending', autorId: ed.uid }), negado);
});

test('reserva não vale para outro usuário, outro caminho, outro tamanho ou outro tipo', async () => {
  const r = await reserva(ed);
  await assert.rejects(uploadBytes(ref(adm.st, r.path), pdfBytes(), PDF), negado); // outro usuário (mesmo admin)
  await assert.rejects(uploadBytes(ref(ed.st, r.path.replace(/[^/]+$/, 'outro.pdf')), pdfBytes(), PDF), negado);
  await assert.rejects(uploadBytes(ref(ed.st, r.path), new Uint8Array([...pdfBytes(), 1, 2, 3]), PDF), negado);
  await assert.rejects(uploadBytes(ref(ed.st, r.path), pdfBytes(), { contentType: 'text/plain' }), negado);
  await assert.rejects(co.call('reserveEvidence', { cid: S.A, categoria: 'x', descricao: 'x', nome: 'a.pdf', contentType: 'application/pdf', tamanho: 10 }), negado);
  await assert.rejects(reserva(ed, { nome: 'a.exe' }), invalido);
  await assert.rejects(reserva(ed, { tamanho: 11 * 1024 * 1024 }), invalido);
});

test('upload reservado e finalizado funciona, gera metadado e auditoria', async () => {
  const r = await enviaPronta();
  const ev = (await admin.db.doc(`contabilidades/${S.A}/evidencias/${r.evidenceId}`).get()).data();
  assert.equal(ev.autorId, ed.uid); assert.equal(ev.tamanho, pdfBytes().length); assert.equal(ev.path, r.path);
  assert.equal((await admin.db.doc(`contabilidades/${S.A}/evidenciasArquivos/${r.evidenceId}`).get()).data().status, 'ready');
  const au = (await admin.db.collection(`contabilidades/${S.A}/auditoria`).where('acao', '==', 'Evidência enviada').get()).docs.map(d => d.data());
  assert.ok(au.some(a => a.userId === ed.uid && a.detalhe.includes('contrato.pdf')));
  // Consulta da mesma contabilidade lê o arquivo pronto
  assert.equal(new Uint8Array(await getBytes(ref(co.st, r.path))).length, pdfBytes().length);
  // ninguém apaga direto pelo Storage, nem o administrador
  await assert.rejects(deleteObject(ref(adm.st, r.path)), negado);
  await assert.rejects(deleteObject(ref(ed.st, r.path)), negado);
});

test('arquivo enviado mas não finalizado não pode ser lido', async () => {
  const r = await reserva(ed);
  await uploadBytes(ref(ed.st, r.path), pdfBytes(), PDF);
  await assert.rejects(getBytes(ref(co.st, r.path)), negado);
  await assert.rejects(getBytes(ref(ed.st, r.path)), negado);
});

test('finalização confere o conteúdo e recusa arquivo falso', async () => {
  const falso = new TextEncoder().encode('não sou um pdf de verdade.....');
  const r = await reserva(ed, { tamanho: falso.length });
  await uploadBytes(ref(ed.st, r.path), falso, PDF);
  await assert.rejects(ed.call('finalizeEvidence', { cid: S.A, evidenceId: r.evidenceId }), invalido);
  const [existe] = await admin.bucket.file(r.path).exists();
  assert.equal(existe, false);
  assert.equal((await admin.db.doc(`contabilidades/${S.A}/evidenciasArquivos/${r.evidenceId}`).get()).exists, false);
});

test('usuário de outra contabilidade não acessa evidências', async () => {
  const r = await enviaPronta();
  await assert.rejects(getBytes(ref(edB.st, r.path)), negado);
  await assert.rejects(getDocs(collection(edB.fs, 'contabilidades', S.A, 'evidencias')), negado);
  await assert.rejects(edB.call('reserveEvidence', { cid: S.A, categoria: 'x', descricao: 'x', nome: 'a.pdf', contentType: 'application/pdf', tamanho: 10 }), negado);
  await assert.rejects(edB.call('finalizeEvidence', { cid: S.A, evidenceId: r.evidenceId }), negado);
  // e o caminho da contabilidade dele não aceita reserva da A
  await assert.rejects(uploadBytes(ref(edB.st, `evidencias/${S.B}/${r.evidenceId}/contrato.pdf`), pdfBytes(), PDF), negado);
});

test('reaproveitar e excluir: o arquivo só sai quando o último uso é excluído', async () => {
  const { id: recId } = await ed.call('saveRecord', { cid: S.A, snap: snapBase(), just: 'Criação' });
  const r = await enviaPronta(ed, { registroId: recId, itemId: 'c_intl', itemRot: 'Transferência internacional' });
  const { id: reuso } = await ed.call('reuseEvidence', { cid: S.A, evidenciaId: r.evidenceId, registroId: recId, itemId: 'local', itemRot: 'Localização' });
  await assert.rejects(ed.call('deleteEvidence', { cid: S.A, id: r.evidenceId }), negado); // só admin exclui
  await adm.call('deleteEvidence', { cid: S.A, id: r.evidenceId });
  assert.equal((await admin.bucket.file(r.path).exists())[0], true);
  assert.equal(new Uint8Array(await getBytes(ref(co.st, r.path))).length, pdfBytes().length); // o reuso continua abrindo
  await adm.call('deleteEvidence', { cid: S.A, id: reuso });
  assert.equal((await admin.bucket.file(r.path).exists())[0], false);
  assert.equal((await admin.db.doc(`contabilidades/${S.A}/evidenciasArquivos/${r.evidenceId}`).get()).exists, false);
  const au = (await admin.db.collection(`contabilidades/${S.A}/auditoria`).where('acao', '==', 'Evidência excluída').get()).size;
  assert.ok(au >= 2);
});

test('limpeza remove reservas vencidas e o objeto enviado', async () => {
  const r = await reserva(ed);
  await uploadBytes(ref(ed.st, r.path), pdfBytes(), PDF);
  await admin.db.doc(`contabilidades/${S.A}/evidenciasArquivos/${r.evidenceId}`).update({ expiraEm: new Date(Date.now() - 60000) });
  await assert.rejects(ed.call('adminCleanupEvidence', {}), negado);
  const res = await adm.call('adminCleanupEvidence', {});
  assert.ok(res.reservas >= 1);
  assert.equal((await admin.db.doc(`contabilidades/${S.A}/evidenciasArquivos/${r.evidenceId}`).get()).exists, false);
  assert.equal((await admin.bucket.file(r.path).exists())[0], false);
  await assert.rejects(ed.call('finalizeEvidence', { cid: S.A, evidenceId: r.evidenceId }), e => /not-found/.test(e.code));
});
