import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp } from 'firebase/app';
import { seed, clientAs, admin, negado, invalido } from './helpers.mjs';

let S, ed, adm, local;
before(async () => {
  S = await seed();
  const u = await admin.auth.createUser({ uid: `local-${Date.now()}`, email: `local-${Date.now()}@teste.local`, password: 'senha-de-teste-123' });
  await admin.db.doc(`users/${u.uid}`).set({ nome: 'Admin local', email: u.email, role: 'admin_local', ativo: true, contabilidades: [S.A] });
  [ed, adm, local] = await Promise.all([clientAs(S.users.edicaoA), clientAs(S.users.admin), clientAs({ uid: u.uid, email: u.email })]);
});
after(async () => { await Promise.all([ed, adm, local].map(c => c && deleteApp(c.app))); });

async function config(c) {
  return (await c.call('getDiagnosticConfig', { cid: S.A })).global;
}

test('configuração global é versionada e só o administrador global altera', async () => {
  const current = await config(adm);
  current.questions[4].condition = { questionId: 'dgPorte', equals: 'MEI' };
  const out = await adm.call('saveDiagnosticConfig', { cid: S.A, config: current });
  assert.equal(out.escopo, 'global');
  assert.ok(out.versao >= 1);
  assert.equal((await admin.db.doc(`config/diagnostico/versoes/${out.versao}`).get()).exists, true);
  await assert.rejects(ed.call('saveDiagnosticConfig', { cid: S.A, config: current }), negado);
  const eventos = (await admin.db.collection('auditoria').where('acao', '==', 'Configuração global de diagnóstico alterada').get()).docs;
  assert.ok(eventos.length >= 1);
});

test('administração local altera configuração da própria contabilidade, sem tocar controle obrigatório', async () => {
  const current = await config(adm);
  current.questions[4].label = 'Pergunta local sobre saúde';
  const out = await local.call('saveDiagnosticConfig', { cid: S.A, config: current });
  assert.equal(out.escopo, 'contabilidade');
  const saved = await admin.db.doc(`contabilidades/${S.A}/configDiagnostico/atual`).get();
  assert.equal(saved.data().questions.find(q => q.id === 'dgSaude').label, 'Pergunta local sobre saúde');
  const invalid = structuredClone(current);
  invalid.questions.find(q => q.id === 'dgPorte').label = 'Controle alterado';
  await assert.rejects(local.call('saveDiagnosticConfig', { cid: S.A, config: invalid }), invalido);
  await assert.rejects(local.call('saveDiagnosticConfig', { cid: uidOther(S.B), config: current }), negado);
});

function uidOther(cid) { return cid; }

test('plano gera tarefa condicional, evita duplicação e preserva concluída', async () => {
  const rec = await ed.call('saveRecord', {
    cid: S.A,
    snap: { titulo: 'Diagnóstico plano', categoria: 'Governança e Políticas', descricao: 'x', status: 'Em revisão', prioridade: 'Alta', responsavel: '', prazo: '', revisao: '', evidencias: '',
      dados: { dgPorte: 'Demais', dgLimite: 'Sim', dgGrupo: 'Não', dgTitulares: 'Até 500', dgSaude: 'Não', dgExigiu: 'Não' } },
    just: 'teste plano'
  });
  const first = await ed.call('refreshActionPlan', { cid: S.A, recordId: rec.id });
  assert.equal(first.tarefas.length, 1);
  assert.equal(first.tarefas[0].requisito, 'Resolução CD/ANPD nº 2/2022');
  await ed.call('completeActionTask', { cid: S.A, recordId: rec.id, taskId: first.tarefas[0].id, status: 'concluida' });
  const second = await ed.call('refreshActionPlan', { cid: S.A, recordId: rec.id });
  assert.equal(second.tarefas.filter(t => t.status === 'concluida').length, 1);
  assert.equal((await admin.db.collection(`contabilidades/${S.A}/planosAcao/${rec.id}/versoes`).get()).size, 2);
});

test('plano é isolado por contabilidade', async () => {
  await assert.rejects(ed.call('getActionPlan', { cid: S.B, recordId: 'inexistente' }), negado);
  await assert.rejects(local.call('getActionPlan', { cid: S.B, recordId: 'inexistente' }), negado);
});

test('admin local não cria admin e não gerencia usuário fora da contabilidade', async () => {
  await assert.rejects(local.call('adminSaveUser', {
    nome: 'Tentativa admin',
    email: `bloqueio-admin-${Date.now()}@teste.local`,
    role: 'admin',
    contabilidades: []
  }), negado);
  await assert.rejects(local.call('adminSaveUser', {
    nome: 'Fora da contabilidade',
    email: `bloqueio-contab-${Date.now()}@teste.local`,
    role: 'edicao',
    contabilidades: [S.B]
  }), negado);
});
