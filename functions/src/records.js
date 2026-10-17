'use strict';
// Registros e versões. Toda gravação acontece numa transação que lê a versão atual no servidor,
// cria exatamente a próxima versão (create: falha se já existir) e registra a auditoria.
const { db, FieldValue, fail, callable, actorFrom, isAdmin, requireAdmin, requireContab, obj, onlyKeys, str, idOf, int, oneOf, dateOrEmpty, isObj } = require('./common');
const { audit } = require('./audit');

const STATUS = ['Rascunho', 'Em vigor', 'Em revisão', 'Arquivado'];
const PRIOR = ['Baixa', 'Média', 'Alta'];
const SNAP_KEYS = ['titulo', 'categoria', 'descricao', 'status', 'prioridade', 'responsavel', 'prazo', 'revisao', 'evidencias', 'dados'];
const LABELS = { titulo: 'Título', categoria: 'Categoria', descricao: 'Descrição / procedimento', status: 'Status', prioridade: 'Prioridade',
  responsavel: 'Responsável', prazo: 'Prazo', revisao: 'Próxima revisão', evidencias: 'Evidências (links/referências)' };
const DADO_KEY = /^[A-Za-z0-9_]{1,60}(#[oe])?$/;

// Respostas do checklist: texto (até 2000) ou lista de opções (até 50 de até 300).
function dadosOk(v) {
  if (v === undefined) return undefined;
  if (!isObj(v)) fail('invalid-argument', 'Checklist em formato inválido.');
  const ks = Object.keys(v);
  if (ks.length > 250) fail('invalid-argument', 'Checklist com itens demais.');
  const o = {};
  for (const k of ks) {
    if (!DADO_KEY.test(k)) fail('invalid-argument', 'Item de checklist inválido.');
    const x = v[k];
    if (typeof x === 'string') { if (x.length > 2000) fail('invalid-argument', 'Resposta de checklist longa demais.'); o[k] = x; }
    else if (Array.isArray(x) && x.length <= 50 && x.every(s => typeof s === 'string' && s.length <= 300)) o[k] = x.slice();
    else fail('invalid-argument', 'Resposta de checklist inválida.');
  }
  return o;
}
// Reconstrói o snapshot só com as chaves conhecidas, nos limites das regras antigas.
function snapOk(s, { categorias, categoriaAtual } = {}) {
  onlyKeys(obj(s, 'registro'), SNAP_KEYS, 'registro');
  const snap = {
    titulo: str(s.titulo, 'título', { min: 1, max: 200 }),
    categoria: str(s.categoria, 'categoria', { min: 1, max: 100 }),
    descricao: str(s.descricao, 'descrição', { max: 20000, trim: false, optional: true }),
    status: oneOf(s.status, STATUS, 'status'),
    prioridade: oneOf(s.prioridade, PRIOR, 'prioridade'),
    responsavel: str(s.responsavel, 'responsável', { max: 100, optional: true }),
    prazo: dateOrEmpty(s.prazo, 'prazo'),
    revisao: dateOrEmpty(s.revisao, 'próxima revisão'),
    evidencias: str(s.evidencias, 'evidências', { max: 5000, trim: false, optional: true })
  };
  const dados = dadosOk(s.dados);
  if (dados !== undefined) snap.dados = dados;
  if (categorias && !categorias.includes(snap.categoria) && snap.categoria !== categoriaAtual) fail('invalid-argument', 'Categoria inexistente.');
  return snap;
}
const igual = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
function alterados(antes, depois) {
  const out = Object.keys(LABELS).filter(k => String(antes[k] ?? '') !== String(depois[k] ?? '')).map(k => LABELS[k]);
  const da = antes.dados || {}, dd = depois.dados || {};
  const n = [...new Set([...Object.keys(da), ...Object.keys(dd)])].filter(k => !igual(da[k], dd[k])).length;
  if (n) out.push(`Checklist (${n} campo(s))`);
  return out;
}

const recRef = (cid, id) => db.doc(`contabilidades/${cid}/registros/${id}`);
const verRef = (cid, id, n) => db.doc(`contabilidades/${cid}/registros/${id}/versoes/${n}`);
async function categoriasDe(tx) { const c = await tx.get(db.doc('config/app')); return c.exists ? (c.data().lista || []) : []; }
async function lerRegistro(tx, cid, id) {
  const s = await tx.get(recRef(cid, idOf(id, 'registro')));
  if (!s.exists) fail('not-found', 'Registro não encontrado.');
  const r = s.data();
  if (!Number.isInteger(r.versao) || r.versao < 1 || !isObj(r.snap)) fail('failed-precondition', 'Registro com estrutura inválida; fale com o administrador.');
  return { id, ...r };
}
// Regra de edição: Administrador sempre; Edição só em registro ativo e não arquivado (antes e depois).
function podeAlterar(actor, rec, snapNovo) {
  if (isAdmin(actor)) return;
  if (rec.deleted) fail('permission-denied', 'Registro excluído.');
  if (rec.snap.status === 'Arquivado') fail('permission-denied', 'Registro arquivado: só o administrador altera.');
  if (snapNovo && snapNovo.status === 'Arquivado') fail('permission-denied', 'Só o administrador arquiva registros.');
}
function versaoBaseOk(d, rec) {
  if (d.versaoBase !== undefined && int(d.versaoBase, 'versão', { min: 1 }) !== rec.versao)
    fail('aborted', `O registro foi alterado por outra pessoa (agora está na v${rec.versao}). Recarregue a página.`);
}
// Cria a próxima versão + atualiza o registro + audita, tudo na mesma transação.
function novaVersao(tx, { actor, cid, rec, snap, just, acao, detalhe }) {
  const n = rec.versao + 1;
  tx.create(verRef(cid, rec.id, n), { n, snap, autor: actor.nome, autorId: actor.uid, quando: FieldValue.serverTimestamp(), just });
  tx.update(recRef(cid, rec.id), { snap, versao: n, atualizado: FieldValue.serverTimestamp() });
  audit(tx, { actor, acao, cid, rec: { id: rec.id, titulo: snap.titulo }, detalhe: detalhe(n) });
  return n;
}

const saveRecord = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id', 'versaoBase', 'snap', 'just']);
  const cid = idOf(d.cid, 'contabilidade');
  const just = str(d.just, 'justificativa', { min: 1, max: 300 });
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { edit: true, tx });
    const categorias = await categoriasDe(tx);
    if (d.id === undefined || d.id === null) {
      const snap = snapOk(d.snap, { categorias });
      if (!isAdmin(actor) && snap.status === 'Arquivado') fail('permission-denied', 'Só o administrador arquiva registros.');
      const ref = db.collection(`contabilidades/${cid}/registros`).doc();
      tx.create(ref, { snap, versao: 1, deleted: false, criado: FieldValue.serverTimestamp(), criadoPor: actor.uid });
      tx.create(verRef(cid, ref.id, 1), { n: 1, snap, autor: actor.nome, autorId: actor.uid, quando: FieldValue.serverTimestamp(), just });
      audit(tx, { actor, acao: 'Criação', cid, rec: { id: ref.id, titulo: snap.titulo }, detalhe: just });
      return { id: ref.id, versao: 1 };
    }
    const rec = await lerRegistro(tx, cid, d.id);
    versaoBaseOk(d, rec);
    const snap = snapOk(d.snap, { categorias, categoriaAtual: rec.snap.categoria });
    podeAlterar(actor, rec, snap);
    const mud = alterados(rec.snap, snap);
    if (!mud.length) return { id: rec.id, versao: rec.versao, semAlteracao: true };
    const n = novaVersao(tx, { actor, cid, rec, snap, just, acao: 'Edição', detalhe: n => `v${n} · ${mud.join(', ')} · ${just}` });
    return { id: rec.id, versao: n };
  });
});

