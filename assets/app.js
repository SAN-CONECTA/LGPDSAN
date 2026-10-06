(() => {
'use strict';
const VERSION = '1.0.0';
const KEY = 'lgpdsan:v1';
const ROLES = { consulta: 'Consulta', edicao: 'Edição', admin: 'Administrador' };
const STATUS = ['Rascunho', 'Em vigor', 'Em revisão', 'Arquivado'];
const PRIOR = ['Baixa', 'Média', 'Alta'];
const FIELDS = [['titulo', 'Título'], ['categoria', 'Categoria'], ['descricao', 'Descrição / procedimento'],
  ['status', 'Status'], ['prioridade', 'Prioridade'], ['responsavel', 'Responsável'], ['prazo', 'Prazo'], ['evidencias', 'Evidências (links/referências)']];

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const fmt = t => t ? new Date(t).toLocaleString('pt-BR') : '—';
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().slice(0, 10);

let db = null, me = null;

/* ---------- persistência ---------- */
function load() { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {} return null; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Não foi possível salvar: armazenamento do navegador indisponível ou cheio.'); }
}
async function hash(pw, salt) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pw));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function mkUser(nome, email, role, pw) {
  const salt = uid();
  return { id: uid(), nome, email: email.toLowerCase().trim(), role, salt, hash: await hash(pw, salt), ativo: true, fails: 0, lockUntil: 0, criado: now() };
}
async function seed() {
  const cats = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores', 'Segurança da Informação',
    'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura', 'Mapeamento de Dados'];
  const users = [await mkUser('Administrador Demo', 'admin@demo.local', 'admin', 'admin123'),
    await mkUser('Editor Demo', 'editor@demo.local', 'edicao', 'editor123'),
    await mkUser('Consulta Demo', 'consulta@demo.local', 'consulta', 'consulta123')];
  db = { schema: 1, categorias: cats, users, records: [], audit: [] };
  const adm = users[0];
  const ex = [
    ['Política interna de privacidade', 'Governança e Políticas', 'Exemplo: descrever finalidades, bases legais e papéis (controlador, operador, encarregado) do escritório.', 'Em vigor', 'Alta'],
    ['Procedimento de atendimento a titulares', 'Direitos dos Titulares', 'Exemplo: canal de recebimento, validação de identidade, prazos internos e modelo de resposta.', 'Rascunho', 'Alta'],
    ['Cláusulas de proteção de dados em contratos de fornecedores', 'Contratos e Operadores', 'Exemplo: checklist de cláusulas mínimas para operadores que tratam dados em nome do escritório.', 'Em revisão', 'Média']
  ];
  ex.forEach(([titulo, categoria, descricao, status, prioridade]) => {
    const snap = { titulo, categoria, descricao, status, prioridade, responsavel: adm.nome, prazo: '', evidencias: '' };
    const r = { id: uid(), criado: now(), deleted: false, versions: [{ n: 1, snap, autor: adm.nome, autorId: adm.id, quando: now(), just: 'Registro de exemplo (seed).' }] };
    db.records.push(r);
  });
  save();
}

/* ---------- permissões ---------- */
const can = {
  edit: () => me && me.role !== 'consulta',
  admin: () => me && me.role === 'admin',
  export: () => me && me.role !== 'consulta',
  auditFull: () => me && me.role !== 'consulta',
  editRec: r => me && (me.role === 'admin' || (me.role === 'edicao' && cur(r).status !== 'Arquivado'))
};
const cur = r => r.versions[r.versions.length - 1].snap;
const catList = () => db.categorias.slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* ---------- auditoria ---------- */
function log(acao, rec, detalhe) {
  db.audit.push({ id: uid(), ts: now(), user: me ? me.nome : 'sistema', userId: me ? me.id : null, role: me ? me.role : '',
    acao, recId: rec ? rec.id : null, recTitulo: rec ? cur(rec).titulo : '', detalhe: detalhe || '' });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
}

