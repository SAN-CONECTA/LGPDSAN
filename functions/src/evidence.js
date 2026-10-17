'use strict';
// Evidências: o arquivo só entra no Storage com uma reserva válida, criada aqui.
//   contabilidades/{cid}/evidenciasArquivos/{evidenceId}  → o ARQUIVO (pending → ready); só o servidor lê e grava.
//   contabilidades/{cid}/evidencias/{id}                   → o METADADO que a tela lista (um por item; reaproveitar cria outro).
// O storage.rules consulta o documento do arquivo: upload só com reserva `pending` do próprio usuário;
// leitura só com arquivo `ready`. Exclusão e limpeza são feitas aqui, nunca pelo navegador.
const { getStorage } = require('firebase-admin/storage');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, FieldValue, Timestamp, REGION, fail, callable, actorFrom, isAdmin, requireAdmin, requireContab, obj, onlyKeys, str, idOf, int, oneOf } = require('./common');
const { audit, auditNow } = require('./audit');

const EV_MAX = 10 * 1024 * 1024;
const TIPOS = { pdf: 'application/pdf', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const RESERVA_MIN = 30;          // validade da reserva para concluir o upload
const MAX_PENDENTES = 20;        // reservas abertas por usuário e contabilidade
const ORFAO_HORAS = 24;          // objeto sem metadado há mais tempo que isso é apagado
// Bucket das evidências: o mesmo de storageBucket em assets/firebase-config.js (functions/.env.<projeto>); sem a variável, o padrão do projeto.
const bucket = () => getStorage().bucket(process.env.EVIDENCIAS_BUCKET || undefined);
const arqRef = (cid, id) => db.doc(`contabilidades/${cid}/evidenciasArquivos/${id}`);
const evRef = (cid, id) => db.doc(`contabilidades/${cid}/evidencias/${id}`);
const fmtTam = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const extDe = n => (String(n).includes('.') ? String(n).split('.').pop() : '').toLowerCase();
const nomeSeguro = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(-100) || 'arquivo';

// Assinatura dos primeiros bytes (o mesmo teste que o navegador faz, agora no servidor).
function assinaturaOk(b, ext) {
  const at = (...v) => v.every((x, i) => b[i] === x);
  if (ext === 'txt') return !b.includes(0);
  if (ext === 'pdf') return at(0x25, 0x50, 0x44, 0x46);
  if (ext === 'docx') return at(0x50, 0x4B, 0x03, 0x04);
  if (ext === 'png') return at(0x89, 0x50, 0x4E, 0x47);
  if (ext === 'jpg' || ext === 'jpeg') return at(0xFF, 0xD8, 0xFF);
  if (ext === 'webp') return at(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}

// Vínculo opcional com item do checklist de um registro: o registro precisa existir e ser editável pelo usuário.
async function vinculoOk(tx, actor, cid, d) {
  if (d.registroId === undefined) { if (d.itemId !== undefined || d.itemRot !== undefined) fail('invalid-argument', 'Item sem registro.'); return null; }
  const registroId = idOf(d.registroId, 'registro');
  const itemId = str(d.itemId, 'item', { min: 1, max: 100 });
  if (!/^[A-Za-z0-9_]{1,100}$/.test(itemId)) fail('invalid-argument', 'Item inválido.');
  const itemRot = str(d.itemRot, 'rótulo do item', { max: 200, optional: true });
  const r = await tx.get(db.doc(`contabilidades/${cid}/registros/${registroId}`));
  if (!r.exists) fail('not-found', 'Registro não encontrado.');
  const rec = r.data();
  if (!isAdmin(actor) && (rec.deleted || (rec.snap && rec.snap.status === 'Arquivado'))) fail('permission-denied', 'Registro excluído ou arquivado.');
  return { registroId, itemId, itemRot };
}

const reserveEvidence = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'categoria', 'descricao', 'nome', 'contentType', 'tamanho', 'registroId', 'itemId', 'itemRot']);
  const cid = idOf(d.cid, 'contabilidade');
  const categoria = str(d.categoria, 'categoria', { min: 1, max: 100 });
  const descricao = str(d.descricao, 'descrição', { min: 1, max: 300 });
  const nome = str(d.nome, 'nome do arquivo', { min: 1, max: 200 });
  const contentType = oneOf(d.contentType, [...new Set(Object.values(TIPOS))], 'tipo do arquivo');
  const tamanho = int(d.tamanho, 'tamanho', { min: 1, max: EV_MAX });
  const ext = extDe(nome);
  if (TIPOS[ext] !== contentType) fail('invalid-argument', 'A extensão do arquivo não corresponde ao tipo.');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { edit: true, tx });
    const vinc = await vinculoOk(tx, actor, cid, d);
    const abertas = await tx.get(db.collection(`contabilidades/${cid}/evidenciasArquivos`)
      .where('autorId', '==', actor.uid).where('status', '==', 'pending').limit(MAX_PENDENTES));
    if (abertas.size >= MAX_PENDENTES) fail('resource-exhausted', 'Há envios demais em aberto. Aguarde alguns minutos.');
    const ref = db.collection(`contabilidades/${cid}/evidenciasArquivos`).doc();
    const path = `evidencias/${cid}/${ref.id}/${nomeSeguro(nome)}`;
    const expiraEm = Timestamp.fromMillis(Date.now() + RESERVA_MIN * 60000);
    tx.create(ref, { status: 'pending', path, contabId: cid, autorId: actor.uid, autor: actor.nome, contentType, tamanho, tipo: ext,
      categoria, descricao, nome, ...(vinc || {}), criadoEm: FieldValue.serverTimestamp(), expiraEm });
    return { evidenceId: ref.id, path, expiraEm: expiraEm.toMillis() };
  });
});

