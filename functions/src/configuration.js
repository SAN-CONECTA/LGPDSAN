'use strict';

const { db, FieldValue, fail, callable, actorFrom, isAdmin, requireAdmin, requireContab, requireContabAdmin, obj, onlyKeys, str, idOf, int } = require('./common');
const { audit } = require('./audit');

const REQUIRED_IDS = ['dgPorte', 'dgLimite', 'dgGrupo', 'dgTitulares'];
const TYPES = ['select', 'text', 'textarea'];
const ANSWERS = ['Sim', 'Não', 'Não sei', 'Até 500', 'De 500 a 5.000', 'Acima de 5.000', 'Demais', 'Microempresa (ME)', 'Empresa de pequeno porte (EPP)', 'MEI', 'Não consultado'];

const DEFAULT_CONFIG = {
  schema: 1,
  questions: [
    { id: 'dgPorte', stage: 1, order: 10, type: 'select', label: 'Qual é o porte informado na Receita Federal?', explanation: 'O porte declarado pode estar desatualizado; confira com o cliente.', example: 'Ex.: Empresa de pequeno porte (EPP)', options: ['Microempresa (ME)', 'Empresa de pequeno porte (EPP)', 'MEI', 'Demais', 'Não consultado'], required: true },
    { id: 'dgLimite', stage: 1, order: 20, type: 'select', label: 'A receita está dentro do limite de pequeno porte?', explanation: 'Confirme a receita bruta anual com o responsável.', example: 'Ex.: Sim', options: ['Sim', 'Não', 'Não sei'], required: true },
    { id: 'dgGrupo', stage: 1, order: 30, type: 'select', label: 'Integra grupo econômico acima do limite?', explanation: 'Pergunte ao cliente; não há cadastro público suficiente para esta resposta.', example: 'Ex.: Não', options: ['Não', 'Sim', 'Não sei'], required: true },
    { id: 'dgTitulares', stage: 1, order: 40, type: 'select', label: 'Quantas pessoas têm dados tratados?', explanation: 'Use uma estimativa documentada.', example: 'Ex.: Até 500', options: ['Até 500', 'De 500 a 5.000', 'Acima de 5.000', 'Não sei'], required: true },
    { id: 'dgSaude', stage: 2, order: 50, type: 'select', label: 'Trata dados de saúde?', explanation: 'Considere atestados e exames.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgSind', stage: 2, order: 55, type: 'select', label: 'Trata filiação sindical?', explanation: 'Considere informações de filiação ou contribuição sindical.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgBio', stage: 2, order: 56, type: 'select', label: 'Trata biometria ou dados de menores?', explanation: 'Considere biometria, crianças e adolescentes.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgIA', stage: 2, order: 57, type: 'select', label: 'Usa IA ou tecnologia nova sobre dados?', explanation: 'Considere sistemas que produzam efeitos sobre titulares.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgMonit', stage: 2, order: 58, type: 'select', label: 'Há monitoramento sistemático?', explanation: 'Considere monitoramento contínuo ou em larga escala.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgDecis', stage: 2, order: 59, type: 'select', label: 'Há decisões automatizadas relevantes?', explanation: 'Considere decisões que afetem significativamente titulares.', example: 'Ex.: Não', options: ['Sim', 'Não', 'Não sei'], required: false },
    { id: 'dgExigiu', stage: 3, order: 60, type: 'select', label: 'Algum cliente exigiu encarregado em contrato?', explanation: 'Confira contratos vigentes.', example: 'Ex.: Não', options: ['Não', 'Sim'], required: false }
  ],
  actions: [
    { id: 'porte', questionId: 'dgPorte', when: ['Demais'], requirement: 'Resolução CD/ANPD nº 2/2022', title: 'Avaliar a obrigação de nomear encarregado', priority: 'alta', responsible: 'Administrador' },
    { id: 'limite', questionId: 'dgLimite', when: ['Não', 'Não sei'], requirement: 'Resolução CD/ANPD nº 2/2022', title: 'Documentar o enquadramento de pequeno porte', priority: 'alta', responsible: 'Administrador' },
    { id: 'saude', questionId: 'dgSaude', when: ['Sim', 'Não sei'], requirement: 'LGPD, arts. 11 e 41', title: 'Avaliar tratamento de dados sensíveis e encarregado', priority: 'alta', responsible: 'Administrador' },
    { id: 'contrato', questionId: 'dgExigiu', when: ['Sim'], requirement: 'Contrato aplicável', title: 'Revisar exigência contratual de encarregado', priority: 'média', responsible: 'Administrador' }
  ]
};

