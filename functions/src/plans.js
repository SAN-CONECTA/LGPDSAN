'use strict';

const { db, FieldValue, fail, callable, actorFrom, requireContab, obj, onlyKeys, idOf, str, oneOf } = require('./common');
const { audit } = require('./audit');
const { currentConfig } = require('./configuration');

const PLAN_STATUS = ['pendente', 'concluida', 'obsoleta'];
const answerValue = value => Array.isArray(value) ? value : [value];

function answersOk(answers, config) {
  if (answers === undefined) return {};
  const a = obj(answers, 'respostas');
  const allowed = new Map(config.questions.map(q => [q.id, q]));
  const out = {};
  for (const [id, value] of Object.entries(a)) {
    const q = allowed.get(id);
    if (!q || typeof value !== 'string' || value.length > 2000) fail('invalid-argument', `Resposta inválida: ${id}.`);
    if (q.type === 'select' && !q.options.includes(value)) fail('invalid-argument', `Opção inválida: ${id}.`);
    out[id] = value;
  }
  return out;
}

function taskFrom(action, answer) {
  return {
    id: action.id,
    requisito: action.requirement,
    titulo: action.title,
    prioridade: action.priority,
    responsavel: action.responsible,
    gatilho: { questionId: action.questionId, answer },
    status: 'pendente'
  };
}

const refreshActionPlan = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'recordId', 'answers']);
  const cid = idOf(d.cid, 'contabilidade'), recordId = idOf(d.recordId, 'registro');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { tx });
    const recRef = db.doc(`contabilidades/${cid}/registros/${recordId}`);
    const rec = await tx.get(recRef);
    if (!rec.exists || rec.data().deleted === true) fail('not-found', 'Diagnóstico não encontrado.');
    const config = await currentConfig(tx, cid);
    const answers = answersOk(d.answers === undefined ? rec.data().snap && rec.data().snap.dados : d.answers, config);
    const planRef = db.doc(`contabilidades/${cid}/planosAcao/${recordId}`);
    const plan = await tx.get(planRef);
    const existing = plan.exists ? plan.data().tarefas || {} : {};
    const next = { ...existing };
    for (const action of config.actions) {
      const answer = answers[action.questionId];
      if (answer !== undefined && action.when.includes(answer)) {
        const previous = existing[action.id];
        next[action.id] = previous && previous.status === 'concluida'
          ? previous
          : { ...(previous || {}), ...taskFrom(action, answer), atualizado: FieldValue.serverTimestamp() };
      } else if (existing[action.id] && existing[action.id].status !== 'concluida') {
        next[action.id] = { ...existing[action.id], status: 'obsoleta', obsoletaEm: FieldValue.serverTimestamp() };
      }
    }
    const version = (plan.exists ? Number(plan.data().versao) || 0 : 0) + 1;
    tx.set(planRef, { recordId, versao: version, tarefas: next, atualizado: FieldValue.serverTimestamp(), atualizadoPor: actor.uid });
    tx.create(db.doc(`contabilidades/${cid}/planosAcao/${recordId}/versoes/${version}`), {
      versao: version, tarefas: next, respostas: answers, criado: FieldValue.serverTimestamp(), criadoPor: actor.uid
    });
    audit(tx, { actor, acao: 'Plano de ação recalculado', cid, rec: { id: recordId, titulo: rec.data().snap.titulo }, detalhe: `v${version}` });
    return { versao: version, tarefas: Object.values(next).filter(t => t.status !== 'obsoleta') };
  });
});

const completeActionTask = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'recordId', 'taskId', 'status']);
  const cid = idOf(d.cid, 'contabilidade'), recordId = idOf(d.recordId, 'registro'), taskId = idOf(d.taskId, 'tarefa');
  const status = oneOf(d.status, ['pendente', 'concluida'], 'status');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { edit: true, tx });
    const ref = db.doc(`contabilidades/${cid}/planosAcao/${recordId}`), snap = await tx.get(ref);
    if (!snap.exists || !snap.data().tarefas || !snap.data().tarefas[taskId]) fail('not-found', 'Tarefa não encontrada.');
    const tarefa = snap.data().tarefas[taskId];
    if (tarefa.status === 'obsoleta') fail('failed-precondition', 'Tarefa obsoleta; recalcule o plano.');
    const tarefas = { ...snap.data().tarefas, [taskId]: { ...tarefa, status, atualizado: FieldValue.serverTimestamp(), atualizadoPor: actor.uid } };
    tx.update(ref, { tarefas, atualizado: FieldValue.serverTimestamp(), atualizadoPor: actor.uid });
    audit(tx, { actor, acao: status === 'concluida' ? 'Tarefa de plano concluída' : 'Tarefa de plano reaberta', cid, rec: { id: recordId, titulo: '' }, detalhe: tarefa.titulo });
    return { taskId, status };
  });
});

const getActionPlan = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'recordId']);
  const actor = await actorFrom(req), cid = idOf(d.cid, 'contabilidade'), recordId = idOf(d.recordId, 'registro');
  await requireContab(actor, cid);
  const s = await db.doc(`contabilidades/${cid}/planosAcao/${recordId}`).get();
  return s.exists ? { ...s.data(), tarefas: Object.values(s.data().tarefas || {}) } : { versao: 0, tarefas: [] };
});

module.exports = { answersOk, refreshActionPlan, completeActionTask, getActionPlan };