async function apagaObjeto(path) { try { await bucket().file(path).delete(); } catch (e) { if (e.code !== 404) throw e; } }

const finalizeEvidence = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'evidenceId']);
  const cid = idOf(d.cid, 'contabilidade'), id = idOf(d.evidenceId, 'evidência');
  const actor = await actorFrom(req);
  await requireContab(actor, cid, { edit: true });
  const s = await arqRef(cid, id).get();
  if (!s.exists) fail('not-found', 'Reserva não encontrada ou expirada.');
  const a = s.data();
  if (a.autorId !== actor.uid) fail('permission-denied', 'A reserva é de outro usuário.');
  if (a.status === 'ready') return { id, jaConcluida: true };
  if (a.status !== 'pending') fail('failed-precondition', 'Reserva em estado inválido.');
  if (a.path !== `evidencias/${cid}/${id}/${a.path.split('/').pop()}`) fail('failed-precondition', 'Caminho da reserva inválido.');

  // Confere no Storage: existência, caminho, tamanho, tipo e assinatura do conteúdo.
  const f = bucket().file(a.path);
  const [existe] = await f.exists();
  if (!existe) fail('failed-precondition', 'O arquivo ainda não foi enviado.');
  const [meta] = await f.getMetadata();
  const tam = Number(meta.size);
  let motivo = '';
  if (tam !== a.tamanho || tam <= 0 || tam > EV_MAX) motivo = 'tamanho diferente do reservado';
  else if (meta.contentType !== a.contentType) motivo = 'tipo diferente do reservado';
  else {
    const [ini] = await f.download({ start: 0, end: 11 });
    if (!assinaturaOk(ini, a.tipo)) motivo = 'conteúdo não corresponde ao tipo';
  }
  if (motivo) {
    await apagaObjeto(a.path);
    await arqRef(cid, id).delete();
    fail('invalid-argument', 'Arquivo recusado: ' + motivo + '.');
  }

  await db.runTransaction(async tx => {
    const actorTx = await actorFrom(req, tx);
    await requireContab(actorTx, cid, { edit: true, tx });
    const cur = await tx.get(arqRef(cid, id));
    if (!cur.exists || cur.data().status !== 'pending') fail('aborted', 'A reserva mudou durante a conclusão. Tente novamente.');
    const vinc = a.registroId ? { registroId: a.registroId, itemId: a.itemId, itemRot: a.itemRot || '' } : {};
    tx.update(arqRef(cid, id), { status: 'ready', prontoEm: FieldValue.serverTimestamp(), expiraEm: FieldValue.delete() });
    tx.create(evRef(cid, id), { categoria: a.categoria, descricao: a.descricao, nome: a.nome, tipo: a.tipo, tamanho: tam, path: a.path,
      contabId: cid, arquivoId: id, autorId: actorTx.uid, autor: actorTx.nome, ts: FieldValue.serverTimestamp(), ...vinc });
    audit(tx, { actor: actorTx, acao: 'Evidência enviada', cid, detalhe: `${a.categoria} · ${a.nome} (${fmtTam(tam)})` + (a.itemId ? ' · item ' + a.itemId : '') });
  });
  return { id };
});