const clone = value => JSON.parse(JSON.stringify(value));
const configOnly = value => ({ schema: value.schema, questions: value.questions, actions: value.actions });
const questionId = /^[A-Za-z][A-Za-z0-9_-]{1,63}$/;

function validateConfig(raw, { local = false } = {}) {
  const c = obj(raw, 'configuração');
  onlyKeys(c, ['schema', 'questions', 'actions'], 'configuração');
  if (c.schema !== 1) fail('invalid-argument', 'Versão de configuração não suportada.');
  if (!Array.isArray(c.questions) || c.questions.length > 100) fail('invalid-argument', 'Perguntas inválidas.');
  const questions = c.questions.map((q, i) => {
    onlyKeys(q, ['id', 'stage', 'order', 'type', 'label', 'explanation', 'example', 'options', 'required', 'condition'], `pergunta ${i + 1}`);
    const id = str(q.id, 'id da pergunta', { min: 2, max: 64 });
    if (!questionId.test(id)) fail('invalid-argument', 'Id de pergunta inválido.');
    if (!TYPES.includes(q.type)) fail('invalid-argument', `Tipo inválido na pergunta ${id}.`);
    const out = { id, stage: int(q.stage, 'etapa', { min: 1, max: 100 }), order: int(q.order, 'ordem', { min: 0, max: 100000 }),
      type: q.type, label: str(q.label, 'pergunta', { min: 1, max: 300 }), explanation: str(q.explanation, 'explicação', { max: 1000, optional: true }),
      example: str(q.example, 'exemplo', { max: 500, optional: true }), required: q.required === true };
    if (q.type === 'select') {
      if (!Array.isArray(q.options) || q.options.length < 1 || q.options.length > 50 || q.options.some(x => typeof x !== 'string' || x.length > 200))
        fail('invalid-argument', `Opções inválidas na pergunta ${id}.`);
      out.options = [...new Set(q.options)];
    }
    if (q.condition !== undefined) {
      const condition = obj(q.condition, 'condição');
      onlyKeys(condition, ['questionId', 'equals'], 'condição');
      if (!questionId.test(String(condition.questionId)) || typeof condition.equals !== 'string')
        fail('invalid-argument', `Condição inválida na pergunta ${id}.`);
      out.condition = { questionId: condition.questionId, equals: condition.equals.slice(0, 200) };
    }
    return out;
  });
  if (new Set(questions.map(q => q.id)).size !== questions.length) fail('invalid-argument', 'Ids de perguntas duplicados.');
  const ids = new Set(questions.map(q => q.id));
  questions.forEach(q => { if (q.condition && !ids.has(q.condition.questionId)) fail('invalid-argument', `Condição referencia pergunta inexistente: ${q.id}.`); });
  const required = new Set(REQUIRED_IDS);
  if (!local && REQUIRED_IDS.some(id => !questions.some(q => q.id === id && q.required))) fail('failed-precondition', 'Controles globais obrigatórios não podem ser removidos.');
  if (local && REQUIRED_IDS.some(id => !questions.some(q => q.id === id))) fail('failed-precondition', 'Controles globais obrigatórios não podem ser removidos.');
  if (!Array.isArray(c.actions) || c.actions.length > 100) fail('invalid-argument', 'Regras de ação inválidas.');
  const actions = c.actions.map((a, i) => {
    onlyKeys(a, ['id', 'questionId', 'when', 'requirement', 'title', 'priority', 'responsible'], `ação ${i + 1}`);
    const id = str(a.id, 'id da ação', { min: 1, max: 64 });
    if (!ids.has(a.questionId)) fail('invalid-argument', `Ação referencia pergunta inexistente: ${id}.`);
    if (!Array.isArray(a.when) || !a.when.length || a.when.some(x => typeof x !== 'string' || x.length > 200)) fail('invalid-argument', `Gatilho inválido na ação ${id}.`);
    return { id, questionId: a.questionId, when: [...new Set(a.when)], requirement: str(a.requirement, 'requisito', { min: 1, max: 300 }),
      title: str(a.title, 'tarefa', { min: 1, max: 300 }), priority: ['baixa', 'média', 'alta'].includes(a.priority) ? a.priority : fail('invalid-argument', 'Prioridade inválida.'), responsible: str(a.responsible, 'responsável', { min: 1, max: 100 }) };
  });
  if (new Set(actions.map(a => a.id)).size !== actions.length) fail('invalid-argument', 'Ids de ações duplicados.');
  return { schema: 1, questions: questions.sort((a, b) => a.stage - b.stage || a.order - b.order), actions };
}