/* ---------- utilidades de UI ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500); }
function modal(html, mount) {
  const d = document.createElement('dialog');
  d.innerHTML = html; document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal(); if (mount) mount(d); return d;
}
function confirmBox(msg, label, onOk, danger = true) {
  modal(`<h3>Confirmar</h3><p>${esc(msg)}</p><div class="actions"><button class="${danger ? 'danger' : 'primary'}" id="ok">${esc(label)}</button><button id="no">Cancelar</button></div>`,
    d => { $('#no', d).onclick = () => d.close(); $('#ok', d).onclick = () => { d.close(); onOk(); }; });
}
const opts = (arr, sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const statusTag = s => `<span class="tag ${{ 'Em vigor': 'ok', 'Em revisão': 'warn', 'Rascunho': '', 'Arquivado': 'brand' }[s] || ''}">${esc(s)}</span>`;
const priorTag = p => `<span class="tag ${p === 'Alta' ? 'bad' : p === 'Média' ? 'warn' : ''}">${esc(p)}</span>`;
const overdue = r => { const c = cur(r); return c.prazo && c.prazo < today() && c.status !== 'Arquivado' && c.status !== 'Em vigor'; };

/* diff por palavras (LCS) */
function wordDiff(a, b) {
  const A = String(a ?? '').split(/(\s+)/), B = String(b ?? '').split(/(\s+)/);
  if (A.length * B.length > 4e6) return `<del>${esc(a)}</del> <ins>${esc(b)}</ins>`;
  const m = A.length, n = B.length, L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, out = '';
  while (i < m && j < n) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out += `<del>${esc(A[i++])}</del>`;
    else out += `<ins>${esc(B[j++])}</ins>`;
  }
  while (i < m) out += `<del>${esc(A[i++])}</del>`;
  while (j < n) out += `<ins>${esc(B[j++])}</ins>`;
  return out;
}

/* ---------- roteamento ---------- */
const app = $('#app');
const routes = [
  ['#/', 'Painel', renderDash], ['#/registros', 'Registros', renderList], ['#/auditoria', 'Auditoria', renderAudit],
  ['#/usuarios', 'Usuários', renderUsers, 'admin'], ['#/categorias', 'Categorias', renderCats, 'admin'],
  ['#/backup', 'Backup e retenção', renderBackup, 'admin'], ['#/sobre', 'Sobre / versão', renderAbout]
];
function route() {
  if (!me) return renderLogin();
  const h = location.hash || '#/';
  let view, main = h;
  if (h.startsWith('#/registro/')) { view = () => renderRecord(h.split('/')[2]); main = '#/registros'; }
  else {
    const r = routes.find(x => x[0] === h) || routes[0];
    if (r[3] === 'admin' && !can.admin()) { view = () => `<h1>Acesso negado</h1><p class="muted">Seu perfil não permite acessar esta área.</p>`; }
    else view = r[2];
  }
  const nav = routes.filter(r => r[3] !== 'admin' || can.admin())
    .map(r => `<a href="${r[0]}" class="${r[0] === main ? 'on' : ''}">${r[1]}</a>`).join('');
  app.innerHTML = `<div class="shell"><aside class="side"><div class="brand"><i>🛡</i><span>LGPDSAN</span></div>
    <nav class="nav">${nav}</nav>
    <div class="who small"><b>${esc(me.nome)}</b><br><span class="muted">${ROLES[me.role]} · v${VERSION}</span><br><button class="link" id="out">Sair</button></div></aside>
    <main id="main"></main></div>`;
  $('#out').onclick = logout;
  const html = view();
  $('#main').innerHTML = typeof html === 'string' ? html : '';
  const mount = $('#main').__mount; if (mount) mount();
  if (typeof html === 'string') bindView(h);
}
let bind = null;
function bindView() { if (bind) { const f = bind; bind = null; f(); } }
window.addEventListener('hashchange', route);