const restoreRecordVersion = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id', 'n', 'versaoBase']);
  const cid = idOf(d.cid, 'contabilidade'), alvo = int(d.n, 'versão', { min: 1 });
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { edit: true, tx });
    const rec = await lerRegistro(tx, cid, d.id);
    versaoBaseOk(d, rec);
    if (alvo >= rec.versao) fail('invalid-argument', 'Escolha uma versão anterior à atual.');
    const v = await tx.get(verRef(cid, rec.id, alvo));
    if (!v.exists) fail('not-found', 'Versão não encontrada.');
    // Versões antigas podem ter campos fora do esquema atual: fica só o que o esquema conhece.
    const antigo = Object.fromEntries(Object.entries(v.data().snap || {}).filter(([k]) => SNAP_KEYS.includes(k)));
    // Edição não restaura para "Arquivado" (o mesmo que a tela já fazia).
    if (!isAdmin(actor) && antigo.status === 'Arquivado') antigo.status = 'Em revisão';
    const snap = snapOk(antigo);
    podeAlterar(actor, rec, snap);
    const n = novaVersao(tx, { actor, cid, rec, snap, just: `Restauração da v${alvo}`, acao: 'Restauração de versão', detalhe: n => `v${alvo} → v${n}` });
    return { id: rec.id, versao: n };
  });
});