// Desiste de uma reserva própria ainda pendente (ex.: upload falhou). Apaga o objeto, se chegou a existir.
const cancelEvidenceReservation = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'evidenceId']);
  const cid = idOf(d.cid, 'contabilidade'), id = idOf(d.evidenceId, 'evidência');
  const actor = await actorFrom(req);
  await requireContab(actor, cid, { edit: true });
  const s = await arqRef(cid, id).get();
  if (!s.exists) return { ok: true };
  if (s.data().autorId !== actor.uid || s.data().status !== 'pending') fail('permission-denied', 'Reserva não pode ser cancelada.');
  await arqRef(cid, id).delete(); // primeiro o documento: sem ele, o Storage recusa novo upload e leitura
  await apagaObjeto(s.data().path);
  return { ok: true };
});

const arquivoIdDe = e => e.arquivoId || String(e.path || '').split('/')[2];

// Reaproveita um arquivo pronto em outro item do checklist (novo metadado, mesmo arquivo).
const reuseEvidence = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'evidenciaId', 'registroId', 'itemId', 'itemRot']);
  const cid = idOf(d.cid, 'contabilidade'), origemId = idOf(d.evidenciaId, 'evidência');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { edit: true, tx });
    const o = await tx.get(evRef(cid, origemId));
    if (!o.exists) fail('not-found', 'Evidência de origem não encontrada.');
    const e = o.data(), arqId = arquivoIdDe(e);
    const arq = await tx.get(arqRef(cid, idOf(arqId, 'arquivo')));
    if (!arq.exists || arq.data().status !== 'ready' || arq.data().path !== e.path) fail('failed-precondition', 'O arquivo de origem não está disponível.');
    const vinc = await vinculoOk(tx, actor, cid, d);
    if (!vinc) fail('invalid-argument', 'Informe o registro e o item.');
    const r = await tx.get(db.doc(`contabilidades/${cid}/registros/${vinc.registroId}`));
    const ref = db.collection(`contabilidades/${cid}/evidencias`).doc();
    tx.create(ref, { categoria: (r.data().snap || {}).categoria || e.categoria, descricao: e.descricao, nome: e.nome, tipo: e.tipo, tamanho: e.tamanho,
      path: e.path, contabId: cid, arquivoId: arqId, reuso: true, autorId: actor.uid, autor: actor.nome, ts: FieldValue.serverTimestamp(), ...vinc });
    audit(tx, { actor, acao: 'Evidência enviada', cid, detalhe: `${e.categoria} · ${e.nome} (reaproveitada) · item ${vinc.itemId}` });
    return { id: ref.id };
  });
});