/* ---------- login ---------- */
function renderLogin() {
  app.innerHTML = `<div class="login"><div class="card"><div class="brand"><i>🛡</i><span>LGPDSAN · Conformidade LGPD</span></div>
    <form id="f"><label for="em">E-mail</label><input id="em" type="email" required autocomplete="username">
    <label for="pw">Senha</label><input id="pw" type="password" required autocomplete="current-password">
    <p id="err" class="small" style="color:var(--bad);min-height:1.2em"></p>
    <button class="primary" style="width:100%">Entrar</button></form>
    <div class="notice small" style="margin-top:1rem"><b>Versão ${VERSION} · protótipo.</b> Os dados ficam apenas neste navegador e o login não é segurança real.
    <b>Não cadastre dados pessoais reais.</b><br><br>Contas de demonstração:<br>admin@demo.local / admin123<br>editor@demo.local / editor123<br>consulta@demo.local / consulta123</div></div></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const u = db.users.find(x => x.email === $('#em').value.toLowerCase().trim());
    const err = $('#err');
    if (!u) { err.textContent = 'E-mail ou senha inválidos.'; return; }
    if (!u.ativo) { err.textContent = 'Conta bloqueada. Procure o administrador.'; return; }
    if (u.lockUntil > Date.now()) { err.textContent = 'Muitas tentativas. Aguarde alguns minutos.'; return; }
    if (await hash($('#pw').value, u.salt) !== u.hash) {
      u.fails++; if (u.fails >= 5) { u.lockUntil = Date.now() + 5 * 60e3; u.fails = 0; }
      me = null; db.audit.push({ id: uid(), ts: now(), user: u.nome, userId: u.id, role: u.role, acao: 'Login falhou', recId: null, recTitulo: '', detalhe: '' });
      save(); err.textContent = 'E-mail ou senha inválidos.'; return;
    }
    u.fails = 0; me = u; sessionStorage.setItem('lgpdsan:uid', u.id); log('Login'); save();
    location.hash = '#/'; route();
  };
}
function logout() { log('Logout'); save(); me = null; sessionStorage.removeItem('lgpdsan:uid'); location.hash = '#/'; route(); }

/* ---------- painel ---------- */
function renderDash() {
  const rs = db.records.filter(r => !r.deleted);
  const by = s => rs.filter(r => cur(r).status === s).length;
  const od = rs.filter(overdue);
  const mine = rs.filter(r => cur(r).responsavel === me.nome && cur(r).status !== 'Arquivado');
  const recent = visibleAudit().slice(-6).reverse();
  return `<div class="bar"><div><h1>Painel</h1><p class="muted">Visão geral da conformidade do escritório.</p></div>
    ${can.edit() ? '<a class="btn primary" href="#/registros" onclick="sessionStorage.setItem(\'lgpdsan:new\',1)">+ Novo registro</a>' : ''}</div>
    <div class="grid"><div class="stat"><b>${rs.length}</b>Registros ativos</div>
    <div class="stat"><b>${by('Em vigor')}</b>Em vigor</div><div class="stat"><b>${by('Em revisão')}</b>Em revisão</div>
    <div class="stat"><b style="color:${od.length ? 'var(--bad)' : 'inherit'}">${od.length}</b>Prazos vencidos</div></div>
    <div class="card"><h2>Prazos vencidos</h2>${od.length ? miniTable(od) : '<p class="muted">Nenhum prazo vencido.</p>'}</div>
    <div class="card"><h2>Atribuídos a mim</h2>${mine.length ? miniTable(mine) : '<p class="muted">Nada atribuído a você.</p>'}</div>
    <div class="card"><h2>Atividade recente</h2>${recent.length ? recent.map(a => `<div class="fieldrow small"><b>${esc(a.acao)}</b> · ${esc(a.user)} · <span class="muted">${fmt(a.ts)}</span><br>${esc(a.recTitulo)}</div>`).join('') : '<p class="muted">Sem atividade.</p>'}</div>`;
}
const miniTable = rs => `<div class="tablewrap"><table><tr><th>Registro</th><th>Status</th><th>Prazo</th></tr>${rs.map(r => `<tr><td><a href="#/registro/${r.id}">${esc(cur(r).titulo)}</a></td><td>${statusTag(cur(r).status)}</td><td>${fmtD(cur(r).prazo)}</td></tr>`).join('')}</table></div>`;

/* ---------- lista de registros ---------- */
function renderList() {
  bind = () => {
    const q = $('#q'), fc = $('#fc'), fs = $('#fs'), fp = $('#fp'), fd = $('#fd');
    const draw = () => {
      const t = q.value.toLowerCase();
      let rs = db.records.filter(r => fd.value === 'del' ? r.deleted : !r.deleted);
      rs = rs.filter(r => { const c = cur(r);
        return (!fc.value || c.categoria === fc.value) && (!fs.value || c.status === fs.value) && (!fp.value || c.prioridade === fp.value) &&
          (!t || [c.titulo, c.descricao, c.responsavel, c.evidencias, c.categoria].join(' ').toLowerCase().includes(t)); });
      $('#cnt').textContent = rs.length + ' registro(s)';
      $('#rows').innerHTML = rs.map(r => { const c = cur(r);
        return `<tr><td><a href="#/registro/${r.id}">${esc(c.titulo)}</a>${r.deleted ? ' <span class="tag bad">excluído</span>' : ''}<br><span class="muted small">${esc(c.categoria)}</span></td>
        <td>${statusTag(c.status)}</td><td>${priorTag(c.prioridade)}</td><td>${esc(c.responsavel) || '—'}</td>
        <td>${overdue(r) ? '<span class="tag bad">vencido</span> ' : ''}${fmtD(c.prazo)}</td><td>v${r.versions.length}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Nenhum registro encontrado.</td></tr>';
      window.__list = rs;
    };
    [q, fc, fs, fp, fd].forEach(el => el.addEventListener('input', draw)); draw();
    const nb = $('#new'); if (nb) nb.onclick = () => recordForm();
    const ex = $('#exp'); if (ex) ex.onclick = () => exportCSV(window.__list);
    const pr = $('#prn'); if (pr) pr.onclick = () => window.print();
    if (sessionStorage.getItem('lgpdsan:new') && can.edit()) { sessionStorage.removeItem('lgpdsan:new'); recordForm(); }
  };
  return `<div class="bar"><div><h1>Registros</h1><p class="muted" id="cnt"></p></div><div class="actions" style="margin:0">
    ${can.edit() ? '<button class="primary" id="new">+ Novo registro</button>' : ''}
    ${can.export() ? '<button id="exp">Exportar CSV</button>' : ''}<button id="prn">Imprimir relatório</button></div></div>
    <div class="filters"><div><label for="q">Pesquisa</label><input id="q" type="search" placeholder="Palavra-chave…"></div>
    <div><label for="fc">Categoria</label><select id="fc">${opts(catList(), '', 'Todas')}</select></div>
    <div><label for="fs">Status</label><select id="fs">${opts(STATUS, '', 'Todos')}</select></div>
    <div><label for="fp">Prioridade</label><select id="fp">${opts(PRIOR, '', 'Todas')}</select></div>
    <div><label for="fd">Exibir</label><select id="fd"><option value="">Ativos</option>${can.admin() ? '<option value="del">Excluídos</option>' : ''}</select></div></div>
    <div class="card tablewrap"><table><thead><tr><th>Registro</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Versão</th></tr></thead><tbody id="rows"></tbody></table></div>`;
}
function exportCSV(rs) {
  if (!can.export()) return;
  const q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1") + '"';
  const head = ['Título', 'Categoria', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Versão', 'Descrição', 'Evidências'];
  const lines = [head.map(q).join(';')].concat(rs.map(r => { const c = cur(r);
    return [c.titulo, c.categoria, c.status, c.prioridade, c.responsavel, c.prazo, r.versions.length, c.descricao, c.evidencias].map(q).join(';'); }));
  download('lgpdsan-registros-' + today() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  log('Exportação CSV', null, rs.length + ' registro(s)'); save();
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- formulário de registro ---------- */
function recordForm(rec) {
  const c = rec ? cur(rec) : { titulo: '', categoria: catList()[0] || '', descricao: '', status: 'Rascunho', prioridade: 'Média', responsavel: me.nome, prazo: '', evidencias: '' };
  const statusOpts = me.role === 'admin' ? STATUS : STATUS.filter(s => s !== 'Arquivado');
  modal(`<h3>${rec ? 'Editar registro' : 'Novo registro'}</h3><form id="rf">
    <label for="t">Título *</label><input id="t" required maxlength="200" value="${esc(c.titulo)}">
    <div class="row"><div><label for="c">Categoria *</label><select id="c" required>${opts(catList(), c.categoria)}</select></div>
    <div><label for="s">Status</label><select id="s">${opts(statusOpts, c.status)}</select></div>
    <div><label for="p">Prioridade</label><select id="p">${opts(PRIOR, c.prioridade)}</select></div></div>
    <div class="row"><div><label for="r">Responsável</label><select id="r">${opts(db.users.filter(u => u.ativo).map(u => u.nome), c.responsavel, '— ninguém —')}</select></div>
    <div><label for="z">Prazo</label><input id="z" type="date" value="${esc(c.prazo)}"></div></div>
    <label for="d">Descrição / procedimento</label><textarea id="d">${esc(c.descricao)}</textarea>
    <label for="e">Evidências (um link ou referência por linha — v1.0 não armazena arquivos)</label><textarea id="e" style="min-height:70px">${esc(c.evidencias)}</textarea>
    <label for="j">Justificativa da alteração *</label><input id="j" required maxlength="300" placeholder="${rec ? 'Por que está alterando?' : 'Criação inicial'}">
    <div class="actions"><button class="primary">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`,
    d => {
      $('#x', d).onclick = () => d.close();
      $('#rf', d).onsubmit = e => {
        e.preventDefault();
        const snap = { titulo: $('#t', d).value.trim(), categoria: $('#c', d).value, descricao: $('#d', d).value, status: $('#s', d).value,
          prioridade: $('#p', d).value, responsavel: $('#r', d).value, prazo: $('#z', d).value, evidencias: $('#e', d).value };
        const just = $('#j', d).value.trim();
        if (rec) {
          if (rec.deleted || !can.editRec(rec)) return toast('Sem permissão para editar este registro.');
          const before = cur(rec), changed = FIELDS.filter(([k]) => before[k] !== snap[k]).map(([, l]) => l);
          if (!changed.length) { d.close(); return toast('Nenhuma alteração.'); }
          rec.versions.push({ n: rec.versions.length + 1, snap, autor: me.nome, autorId: me.id, quando: now(), just });
          log('Edição', rec, `v${rec.versions.length} · ${changed.join(', ')} · ${just}`); toast('Nova versão v' + rec.versions.length + ' criada.');
        } else {
          rec = { id: uid(), criado: now(), deleted: false, versions: [{ n: 1, snap, autor: me.nome, autorId: me.id, quando: now(), just }] };
          db.records.push(rec); log('Criação', rec, just); toast('Registro criado.');
        }
        save(); d.close(); location.hash = '#/registro/' + rec.id; route();
      };
    });
}

/* ---------- detalhe do registro ---------- */
function renderRecord(id) {
  const rec = db.records.find(r => r.id === id);
  if (!rec) return `<h1>Registro não encontrado</h1><p><a href="#/registros">Voltar</a></p>`;
  if (rec.deleted && !can.admin()) return `<h1>Registro não disponível</h1><p><a href="#/registros">Voltar</a></p>`;
  const c = cur(rec), vs = rec.versions;
  bind = () => {
    const e = $('#edit'); if (e) e.onclick = () => recordForm(rec);
    const dl = $('#del'); if (dl) dl.onclick = () => confirmBox('Excluir logicamente este registro? Ele sai das listas, mas pode ser restaurado.', 'Excluir', () => { rec.deleted = true; log('Exclusão lógica', rec); save(); route(); });
    const rs = $('#rest'); if (rs) rs.onclick = () => { rec.deleted = false; log('Registro restaurado', rec); save(); route(); };
    const hd = $('#hard'); if (hd) hd.onclick = () => confirmBox('Excluir DEFINITIVAMENTE, com todo o histórico de versões? Esta ação não pode ser desfeita. A auditoria é mantida.', 'Excluir definitivamente', () => {
      log('Exclusão permanente', rec); db.records = db.records.filter(x => x !== rec); save(); location.hash = '#/registros'; route(); });
    document.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => {
      const v = vs[+b.dataset.restore - 1];
      confirmBox(`Restaurar o conteúdo da v${v.n}? Será criada uma nova versão (o histórico não é apagado).`, 'Restaurar', () => {
        const st = (me.role !== 'admin' && v.snap.status === 'Arquivado') ? 'Em revisão' : v.snap.status;
        rec.versions.push({ n: vs.length + 1, snap: { ...v.snap, status: st }, autor: me.nome, autorId: me.id, quando: now(), just: `Restauração da v${v.n}` });
        log('Restauração de versão', rec, `v${v.n} → v${rec.versions.length}`); save(); route(); }, false);
    });
    const cmp = () => {
      const a = vs[+$('#va').value - 1].snap, b = vs[+$('#vb').value - 1].snap;
      const ch = FIELDS.filter(([k]) => (a[k] || '') !== (b[k] || ''));
      $('#diff').innerHTML = ch.length ? ch.map(([k, l]) => `<div class="fieldrow"><b>${l}</b><div class="diff pre">${wordDiff(a[k], b[k])}</div></div>`).join('') : '<p class="muted">Sem diferenças entre as versões selecionadas.</p>';
    };
    if (vs.length > 1) { $('#va').onchange = $('#vb').onchange = cmp; cmp(); }
  };
  const vopts = sel => vs.map(v => `<option value="${v.n}" ${v.n === sel ? 'selected' : ''}>v${v.n} · ${fmt(v.quando)}</option>`).join('');
  return `<p class="small"><a href="#/registros">← Registros</a></p>
    <div class="bar"><div><h1>${esc(c.titulo)} ${rec.deleted ? '<span class="tag bad">excluído</span>' : ''}</h1>
    <p>${statusTag(c.status)} ${priorTag(c.prioridade)} <span class="tag">${esc(c.categoria)}</span> <span class="tag brand">v${vs.length}</span></p></div>
    <div class="actions" style="margin:0">
    ${!rec.deleted && can.editRec(rec) ? '<button class="primary" id="edit">Editar</button>' : ''}
    ${!rec.deleted && can.admin() ? '<button class="danger" id="del">Excluir</button>' : ''}
    ${rec.deleted && can.admin() ? '<button id="rest">Restaurar registro</button><button class="danger" id="hard">Excluir definitivamente</button>' : ''}</div></div>
    ${overdue(rec) ? '<div class="notice bad">Prazo vencido em ' + fmtD(c.prazo) + '.</div>' : ''}
    <div class="card"><div class="row small"><div><span class="muted">Responsável</span><br>${esc(c.responsavel) || '—'}</div><div><span class="muted">Prazo</span><br>${fmtD(c.prazo)}</div>
    <div><span class="muted">Criado em</span><br>${fmt(rec.criado)}</div></div>
    <h3 style="margin-top:1rem">Descrição / procedimento</h3><div class="pre">${esc(c.descricao) || '<span class="muted">—</span>'}</div>
    <h3 style="margin-top:1rem">Evidências</h3><div class="pre">${esc(c.evidencias) || '<span class="muted">—</span>'}</div></div>
    <div class="card"><h2>Histórico de versões</h2><div class="tablewrap"><table><tr><th>Versão</th><th>Quando</th><th>Autor</th><th>Justificativa</th><th></th></tr>
    ${vs.slice().reverse().map(v => `<tr><td>v${v.n}${v.n === vs.length ? ' <span class="tag ok">atual</span>' : ''}</td><td>${fmt(v.quando)}</td><td>${esc(v.autor)}</td><td>${esc(v.just)}</td>
    <td>${can.edit() && !rec.deleted && v.n !== vs.length && can.editRec(rec) ? `<button data-restore="${v.n}">Restaurar</button>` : ''}</td></tr>`).join('')}</table></div></div>
    ${vs.length > 1 ? `<div class="card"><h2>Comparar versões</h2><div class="row"><div><label for="va">De</label><select id="va">${vopts(vs.length - 1)}</select></div>
    <div><label for="vb">Para</label><select id="vb">${vopts(vs.length)}</select></div></div><div id="diff"></div></div>` : ''}
    <div class="card"><h2>Auditoria deste registro</h2>${auditRows(db.audit.filter(a => a.recId === rec.id).slice().reverse()) }</div>`;
}

/* ---------- auditoria ---------- */
function visibleAudit() {
  if (can.auditFull()) return db.audit;
  const ok = new Set(db.records.filter(r => !r.deleted).map(r => r.id));
  return db.audit.filter(a => a.recId && ok.has(a.recId));
}
const auditRows = list => list.length ? `<div class="tablewrap"><table><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Detalhe</th></tr>
  ${list.map(a => `<tr><td>${fmt(a.ts)}</td><td>${esc(a.user)}<br><span class="muted small">${esc(ROLES[a.role] || '')}</span></td><td>${esc(a.acao)}</td><td>${esc(a.recTitulo)}</td><td>${esc(a.detalhe)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Sem eventos.</p>';
function renderAudit() {
  bind = () => { const q = $('#aq'), draw = () => { const t = q.value.toLowerCase();
    const l = visibleAudit().slice().reverse().filter(a => !t || [a.user, a.acao, a.recTitulo, a.detalhe].join(' ').toLowerCase().includes(t)).slice(0, 500);
    $('#alist').innerHTML = auditRows(l); }; q.oninput = draw; draw(); };
  return `<div class="bar"><div><h1>Auditoria</h1><p class="muted">${can.auditFull() ? 'Log completo (últimos 500 eventos exibidos).' : 'Exibindo apenas eventos de registros que você pode acessar.'}</p></div></div>
    <div class="card"><label for="aq" style="margin-top:0">Filtrar</label><input id="aq" type="search" placeholder="Usuário, ação, registro…"><div id="alist" style="margin-top:.75rem"></div></div>`;
}

/* ---------- usuários (admin) ---------- */
const activeAdmins = () => db.users.filter(u => u.ativo && u.role === 'admin');
function renderUsers() {
  bind = () => {
    $('#nu').onclick = () => userForm();
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => userAction(b.dataset.a, db.users.find(u => u.id === b.dataset.u)));
  };
  return `<div class="bar"><div><h1>Usuários</h1><p class="muted">Perfis: Consulta, Edição, Administrador.</p></div><button class="primary" id="nu">+ Novo usuário</button></div>
    <div class="card tablewrap"><table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr>
    ${db.users.map(u => `<tr><td>${esc(u.nome)}${u.id === me.id ? ' <span class="tag brand">você</span>' : ''}</td><td>${esc(u.email)}</td><td>${ROLES[u.role]}</td>
    <td>${u.ativo ? '<span class="tag ok">ativo</span>' : '<span class="tag bad">bloqueado</span>'}</td>
    <td class="actions" style="margin:0"><button data-u="${u.id}" data-a="edit">Editar</button><button data-u="${u.id}" data-a="pw">Redefinir senha</button>
    <button data-u="${u.id}" data-a="toggle">${u.ativo ? 'Bloquear' : 'Desbloquear'}</button><button class="danger" data-u="${u.id}" data-a="rm">Remover</button></td></tr>`).join('')}</table></div>`;
}
function userForm(u) {
  modal(`<h3>${u ? 'Editar usuário' : 'Novo usuário'}</h3><form id="uf"><label for="n">Nome *</label><input id="n" required value="${esc(u?.nome)}">
    <label for="m">E-mail *</label><input id="m" type="email" required value="${esc(u?.email)}">
    <label for="r">Perfil</label><select id="r">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    ${u ? '' : '<label for="p">Senha inicial * (mín. 10 caracteres)</label><input id="p" type="password" minlength="10" required autocomplete="new-password">'}
    <div class="actions"><button class="primary">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
    $('#x', d).onclick = () => d.close();
    $('#uf', d).onsubmit = async e => {
      e.preventDefault();
      const email = $('#m', d).value.toLowerCase().trim(), role = $('#r', d).value;
      if (db.users.some(x => x.email === email && x !== u)) return toast('Já existe usuário com este e-mail.');
      if (u) {
        if (u.role === 'admin' && role !== 'admin' && activeAdmins().length === 1) return toast('Mantenha ao menos um administrador ativo.');
        const before = ROLES[u.role]; u.nome = $('#n', d).value.trim(); u.email = email; u.role = role;
        log('Usuário editado', null, `${u.email} · ${before} → ${ROLES[role]}`);
      } else {
        const nu = await mkUser($('#n', d).value.trim(), email, role, $('#p', d).value); db.users.push(nu); log('Usuário criado', null, `${nu.email} · ${ROLES[role]}`);
      }
      save(); d.close(); route();
    };
  });
}
function userAction(a, u) {
  if (a === 'edit') return userForm(u);
  if (a === 'pw') return modal(`<h3>Redefinir senha de ${esc(u.nome)}</h3><form id="pf"><label for="p">Nova senha (mín. 10 caracteres)</label><input id="p" type="password" minlength="10" required autocomplete="new-password">
    <div class="actions"><button class="primary">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
    $('#x', d).onclick = () => d.close();
    $('#pf', d).onsubmit = async e => { e.preventDefault(); u.salt = uid(); u.hash = await hash($('#p', d).value, u.salt); u.fails = 0; u.lockUntil = 0;
      log('Senha redefinida', null, u.email); save(); d.close(); toast('Senha redefinida.'); };
  });
  if (a === 'toggle') {
    if (u.ativo && u.role === 'admin' && activeAdmins().length === 1) return toast('Mantenha ao menos um administrador ativo.');
    if (u.id === me.id) return toast('Você não pode bloquear a si mesmo.');
    u.ativo = !u.ativo; log(u.ativo ? 'Usuário desbloqueado' : 'Usuário bloqueado', null, u.email); save(); return route();
  }
  if (a === 'rm') {
    if (u.id === me.id) return toast('Você não pode remover a si mesmo.');
    if (u.ativo && u.role === 'admin' && activeAdmins().length === 1) return toast('Mantenha ao menos um administrador ativo.');
    confirmBox(`Remover ${u.nome}? O histórico de auditoria é preservado.`, 'Remover', () => { db.users = db.users.filter(x => x !== u); log('Usuário removido', null, u.email); save(); route(); });
  }
}

/* ---------- categorias (admin) ---------- */
function renderCats() {
  bind = () => {
    $('#cf').onsubmit = e => { e.preventDefault(); const v = $('#cn').value.trim();
      if (!v || db.categorias.includes(v)) return toast('Informe um nome novo.'); db.categorias.push(v); log('Categoria criada', null, v); save(); route(); };
    document.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => {
      const n = b.dataset.rc, used = db.records.some(r => r.versions.some(v => v.snap.categoria === n));
      if (used) return toast('Categoria em uso por registros/versões; não pode ser removida.');
      db.categorias = db.categorias.filter(x => x !== n); log('Categoria removida', null, n); save(); route(); });
  };
  return `<div class="bar"><div><h1>Categorias</h1></div></div><div class="card"><form id="cf" class="row" style="align-items:end"><div><label for="cn" style="margin-top:0">Nova categoria</label><input id="cn" maxlength="80"></div><div><button class="primary">Adicionar</button></div></form></div>
    <div class="card tablewrap"><table>${catList().map(c => `<tr><td>${esc(c)}</td><td style="text-align:right"><button class="danger" data-rc="${esc(c)}">Remover</button></td></tr>`).join('')}</table></div>`;
}

