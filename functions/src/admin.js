'use strict';
// Operações do administrador que antes gravavam direto do navegador junto com a auditoria.
// Agora a mudança e o evento saem do servidor, na mesma transação.
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');
const { db, FieldValue, ROLES, fail, callable, actorFrom, isAdmin, requireAdmin, obj, onlyKeys, str, idOf, oneOf, dateOrEmpty } = require('./common');
const { audit } = require('./audit');
const { arquivoIdDe } = require('./evidence');

const DEFAULT_CATS = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores', 'Segurança da Informação',
  'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura', 'Mapeamento de Dados'];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// Lê as contabilidades citadas e confere que existem e não estão excluídas.
async function contabsOk(tx, ids) {
  if (!Array.isArray(ids) || ids.length > 200) fail('invalid-argument', 'Lista de contabilidades inválida.');
  const uniq = [...new Set(ids.map(x => idOf(x, 'contabilidade')))];
  const snaps = uniq.length ? await tx.getAll(...uniq.map(id => db.doc(`contabilidades/${id}`))) : [];
  snaps.forEach(s => { if (!s.exists || s.data().excluida === true) fail('invalid-argument', 'Contabilidade inexistente na lista.'); });
  return { ids: uniq, nomes: snaps.map(s => s.data().nome) };
}
// Nomes em contabilidades/{cid}/pessoas (campo Responsável): só usuários ativos, não administradores.
function syncPessoas(tx, uid, nome, role, ativo, ids, prev = []) {
  const alvo = role !== 'admin' && ativo ? ids : [];
  prev.filter(c => !alvo.includes(c)).forEach(c => tx.delete(db.doc(`contabilidades/${c}/pessoas/${uid}`)));
  alvo.forEach(c => tx.set(db.doc(`contabilidades/${c}/pessoas/${uid}`), { nome }));
}
function canManageUser(actor, target, ids) {
  if (isAdmin(actor)) return true;
  return actor.role === 'admin_local' && target.role !== 'admin' && target.role !== 'admin_local'
    && ids.every(id => actor.contabilidades.includes(id))
    && (target.contabilidades || []).every(id => actor.contabilidades.includes(id));
}
async function adminsAtivos(tx) { return (await tx.get(db.collection('users').where('role', '==', 'admin').where('ativo', '==', true).limit(2))).size; }