// Exclusão pelo administrador: metadado + auditoria na transação; se ninguém mais usa o arquivo,
// o documento do arquivo sai junto (o Storage deixa de servir na hora) e o objeto é apagado em seguida.
const deleteEvidence = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id']);
  const cid = idOf(d.cid, 'contabilidade'), id = idOf(d.id, 'evidência');
  const res = await db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    requireAdmin(actor);
    await requireContab(actor, cid, { tx });
    const s = await tx.get(evRef(cid, id));
    if (!s.exists) fail('not-found', 'Evidência não encontrada.');
    const e = s.data();
    const outros = (await tx.get(db.collection(`contabilidades/${cid}/evidencias`).where('path', '==', e.path).limit(2))).docs.filter(x => x.id !== id);
    tx.delete(s.ref);
    const ultimo = !outros.length;
    if (ultimo) tx.delete(arqRef(cid, arquivoIdDe(e)));
    audit(tx, { actor, acao: 'Evidência excluída', cid, detalhe: `${e.categoria} · ${e.nome}` });
    return { ultimo, path: e.path };
  });
  // Se falhar aqui, o objeto fica sem documento e a limpeza agendada o remove.
  if (res.ultimo) { try { await apagaObjeto(res.path); } catch (e) { console.error('Objeto fica para a limpeza:', res.path, e); } }
  return { ok: true };
});

/* ---------- limpeza: reservas vencidas e objetos órfãos ---------- */
async function limparEvidencias({ agora = Date.now(), lote = 300 } = {}) {
  let reservas = 0, orfaos = 0;
  // 1) reservas pending vencidas → apaga documento (primeiro) e objeto
  const venc = await db.collectionGroup('evidenciasArquivos').where('status', '==', 'pending')
    .where('expiraEm', '<', Timestamp.fromMillis(agora)).limit(lote).get();
  for (const doc of venc.docs) {
    const ok = await db.runTransaction(async tx => {
      const s = await tx.get(doc.ref);
      if (!s.exists || s.data().status !== 'pending') return false;
      tx.delete(doc.ref); return true;
    });
    if (ok) { await apagaObjeto(doc.data().path); reservas++; }
  }
  // 2) objetos em evidencias/ sem documento de arquivo e sem metadado que aponte para eles (inclui dados antigos)
  const cursorRef = db.doc('_sistema/limpezaEvidencias');
  const cur = await cursorRef.get();
  const [files, next] = await bucket().getFiles({ prefix: 'evidencias/', maxResults: lote, autoPaginate: false, pageToken: cur.exists ? cur.data().pageToken || undefined : undefined });
  for (const f of files) {
    const [cidF, arqId] = f.name.split('/').slice(1, 3);
    if (!cidF || !arqId) continue;
    const criado = Date.parse(f.metadata && f.metadata.timeCreated) || agora;
    if (agora - criado < ORFAO_HORAS * 3600000) continue;
    if ((await arqRef(cidF, arqId).get()).exists) continue;
    const ref = await db.collection(`contabilidades/${cidF}/evidencias`).where('path', '==', f.name).limit(1).get();
    if (!ref.empty) continue; // dado legado ainda não migrado: não apaga
    await apagaObjeto(f.name); orfaos++;
  }
  await cursorRef.set({ pageToken: (next && next.pageToken) || null, ultimaExecucao: FieldValue.serverTimestamp() });
  return { reservas, orfaos };
}

const cleanupEvidence = onSchedule({ schedule: 'every 60 minutes', region: REGION, timeZone: 'America/Sao_Paulo', retryCount: 1 }, async () => {
  const r = await limparEvidencias();
  console.log('Limpeza de evidências', r);
});

// Mesma limpeza sob demanda (administrador), com auditoria de sistema.
const adminCleanupEvidence = callable(async req => {
  const actor = await actorFrom(req);
  requireAdmin(actor);
  onlyKeys(obj(req.data || {}), []);
  const r = await limparEvidencias();
  await auditNow({ actor, acao: 'Limpeza de evidências pendentes', detalhe: `${r.reservas} reserva(s) vencida(s) · ${r.orfaos} objeto(s) órfão(s)` });
  return r;
});

module.exports = { reserveEvidence, finalizeEvidence, cancelEvidenceReservation, reuseEvidence, deleteEvidence, cleanupEvidence, adminCleanupEvidence, limparEvidencias, arquivoIdDe, TIPOS };