/* ---------- backup (admin) ---------- */
function renderBackup() {
  bind = () => {
    $('#bk').onclick = () => { download('lgpdsan-backup-' + today() + '.json', JSON.stringify(db), 'application/json'); log('Backup exportado'); save(); };
    $('#im').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!Array.isArray(d.users) || !Array.isArray(d.records) || !Array.isArray(d.audit) || !Array.isArray(d.categorias) || !d.users.some(u => u.role === 'admin' && u.ativo)) throw 0;
        confirmBox('Importar substitui TODOS os dados atuais deste navegador. Continuar?', 'Importar', () => {
          db = d; me = db.users.find(u => u.id === me.id) || db.users.find(u => u.role === 'admin'); log('Backup importado'); save(); route(); });
      } catch (x) { toast('Arquivo inválido.'); }
      e.target.value = '';
    };
    $('#rs').onclick = () => confirmBox('Apagar todos os dados e voltar ao estado inicial de demonstração?', 'Apagar tudo', async () => {
      localStorage.removeItem(KEY); sessionStorage.clear(); me = null; await seed(); location.hash = '#/'; route(); });
  };
  return `<div class="bar"><div><h1>Backup e retenção</h1></div></div>
    <div class="notice">Na v1.0 os dados existem <b>somente neste navegador</b>. Sem backup, limpar o histórico do navegador apaga tudo. Políticas de retenção automáticas ficam para a v2.0 (exigem servidor).</div>
    <div class="card"><h2>Backup</h2><div class="actions" style="margin:0"><button class="primary" id="bk">Exportar backup (JSON)</button>
    <label class="btn" style="margin:0;font-weight:400">Importar backup<input id="im" type="file" accept="application/json" hidden></label></div>
    <p class="muted small">O backup contém hashes de senha e todo o histórico. Guarde-o como dado sensível.</p></div>
    <div class="card"><h2>Zona de risco</h2><button class="danger" id="rs">Restaurar estado de demonstração</button></div>`;
}