/* ---------- usuários ---------- */
const adminSaveUser = callable(async req => {
  const d = onlyKeys(obj(req.data), ['uid', 'nome', 'email', 'role', 'contabilidades']);
  const nome = str(d.nome, 'nome', { min: 1, max: 100 });
  const role = oneOf(d.role, Object.keys(ROLES), 'perfil');
  const pedidas = role === 'admin' ? [] : (d.contabilidades || []);
  if (role !== 'admin' && !pedidas.length) fail('invalid-argument', 'Selecione ao menos uma contabilidade.');

  if (d.uid !== undefined) { // edição
    const uid = str(d.uid, 'uid', { min: 1, max: 128 });
    return db.runTransaction(async tx => {
      const actor = await actorFrom(req, tx);
      const s = await tx.get(db.doc(`users/${uid}`));
      if (!s.exists) fail('not-found', 'Usuário não encontrado.');
      const u = s.data();
      const { ids, nomes } = await contabsOk(tx, pedidas);
      if (!canManageUser(actor, u, ids)) fail('permission-denied', 'Sem permissão para administrar este usuário.');
      if (u.role === 'admin' && u.ativo && role !== 'admin' && await adminsAtivos(tx) <= 1) fail('failed-precondition', 'Mantenha ao menos um administrador ativo.');
      tx.update(s.ref, { nome, role, contabilidades: ids });
      syncPessoas(tx, uid, nome, role, u.ativo === true, ids, u.contabilidades || []);
      audit(tx, { actor, acao: 'Usuário editado', detalhe: `${u.email} · ${ROLES[u.role] || u.role} → ${ROLES[role]} · ${nomes.join(', ') || 'todas'}` });
      return { uid };
    });
  }
  // criação: a conta é criada pelo Admin SDK com senha aleatória; o usuário define a sua pelo e-mail de redefinição
  const email = str(d.email, 'e-mail', { min: 3, max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) fail('invalid-argument', 'E-mail inválido.');
  const pre = await actorFrom(req);
  if (!isAdmin(pre) && (pre.role !== 'admin_local' || role === 'admin' || role === 'admin_local' || pedidas.some(id => !pre.contabilidades.includes(id))))
    fail('permission-denied', 'Administrador local só pode criar usuários de sua contabilidade.');
  if (isAdmin(pre)) requireAdmin(pre);
  let user;
  try { user = await getAuth().createUser({ email, password: crypto.randomBytes(24).toString('base64url'), emailVerified: false }); }
  catch (e) {
    if (e.code === 'auth/email-already-exists') fail('already-exists', 'Este e-mail já existe no Authentication. Desbloqueie o usuário existente ou remova a conta no console do Firebase.');
    throw e;
  }
  try {
    await db.runTransaction(async tx => {
      const actor = await actorFrom(req, tx);
      const { ids, nomes } = await contabsOk(tx, pedidas);
      if (!isAdmin(actor) && (actor.role !== 'admin_local' || role === 'admin' || role === 'admin_local' || ids.some(id => !actor.contabilidades.includes(id))))
        fail('permission-denied', 'Administrador local só pode criar usuários de sua contabilidade.');
      tx.create(db.doc(`users/${user.uid}`), { nome, email, role, ativo: true, contabilidades: ids, criado: FieldValue.serverTimestamp() });
      syncPessoas(tx, user.uid, nome, role, true, ids, []);
      audit(tx, { actor, acao: 'Usuário criado', detalhe: `${email} · ${ROLES[role]} · ${nomes.join(', ') || 'todas'}` });
    });
  } catch (e) { await getAuth().deleteUser(user.uid).catch(() => {}); throw e; } // sem conta de login solta
  return { uid: user.uid, email };
});

const adminSetUserActive = callable(async req => {
  const d = onlyKeys(obj(req.data), ['uid', 'ativo']);
  const uid = str(d.uid, 'uid', { min: 1, max: 128 });
  if (typeof d.ativo !== 'boolean') fail('invalid-argument', 'ativo: verdadeiro ou falso.');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    if (uid === actor.uid) fail('failed-precondition', 'Você não pode bloquear a si mesmo.');
    const s = await tx.get(db.doc(`users/${uid}`));
    if (!s.exists) fail('not-found', 'Usuário não encontrado.');
    const u = s.data();
    if (!canManageUser(actor, u, u.contabilidades || [])) fail('permission-denied', 'Sem permissão para administrar este usuário.');
    if (u.ativo === d.ativo) return { ativo: d.ativo };
    if (!d.ativo && u.role === 'admin' && await adminsAtivos(tx) <= 1) fail('failed-precondition', 'Mantenha ao menos um administrador ativo.');
    tx.update(s.ref, { ativo: d.ativo });
    syncPessoas(tx, uid, u.nome, u.role, d.ativo, u.contabilidades || [], u.contabilidades || []);
    audit(tx, { actor, acao: d.ativo ? 'Usuário desbloqueado' : 'Usuário bloqueado', detalhe: u.email || uid });
    return { ativo: d.ativo };
  });
});

// Remove o perfil (o acesso). A conta de login continua no Authentication, como antes.
const adminRemoveUser = callable(async req => {
  const d = onlyKeys(obj(req.data), ['uid']);
  const uid = str(d.uid, 'uid', { min: 1, max: 128 });
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    if (uid === actor.uid) fail('failed-precondition', 'Você não pode remover a si mesmo.');
    const s = await tx.get(db.doc(`users/${uid}`));
    if (!s.exists) fail('not-found', 'Usuário não encontrado.');
    const u = s.data();
    if (!canManageUser(actor, u, u.contabilidades || [])) fail('permission-denied', 'Sem permissão para administrar este usuário.');
    if (u.role === 'admin' && u.ativo && await adminsAtivos(tx) <= 1) fail('failed-precondition', 'Mantenha ao menos um administrador ativo.');
    tx.delete(s.ref);
    syncPessoas(tx, uid, u.nome, u.role, false, [], u.contabilidades || []);
    audit(tx, { actor, acao: 'Acesso de usuário removido', detalhe: u.email || uid });
    return { ok: true };
  });

});

const adminListUsers = callable(async req => {
  const actor = await actorFrom(req);
  if (!isAdmin(actor) && actor.role !== 'admin_local') fail('permission-denied', 'Sem permissão para listar usuários.');
  const snaps = await db.collection('users').get();
  return { users: snaps.docs.map(s => ({ id: s.id, ...s.data() })).filter(u =>
    isAdmin(actor) || (u.role !== 'admin' && u.role !== 'admin_local' && (u.contabilidades || []).some(id => actor.contabilidades.includes(id)))) };
});

/* ---------- contabilidades ---------- */
const CAD = { razaoSocial: 200, cnpj: 18, endereco: 300, canalPrivacidade: 200, porteRfb: 60, natJur: 120 };
async function nomeLivre(tx, nome, excetoId) {
  const todas = await tx.get(db.collection('contabilidades').select('nome'));
  if (todas.docs.some(c => c.id !== excetoId && String(c.data().nome || '').toLowerCase() === nome.toLowerCase())) fail('already-exists', 'Já existe uma contabilidade com este nome.');
}

