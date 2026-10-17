'use strict';
// Auditoria produzida só pelo servidor. Lista fechada de ações, esquema rígido e identidade
// tirada do perfil. Eventos de SISTEMA ficam em `auditoria`; eventos de CONTABILIDADE em
// `contabilidades/{cid}/auditoria` (mesmo formato de antes, para a tela continuar igual).
const { db, FieldValue, fail, callable, actorFrom, requireAdmin, requireContab, obj, onlyKeys, str, idOf, int, oneOf, canEdit } = require('./common');

// ação → escopo. Nada fora desta lista é gravado.
const ACOES = {
  // contabilidade (escopo 'registro', como no formato histórico)
  'Criação': 'registro', 'Edição': 'registro', 'Restauração de versão': 'registro', 'Versão aprovada': 'registro',
  'Exclusão lógica': 'registro', 'Registro restaurado': 'registro', 'Exclusão permanente': 'registro',
  'Evidência enviada': 'registro', 'Evidência excluída': 'registro',
  'Exportação CSV': 'registro', 'Backup exportado (contabilidade)': 'registro',
  // sistema
  'Login': 'sistema', 'Logout': 'sistema', 'Backup completo exportado': 'sistema',
  'Usuário criado': 'sistema', 'Usuário editado': 'sistema', 'Usuário bloqueado': 'sistema', 'Usuário desbloqueado': 'sistema',
  'Acesso de usuário removido': 'sistema', 'Redefinição de senha enviada': 'sistema',
  'Contabilidade criada': 'sistema', 'Contabilidade renomeada': 'sistema', 'Dados cadastrais da contabilidade alterados': 'sistema',
  'Logo da contabilidade alterada': 'sistema', 'Logo da contabilidade removida': 'sistema',
  'Contabilidade excluída': 'sistema', 'Contabilidade restaurada': 'sistema',
  'Categoria criada': 'sistema', 'Categoria removida': 'sistema',
  'Dados legados migrados': 'sistema', 'Limpeza de evidências pendentes': 'sistema'
  , 'Configuração de diagnóstico alterada': 'registro', 'Configuração global de diagnóstico alterada': 'sistema',
  'Plano de ação recalculado': 'registro', 'Tarefa de plano concluída': 'registro', 'Tarefa de plano reaberta': 'registro'
};
// Chaves e limites de um evento. `fonte` distingue eventos do servidor dos antigos (gravados pelo navegador).
const ESQUEMA = { ts: 'ts', userId: 128, user: 100, role: 20, acao: 80, recId: 64, recTitulo: 200, detalhe: 1000, escopo: 10, contabId: 64, fonte: 10 };

const corta = (s, n) => String(s ?? '').slice(0, n);
// Monta e valida o evento. `actor` vem de actorFrom (token + perfil); `sistemaAuto` para tarefas agendadas.
function evento({ actor, acao, cid = null, rec = null, detalhe = '' }) {
  const escopo = ACOES[acao];
  if (!escopo) throw new Error('Ação de auditoria fora da lista: ' + acao);
  if (escopo === 'registro' && !cid) throw new Error('Evento de contabilidade sem contabilidade: ' + acao);
  if (escopo === 'sistema' && (cid || rec)) throw new Error('Evento de sistema com vínculo de contabilidade: ' + acao);
  const e = {
    ts: FieldValue.serverTimestamp(), userId: actor.uid, user: corta(actor.nome, 100), role: actor.role, acao,
    recId: rec ? rec.id : null, recTitulo: rec ? corta(rec.titulo, 200) : '', detalhe: corta(detalhe, 1000),
    escopo, contabId: escopo === 'registro' ? cid : null, fonte: 'servidor'
  };
  for (const k of Object.keys(e)) if (!(k in ESQUEMA)) throw new Error('Chave de auditoria fora do esquema: ' + k);
  for (const [k, lim] of Object.entries(ESQUEMA)) {
    if (!(k in e)) throw new Error('Chave de auditoria ausente: ' + k);
    if (typeof lim === 'number' && e[k] !== null && (typeof e[k] !== 'string' || e[k].length > lim)) throw new Error('Valor de auditoria inválido: ' + k);
  }
  return e;
}
const auditRef = (escopo, cid, id) => {
  const col = escopo === 'sistema' ? db.collection('auditoria') : db.collection(`contabilidades/${cid}/auditoria`);
  return id ? col.doc(id) : col.doc();
};
// Grava dentro de uma transação/lote (create: falha se o id já existir).
function audit(tx, args, id) { const e = evento(args); tx.create(auditRef(e.escopo, e.contabId, id), e); return e; }
async function auditNow(args, id) { const e = evento(args); await auditRef(e.escopo, e.contabId, id).create(e); return e; }