/* ---------- sobre ---------- */
function renderAbout() {
  return `<div class="bar"><div><h1>Sobre</h1><p class="muted">LGPDSAN v${VERSION}</p></div></div>
    <div class="card"><h2>Escopo da v1.0</h2><p>Registro de boas práticas LGPD com perfis (Consulta, Edição, Administrador), versionamento automático com justificativa, comparação e restauração de versões, exclusão lógica/permanente, auditoria, gestão de usuários e categorias, exportação CSV e backup JSON.</p></div>
    <div class="card"><h2>Limitações conhecidas</h2><ul><li>Sem servidor: dados só no navegador; login e permissões são aplicados no cliente e <b>não impedem</b> quem tem acesso ao navegador.</li>
    <li>Sem upload de arquivos (apenas links/referências), e-mails automáticos, links temporários e exportação PDF/Excel nativa (CSV abre no Excel).</li>
    <li>Não use dados pessoais reais até existir backend com autenticação e criptografia (planejado para v2.0).</li></ul></div>
    <div class="card"><h2>Versionamento do sistema</h2><p>Segue SemVer: <code>MAIOR.MENOR.CORREÇÃO</code>. Veja o CHANGELOG no repositório.</p></div>`;
}

/* ---------- inicialização ---------- */
(async function init() {
  if (!window.crypto || !crypto.subtle) { app.innerHTML = '<div class="login"><div class="card">Este navegador não oferece suporte necessário (Web Crypto). Use HTTPS ou um navegador atual.</div></div>'; return; }
  db = load(); if (!db) await seed();
  const id = sessionStorage.getItem('lgpdsan:uid'); me = id ? db.users.find(u => u.id === id && u.ativo) || null : null;
  route();
})();
})();