const adminSaveContabilidade = callable(async req => {
  const d = onlyKeys(obj(req.data), ['id', 'nome', ...Object.keys(CAD), 'simples', 'consultaEm', 'logo']);
  const nome = str(d.nome, 'nome', { min: 1, max: 100 });
  if (d.id === undefined) {
    if (Object.keys(d).some(k => k !== 'nome')) fail('invalid-argument', 'Na criação informe só o nome.');
    return db.runTransaction(async tx => {
      const actor = await actorFrom(req, tx); requireAdmin(actor);
      await nomeLivre(tx, nome);
      const ref = db.collection('contabilidades').doc();
      tx.create(ref, { nome, criado: FieldValue.serverTimestamp() });
      audit(tx, { actor, acao: 'Contabilidade criada', detalhe: nome });
      return { id: ref.id };
    });
  }
  const id = idOf(d.id, 'contabilidade');
  const cad = {};
  for (const [k, max] of Object.entries(CAD)) if (d[k] !== undefined) cad[k] = str(d[k], k, { max });
  if (cad.cnpj && !/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cad.cnpj)) fail('invalid-argument', 'CNPJ em formato inválido.');
  if (d.simples !== undefined) cad.simples = oneOf(d.simples, ['', 'Sim', 'Não'], 'Simples Nacional');
  if (d.consultaEm !== undefined) cad.consultaEm = dateOrEmpty(d.consultaEm, 'data da consulta');
  let logo = null; // null = manter
  if (d.logo !== undefined && d.logo !== null) {
    logo = str(d.logo, 'logo', { max: 300000, trim: false });
    if (logo && !LOGO_RE.test(logo)) fail('invalid-argument', 'Logo em formato inválido.');
  }
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx); requireAdmin(actor);
    const s = await tx.get(db.doc(`contabilidades/${id}`));
    if (!s.exists || s.data().excluida === true) fail('not-found', 'Contabilidade não encontrada.');
    const c = s.data();
    if (nome !== c.nome) await nomeLivre(tx, nome, id);
    const mudouCad = Object.keys(cad).filter(k => k !== 'consultaEm').some(k => (c[k] || '') !== cad[k]);
    const upd = { nome, ...cad };
    if (logo !== null) upd.logo = logo;
    if (nome === c.nome && logo === null && !mudouCad && (cad.consultaEm === undefined || cad.consultaEm === (c.consultaEm || ''))) return { id, semAlteracao: true };
    tx.update(s.ref, upd);
    if (nome !== c.nome) audit(tx, { actor, acao: 'Contabilidade renomeada', detalhe: `${c.nome} → ${nome}` });
    if (mudouCad) audit(tx, { actor, acao: 'Dados cadastrais da contabilidade alterados', detalhe: nome });
    if (logo !== null) audit(tx, { actor, acao: logo ? 'Logo da contabilidade alterada' : 'Logo da contabilidade removida', detalhe: nome });
    return { id };
  });
});

// Exclusão lógica: some das listas e desvincula os usuários. Registros, versões e auditoria ficam.
const adminDeleteContabilidade = callable(async req => {
  const d = onlyKeys(obj(req.data), ['id', 'confirmaNome']);
  const id = idOf(d.id, 'contabilidade');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx); requireAdmin(actor);
    const s = await tx.get(db.doc(`contabilidades/${id}`));
    if (!s.exists || s.data().excluida === true) fail('not-found', 'Contabilidade não encontrada.');
    const c = s.data();
    if (d.confirmaNome !== c.nome) fail('invalid-argument', 'Digite o nome exato da contabilidade para confirmar.');
    const vinc = (await tx.get(db.collection('users').where('contabilidades', 'array-contains', id))).docs.filter(u => u.data().role !== 'admin');
    tx.update(s.ref, { excluida: true, excluidaEm: FieldValue.serverTimestamp() });
    vinc.forEach(u => { tx.update(u.ref, { contabilidades: FieldValue.arrayRemove(id) }); tx.delete(db.doc(`contabilidades/${id}/pessoas/${u.id}`)); });
    audit(tx, { actor, acao: 'Contabilidade excluída', detalhe: c.nome + (vinc.length ? ` (acesso removido de: ${vinc.map(u => u.data().nome).join(', ')})` : '') });
    return { desvinculados: vinc.length };
  });
});

const adminRestoreContabilidade = callable(async req => {
  const d = onlyKeys(obj(req.data), ['id']);
  const id = idOf(d.id, 'contabilidade');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx); requireAdmin(actor);
    const s = await tx.get(db.doc(`contabilidades/${id}`));
    if (!s.exists || s.data().excluida !== true) fail('not-found', 'Contabilidade excluída não encontrada.');
    tx.update(s.ref, { excluida: false });
    audit(tx, { actor, acao: 'Contabilidade restaurada', detalhe: s.data().nome });
    return { id };
  });
});