async function currentConfig(tx, cid) {
  const global = await tx.get(db.doc('config/diagnostico'));
  const local = await tx.get(db.doc(`contabilidades/${cid}/configDiagnostico/atual`));
  const base = global.exists ? configOnly(global.data()) : clone(DEFAULT_CONFIG);
  const override = local.exists ? configOnly(local.data()) : null;
  return validateConfig(override ? { ...base, questions: base.questions.map(q => ({ ...q, ...(override.questions && override.questions[q.id]) })) } : base);
}

const getDiagnosticConfig = callable(async req => {
  const d = onlyKeys(obj(req.data || {}), ['cid']);
  const actor = await actorFrom(req);
  const cid = idOf(d.cid, 'contabilidade');
  await requireContab(actor, cid);
  const [g, l] = await Promise.all([db.doc('config/diagnostico').get(), db.doc(`contabilidades/${cid}/configDiagnostico/atual`).get()]);
  return { global: g.exists ? configOnly(g.data()) : clone(DEFAULT_CONFIG), local: l.exists ? configOnly(l.data()) : null,
    globalVersion: g.exists ? g.data().versao || 0 : 0, localVersion: l.exists ? l.data().versao || 0 : 0 };
});

const saveDiagnosticConfig = callable(async req => {
  const d = onlyKeys(obj(req.data), ['cid', 'config', 'baseVersion']);
  const cid = idOf(d.cid, 'contabilidade');
  return db.runTransaction(async tx => {
    const actor = await actorFrom(req, tx);
    await requireContab(actor, cid, { tx });
    const local = !isAdmin(actor);
    if (local) requireContabAdmin(actor, cid);
    const payload = obj(d.config, 'configuração');
    onlyKeys(payload, ['schema', 'questions', 'actions', 'versao', 'escopo', 'atualizado', 'atualizadoPor', 'criado', 'criadoPor'], 'configuração');
    const config = validateConfig({ schema: payload.schema, questions: payload.questions, actions: payload.actions }, { local });
    if (local) {
      const globalSnap = await tx.get(db.doc('config/diagnostico'));
      const global = validateConfig(globalSnap.exists ? configOnly(globalSnap.data()) : DEFAULT_CONFIG);
      for (const id of REQUIRED_IDS) {
        const before = global.questions.find(q => q.id === id);
        const after = config.questions.find(q => q.id === id);
        if (!after || JSON.stringify(before) !== JSON.stringify(after))
          fail('failed-precondition', `O controle global obrigatório ${id} não pode ser alterado.`);
      }
      const current = await tx.get(db.doc(`contabilidades/${cid}/configDiagnostico/atual`));
      const n = current.exists ? int(current.data().versao, 'versão', { min: 1 }) + 1 : 1;
      if (d.baseVersion !== undefined && (!current.exists || d.baseVersion !== current.data().versao)) fail('aborted', 'Configuração alterada por outra pessoa.');
      tx.set(db.doc(`contabilidades/${cid}/configDiagnostico/atual`), { ...config, versao: n, escopo: 'contabilidade', atualizado: FieldValue.serverTimestamp(), atualizadoPor: actor.uid });
      tx.create(db.doc(`contabilidades/${cid}/configDiagnostico/atual/versoes/${n}`), { ...config, versao: n, escopo: 'contabilidade', criado: FieldValue.serverTimestamp(), criadoPor: actor.uid });
      audit(tx, { actor, acao: 'Configuração de diagnóstico alterada', cid, detalhe: `contabilidade · v${n}` });
      return { versao: n, escopo: 'contabilidade' };
    }
    requireAdmin(actor);
    const ref = db.doc('config/diagnostico'), current = await tx.get(ref);
    const n = current.exists ? int(current.data().versao, 'versão', { min: 1 }) + 1 : 1;
    if (d.baseVersion !== undefined && current.exists && d.baseVersion !== current.data().versao) fail('aborted', 'Configuração alterada por outra pessoa.');
    tx.set(ref, { ...config, versao: n, escopo: 'global', atualizado: FieldValue.serverTimestamp(), atualizadoPor: actor.uid });
    tx.create(db.doc(`config/diagnostico/versoes/${n}`), { ...config, versao: n, escopo: 'global', criado: FieldValue.serverTimestamp(), criadoPor: actor.uid });
    audit(tx, { actor, acao: 'Configuração global de diagnóstico alterada', detalhe: `global · v${n}` });
    return { versao: n, escopo: 'global' };
  });
});

module.exports = { DEFAULT_CONFIG, REQUIRED_IDS, validateConfig, currentConfig, getDiagnosticConfig, saveDiagnosticConfig };
