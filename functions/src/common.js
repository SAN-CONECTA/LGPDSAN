'use strict';
// Base comum das Functions: identidade (sempre do token + perfil no Firestore), papéis,
// vínculo com a contabilidade e validação de entrada. Nada que venha do navegador sobre
// quem é o usuário (nome, papel, uid, horário) é aproveitado.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = 'southamerica-east1';
// Origens do app (GitHub Pages + domínio próprio + teste local).
const CORS = ['https://lgpd.sanconecta.com', 'https://san-conecta.github.io', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const ROLES = { consulta: 'Consulta', edicao: 'Edição', admin_local: 'Administrador local', admin: 'Administrador' };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const fail = (code, msg) => { throw new HttpsError(code, msg); };

// Callable padrão: região, CORS restrito e erros inesperados viram "internal" sem vazar detalhes.
function callable(handler, opts = {}) {
  return onCall({ region: REGION, cors: CORS, maxInstances: 10, ...opts }, async req => {
    try { return await handler(req); }
    catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error(e);
      throw new HttpsError('internal', 'Erro interno. Tente novamente.');
    }
  });
}

/* ---------- identidade ---------- */
// Lê o perfil do usuário autenticado. Com `tx`, a leitura entra na transação (o perfil não pode mudar no meio).
async function actorFrom(req, tx) {
  if (!req.auth || !req.auth.uid) fail('unauthenticated', 'Faça login para continuar.');
  const ref = db.doc(`users/${req.auth.uid}`);
  const s = tx ? await tx.get(ref) : await ref.get();
  const u = s.exists ? s.data() : null;
  if (!u || u.ativo !== true) fail('permission-denied', 'Perfil inexistente ou bloqueado.');
  if (!ROLES[u.role]) fail('permission-denied', 'Perfil sem papel válido.');
  return {
    uid: req.auth.uid, nome: typeof u.nome === 'string' ? u.nome.slice(0, 100) : '', email: u.email || '',
    role: u.role, contabilidades: Array.isArray(u.contabilidades) ? u.contabilidades : [],
    authTime: Number(req.auth.token && req.auth.token.auth_time) || 0
  };
}
const isAdmin = a => a.role === 'admin';
const isContabAdmin = (a, cid) => isAdmin(a) || (a.role === 'admin_local' && a.contabilidades.includes(cid));
const canRead = (a, cid) => isAdmin(a) || a.contabilidades.includes(cid);
const canEdit = (a, cid) => isAdmin(a) || (a.role === 'edicao' && a.contabilidades.includes(cid));
const requireAdmin = a => { if (!isAdmin(a)) fail('permission-denied', 'Somente o administrador pode fazer isto.'); };
const requireContabAdmin = (a, cid) => { if (!isContabAdmin(a, cid)) fail('permission-denied', 'Somente o administrador da contabilidade pode fazer isto.'); };

// Confere o vínculo e que a contabilidade existe e não está excluída. Devolve os dados dela.
async function requireContab(a, cid, { edit = false, tx } = {}) {
  idOf(cid, 'contabilidade');
  if (!(edit ? canEdit(a, cid) : canRead(a, cid))) fail('permission-denied', edit ? 'Sem permissão de edição nesta contabilidade.' : 'Sem acesso a esta contabilidade.');
  const ref = db.doc(`contabilidades/${cid}`);
  const s = tx ? await tx.get(ref) : await ref.get();
  if (!s.exists || s.data().excluida === true) fail('not-found', 'Contabilidade não encontrada.');
  return s.data();
}

/* ---------- validação ---------- */
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function obj(v, name = 'dados') { if (!isObj(v)) fail('invalid-argument', `Formato inválido: ${name}.`); return v; }
// Rejeita chaves desconhecidas: o esquema de cada chamada é fechado.
function onlyKeys(o, allowed, name = 'dados') {
  const extra = Object.keys(o).filter(k => !allowed.includes(k));
  if (extra.length) fail('invalid-argument', `Campo não permitido em ${name}: ${extra.slice(0, 3).join(', ')}.`);
  return o;
}
function str(v, name, { max, min = 0, trim = true, optional = false } = {}) {
  if (v === undefined || v === null) { if (optional) return ''; fail('invalid-argument', `Informe ${name}.`); }
  if (typeof v !== 'string') fail('invalid-argument', `${name}: texto esperado.`);
  const s = trim ? v.trim() : v;
  if (s.length < min) fail('invalid-argument', min > 1 ? `${name}: mínimo de ${min} caracteres.` : `Informe ${name}.`);
  if (max !== undefined && s.length > max) fail('invalid-argument', `${name}: máximo de ${max} caracteres.`);
  return s;
}
function idOf(v, name = 'id') { if (typeof v !== 'string' || !ID_RE.test(v)) fail('invalid-argument', `Identificador inválido: ${name}.`); return v; }
function int(v, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(v) || v < min || v > max) fail('invalid-argument', `${name}: número inteiro entre ${min} e ${max}.`);
  return v;
}
function oneOf(v, list, name) { if (!list.includes(v)) fail('invalid-argument', `${name}: valor não permitido.`); return v; }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function dateOrEmpty(v, name) { const s = str(v, name, { max: 10, optional: true }); if (s && (!DATE_RE.test(s) || isNaN(Date.parse(s + 'T00:00:00Z')))) fail('invalid-argument', `${name}: data inválida.`); return s; }

module.exports = {
  db, FieldValue, Timestamp, HttpsError, REGION, CORS, ROLES, callable, fail,
  actorFrom, isAdmin, isContabAdmin, canRead, canEdit, requireAdmin, requireContabAdmin, requireContab,
  isObj, obj, onlyKeys, str, idOf, int, oneOf, dateOrEmpty
};