/* ---------- categorias (lista única em config/app) ---------- */
const adminCategorias = callable(async req => {
  const d = onlyKeys(obj(req.data), ['op', 'nome', 'nomes']);
  const op = oneOf(d.op, ['add', 'remove', 'ensure'], 'operação');
  const nomes = op === 'ensure'
    ? (Array.isArray(d.nomes) && d.nomes.length <= 30 ? d.nomes.map(n => str(n, 'categoria', { min: 1, max: 80 })) : fail('invalid-argument', 'Lista de categorias inválida.'))
    : [str(d.nome, 'categoria', { min: 1, max: 80 })];
  // Remoção: confere uso em TODAS as contabilidades (antes a tela só via a selecionada).
  if (op === 'remove') {
    const uso = await db.collectionGroup('registros').where('snap.categoria', '==', nomes[0]).limit(1).get();
    if (!uso.empty) fail('failed-precondition', 'Categoria em uso por registros; não pode ser removida.');
  }
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx); requireAdmin(actor);
    const ref = db.doc('config/app'), s = await tx.get(ref);
    const atual = s.exists ? (s.data().lista || []) : [];
    let lista = atual.slice(), novas = [];
    if (op === 'remove') {
      if (!atual.includes(nomes[0])) fail('not-found', 'Categoria não encontrada.');
      lista = atual.filter(x => x !== nomes[0]);
      audit(tx, { actor, acao: 'Categoria removida', detalhe: nomes[0] });
    } else {
      const base = s.exists ? atual : DEFAULT_CATS.slice();
      novas = nomes.filter(n => !base.includes(n));
      if (op === 'add' && !novas.length) fail('already-exists', 'Categoria já existe.');
      lista = [...base, ...novas];
      if (!s.exists) DEFAULT_CATS.forEach(n => audit(tx, { actor, acao: 'Categoria criada', detalhe: n }));
      novas.forEach(n => audit(tx, { actor, acao: 'Categoria criada', detalhe: n }));
      if (s.exists && !novas.length) return { lista };
    }
    if (lista.length > 100) fail('resource-exhausted', 'Categorias demais.');
    tx.set(ref, { lista });
    return { lista };
  });
});

/* ---------- migração de dados existentes (idempotente) ---------- */
// Evidências antigas (enviadas pelo fluxo "upload primeiro") ganham o documento de arquivo `ready`,
// sem o qual o novo storage.rules não serve o arquivo. Também aponta registros cuja versão atual
// não tem o snapshot correspondente em versoes/ (efeito da falha 1), sem alterar nada neles.
const adminMigrateLegacy = callable(async req => {
  const actor = await actorFrom(req); requireAdmin(actor);
  onlyKeys(obj(req.data || {}), []);
  let evidencias = 0, semVersao = [];
  for (const c of (await db.collection('contabilidades').get()).docs) {
    for (const e of (await c.ref.collection('evidencias').get()).docs) {
      const ev = e.data();
      if (!ev.path || !String(ev.path).startsWith(`evidencias/${c.id}/`)) continue;
      const arqId = arquivoIdDe(ev);
      const arq = c.ref.collection('evidenciasArquivos').doc(arqId);
      await db.runTransaction(async tx => {
        const a = await tx.get(arq);
        if (!a.exists) {
          tx.create(arq, { status: 'ready', path: ev.path, contabId: c.id, autorId: ev.autorId || '', autor: ev.autor || '', tipo: ev.tipo || '',
            tamanho: ev.tamanho || 0, categoria: ev.categoria || '', descricao: ev.descricao || '', nome: ev.nome || '', legado: true,
            criadoEm: ev.ts || FieldValue.serverTimestamp(), prontoEm: FieldValue.serverTimestamp() });
          evidencias++;
        }
        if (!e.data().arquivoId) tx.update(e.ref, { arquivoId: arqId });
      });
    }
    for (const r of (await c.ref.collection('registros').get()).docs) {
      const v = r.data().versao;
      if (!Number.isInteger(v) || !(await r.ref.collection('versoes').doc(String(v)).get()).exists) semVersao.push(`${c.id}/${r.id}`);
    }
  }
  await db.runTransaction(async tx => audit(tx, { actor, acao: 'Dados legados migrados',
    detalhe: `${evidencias} arquivo(s) de evidência registrados · ${semVersao.length} registro(s) sem a versão atual no histórico` }));
  return { evidencias, registrosSemVersaoAtual: semVersao.slice(0, 200) };
});

module.exports = { adminSaveUser, adminSetUserActive, adminRemoveUser, adminListUsers, adminSaveContabilidade, adminDeleteContabilidade, adminRestoreContabilidade, adminCategorias, adminMigrateLegacy, DEFAULT_CATS };