/* ---------- eventos disparados pelo navegador (lista ainda mais curta, cada um com regra própria) ---------- */
const LOGIN_JANELA_S = 10 * 60; // o login precisa ter acontecido de fato nos últimos 10 minutos (auth_time do token)

const logEvent = callable(async req => {
  const d = obj(req.data);
  const acao = oneOf(d.acao, ['Login', 'Logout', 'Exportação CSV', 'Backup exportado (contabilidade)', 'Backup completo exportado', 'Redefinição de senha enviada'], 'acao');
  const actor = await actorFrom(req);

  if (acao === 'Login' || acao === 'Logout') {
    onlyKeys(d, ['acao']);
    const t = actor.authTime;
    if (!t) return { ok: false };
    if (acao === 'Login' && Date.now() / 1000 - t > LOGIN_JANELA_S) return { ok: false };
    // Um evento por sessão: o id fixo impede repetir Login/Logout da mesma autenticação.
    try { await auditNow({ actor, acao }, `${acao === 'Login' ? 'login' : 'logout'}_${actor.uid}_${t}`); }
    catch (e) { if (e.code === 6 || /already exists/i.test(String(e.message))) return { ok: true, repetido: true }; throw e; }
    return { ok: true };
  }
  if (acao === 'Exportação CSV') {
    onlyKeys(d, ['acao', 'cid', 'quantidade']);
    const cid = idOf(d.cid, 'contabilidade'), n = int(d.quantidade, 'quantidade', { max: 100000 });
    const c = await requireContab(actor, cid);
    if (!canEdit(actor, cid)) fail('permission-denied', 'Sem permissão para exportar.');
    await auditNow({ actor, acao, cid, detalhe: `${c.nome} · ${n} registro(s)` });
    return { ok: true };
  }
  if (acao === 'Backup exportado (contabilidade)') {
    onlyKeys(d, ['acao', 'cid']);
    requireAdmin(actor);
    const cid = idOf(d.cid, 'contabilidade'), s = await db.doc(`contabilidades/${cid}`).get();
    if (!s.exists) fail('not-found', 'Contabilidade não encontrada.');
    await auditNow({ actor, acao, cid, detalhe: s.data().nome });
    return { ok: true };
  }
  if (acao === 'Backup completo exportado') {
    onlyKeys(d, ['acao']);
    requireAdmin(actor);
    const n = (await db.collection('contabilidades').count().get()).data().count; // contado no servidor
    await auditNow({ actor, acao, detalhe: `${n} contabilidade(s)` });
    return { ok: true };
  }
  // Redefinição de senha: o e-mail sai do Firebase Auth pelo navegador; o servidor só confere o alvo.
  onlyKeys(d, ['acao', 'uid']);
  requireAdmin(actor);
  const uid = str(d.uid, 'uid', { max: 128, min: 1 }), u = await db.doc(`users/${uid}`).get();
  if (!u.exists) fail('not-found', 'Usuário não encontrado.');
  await auditNow({ actor, acao, detalhe: corta(u.data().email, 200) });
  return { ok: true };
});

module.exports = { ACOES, evento, audit, auditNow, logEvent };