const approveRecord = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id', 'versao']);
  const cid = idOf(d.cid, 'contabilidade'), versao = int(d.versao, 'versão', { min: 1 });
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    requireAdmin(actor);
    await requireContab(actor, cid, { tx });
    const rec = await lerRegistro(tx, cid, d.id);
    if (rec.deleted || rec.snap.status === 'Arquivado') fail('failed-precondition', 'Registro excluído ou arquivado não é aprovado.');
    // Aprova só a versão que o administrador viu; se mudou no meio, ele precisa rever.
    if (versao !== rec.versao) fail('aborted', `O registro mudou para a v${rec.versao}. Revise antes de aprovar.`);
    if (rec.aprovacao && rec.aprovacao.versao === rec.versao) fail('already-exists', 'Esta versão já está aprovada.');
    tx.update(recRef(cid, rec.id), { aprovacao: { versao: rec.versao, porId: actor.uid, por: actor.nome, em: FieldValue.serverTimestamp() } });
    audit(tx, { actor, acao: 'Versão aprovada', cid, rec: { id: rec.id, titulo: rec.snap.titulo }, detalhe: 'v' + rec.versao });
    return { versao: rec.versao };
  });
});

// Exclusão lógica (deleted: true) e restauração (deleted: false). Só o administrador.
const softDeleteRecord = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id', 'restaurar']);
  const cid = idOf(d.cid, 'contabilidade'), restaurar = d.restaurar === true;
  if (d.restaurar !== undefined && typeof d.restaurar !== 'boolean') fail('invalid-argument', 'restaurar: verdadeiro ou falso.');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    requireAdmin(actor);
    await requireContab(actor, cid, { tx });
    const rec = await lerRegistro(tx, cid, d.id);
    if (!!rec.deleted === !restaurar) fail('failed-precondition', restaurar ? 'O registro não está excluído.' : 'O registro já está excluído.');
    tx.update(recRef(cid, rec.id), { deleted: !restaurar });
    audit(tx, { actor, acao: restaurar ? 'Registro restaurado' : 'Exclusão lógica', cid, rec: { id: rec.id, titulo: rec.snap.titulo } });
    return { deleted: !restaurar };
  });
});

// Exclusão permanente: só de registro já excluído logicamente; apaga registro e versões; a auditoria fica.
const LIMITE_TX = 450;
const hardDeleteRecord = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'id']);
  const cid = idOf(d.cid, 'contabilidade');
  const restantes = await db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    requireAdmin(actor);
    await requireContab(actor, cid, { tx });
    const rec = await lerRegistro(tx, cid, d.id);
    if (!rec.deleted) fail('failed-precondition', 'Exclua logicamente antes da exclusão permanente.');
    const vs = await tx.get(db.collection(`contabilidades/${cid}/registros/${rec.id}/versoes`).limit(LIMITE_TX + 1));
    audit(tx, { actor, acao: 'Exclusão permanente', cid, rec: { id: rec.id, titulo: rec.snap.titulo }, detalhe: `${rec.versao} versão(ões)` });
    tx.delete(recRef(cid, rec.id));
    if (vs.size <= LIMITE_TX) { vs.docs.forEach(v => tx.delete(v.ref)); return false; }
    return true;
  });
  // Histórico maior que o limite de uma transação: o registro já sumiu (e foi auditado); apaga o resto das versões.
  if (restantes) await db.recursiveDelete(db.collection(`contabilidades/${cid}/registros/${d.id}/versoes`));
  return { ok: true };
});

module.exports = { saveRecord, restoreRecordVersion, approveRecord, softDeleteRecord, hardDeleteRecord, snapOk, STATUS };
