import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit,
  serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js?v=2.9.0';
import { BIBLIO } from './biblioteca.js?v=2.9.0';
import { GUIAS, RESP, guiaDe, itensDe, fmtVal, progresso } from './guias.js?v=2.9.0';

const VERSION = '2.9.0';
const SITE = 'https://www.sanconecta.com';
const siteLink = (t = 'www.sanconecta.com') => `<a href="${SITE}" target="_blank" rel="noopener noreferrer">${t}</a>`;
const ROLES = { consulta: 'Consulta', edicao: 'Edição', admin: 'Administrador' };
const STATUS = ['Rascunho', 'Em vigor', 'Em revisão', 'Arquivado'];
const PRIOR = ['Baixa', 'Média', 'Alta'];
const DEFAULT_CATS = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores', 'Segurança da Informação',
  'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura', 'Mapeamento de Dados'];
const FIELDS = [['titulo', 'Título'], ['categoria', 'Categoria'], ['descricao', 'Descrição / procedimento'],
  ['status', 'Status'], ['prioridade', 'Prioridade'], ['responsavel', 'Responsável'], ['prazo', 'Prazo'], ['evidencias', 'Evidências (links/referências)']];
// campos comparáveis de um registro: os fixos + os itens do checklist da categoria
const fieldList = cat => { const g = guiaDe(cat); return g ? FIELDS.concat(itensDe(g).flatMap(i => i.tipo === 'sn' ? [['d:' + i.id, i.label], ['d:' + i.id + '#o', 'Observação: ' + i.label]] : [['d:' + i.id, i.label]])) : FIELDS; };
const fval = (snap, k) => k.startsWith('d:') ? fmtVal((snap.dados || {})[k.slice(2)]) : (snap[k] ?? '');
const FIRM_ACTS = new Set(['Exportação CSV', 'Backup exportado (contabilidade)']);

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tms = t => (t && t.toMillis ? t.toMillis() : t);
const fmt = t => t ? new Date(tms(t)).toLocaleString('pt-BR') : '—';
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().slice(0, 10);
const byName = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
auth.languageCode = 'pt-BR';
const fs = getFirestore(fbApp);

let me = null;
let cid = null; // contabilidade ativa
let db = { users: [], records: [], categorias: [], contabs: [], pessoas: [] };
let justSignedIn = false;

/* ---------- caminhos (tudo de uma contabilidade fica sob contabilidades/{cid}) ---------- */
const rcol = () => collection(fs, 'contabilidades', cid, 'registros');
const rdoc = id => doc(fs, 'contabilidades', cid, 'registros', id);
const vcol = id => collection(fs, 'contabilidades', cid, 'registros', id, 'versoes');
const vdoc = (id, n) => doc(fs, 'contabilidades', cid, 'registros', id, 'versoes', String(n));
const contabNome = id => (db.contabs.find(c => c.id === id) || {}).nome || '(removida)';

/* ---------- permissões ---------- */
const cur = r => r.snap;
const can = {
  edit: () => me && me.role !== 'consulta',
  admin: () => me && me.role === 'admin',
  export: () => me && me.role !== 'consulta',
  editRec: r => me && (me.role === 'admin' || (me.role === 'edicao' && cur(r).status !== 'Arquivado' && !r.deleted))
};
const catList = () => db.categorias.slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* ---------- auditoria (gravada no servidor, só criação) ---------- */
const isSys = (acao, rec) => !rec && !FIRM_ACTS.has(acao);
const aCol = sys => sys ? collection(fs, 'auditoria') : collection(fs, 'contabilidades', cid, 'auditoria');
function auditData(acao, rec, detalhe, sys) {
  return { ts: serverTimestamp(), userId: me.id, user: me.nome, role: me.role, acao, recId: rec ? rec.id : null,
    recTitulo: rec ? cur(rec).titulo : '', detalhe: detalhe || '', escopo: sys ? 'sistema' : 'registro', contabId: sys ? null : cid };
}
const auditOp = (batch, acao, rec, detalhe) => { const s = isSys(acao, rec); batch.set(doc(aCol(s)), auditData(acao, rec, detalhe, s)); };
const auditNow = (acao, rec, detalhe) => { const s = isSys(acao, rec); return setDoc(doc(aCol(s)), auditData(acao, rec, detalhe, s)); };

/* ---------- UI utilitários ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4500); }
function errMsg(e) {
  const c = e && e.code || '';
  if (c === 'permission-denied') return 'Operação negada: sem permissão ou o registro foi alterado por outra pessoa. Recarregue a página e tente de novo.';
  if (c === 'unavailable') return 'Sem conexão com o servidor. Tente novamente.';
  if (c === 'auth/email-already-in-use') return 'Este e-mail já existe no Authentication. Desbloqueie o usuário existente ou remova a conta no console do Firebase.';
  if (c === 'auth/weak-password') return 'Senha fraca.';
  return 'Erro: ' + (e && e.message || e);
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast(errMsg(e)); } };
function modal(html, mount) {
  const d = document.createElement('dialog');
  d.innerHTML = html; document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal(); if (mount) mount(d); return d;
}
function confirmBox(msg, label, onOk, danger = true) {
  modal(`<h3>Confirmar</h3><p>${esc(msg)}</p><div class="actions"><button class="${danger ? 'danger' : 'primary'}" id="ok">${esc(label)}</button><button id="no">Cancelar</button></div>`,
    d => { $('#no', d).onclick = () => d.close(); $('#ok', d).onclick = guard(async () => { d.close(); await onOk(); }); });
}
const opts = (arr, sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const statusTag = s => `<span class="tag ${{ 'Em vigor': 'ok', 'Em revisão': 'warn', 'Rascunho': '', 'Arquivado': 'brand' }[s] || ''}">${esc(s)}</span>`;
const priorTag = p => `<span class="tag ${p === 'Alta' ? 'bad' : p === 'Média' ? 'warn' : ''}">${esc(p)}</span>`;
const overdue = r => { const c = cur(r); return c.prazo && c.prazo < today() && c.status !== 'Arquivado' && c.status !== 'Em vigor'; };

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

/* ---------- carga de dados ---------- */
async function loadCore() {
  // contabilidades acessíveis: admin lê todas; os demais apenas as vinculadas ao seu perfil
  if (can.admin()) db.contabs = (await getDocs(collection(fs, 'contabilidades'))).docs.map(d => ({ id: d.id, ...d.data() }));
  else db.contabs = (await Promise.all((me.contabilidades || []).map(async id => {
    const s = await getDoc(doc(fs, 'contabilidades', id)); return s.exists() ? { id: s.id, ...s.data() } : null; }))).filter(Boolean);
  db.contabs.sort(byName);
  if (!db.contabs.some(c => c.id === cid)) {
    let saved = null; try { saved = sessionStorage.getItem('lgpdsan:cid'); } catch (e) {}
    cid = db.contabs.some(c => c.id === saved) ? saved : (db.contabs[0] ? db.contabs[0].id : null);
  }
  try { if (cid) sessionStorage.setItem('lgpdsan:cid', cid); } catch (e) {}

  const c = await getDoc(doc(fs, 'config', 'app'));
  if (c.exists()) db.categorias = c.data().lista || [];
  else if (can.admin()) { await setDoc(doc(fs, 'config', 'app'), { lista: DEFAULT_CATS }); db.categorias = DEFAULT_CATS.slice(); }
  else db.categorias = [];
  // Categorias com guia: o admin ganha automaticamente as que ainda não existem na lista.
  if (can.admin() && c.exists()) {
    const faltam = Object.keys(GUIAS).filter(k => !db.categorias.includes(k));
    if (faltam.length) { db.categorias = [...db.categorias, ...faltam]; await setDoc(doc(fs, 'config', 'app'), { lista: db.categorias }); }
  }

  db.users = can.admin() ? (await getDocs(collection(fs, 'users'))).docs.map(d => ({ id: d.id, ...d.data() })) : [me];
  if (cid) {
    db.pessoas = (await getDocs(collection(fs, 'contabilidades', cid, 'pessoas'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const q = can.admin() ? rcol() : query(rcol(), where('deleted', '==', false));
    db.records = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } else { db.pessoas = []; db.records = []; }
}
async function loadAudit(n = 500) {
  const q = query(collection(fs, 'contabilidades', cid, 'auditoria'), orderBy('ts', 'desc'), limit(n));
  return (await getDocs(q)).docs.map(d => d.data()).sort((a, b) => tms(b.ts) - tms(a.ts));
}
async function loadSysAudit(n = 200) {
  const q = query(collection(fs, 'auditoria'), orderBy('ts', 'desc'), limit(n));
  return (await getDocs(q)).docs.map(d => d.data()).sort((a, b) => tms(b.ts) - tms(a.ts));
}
const responsaveis = () => [...new Set([me.nome, ...db.pessoas.map(p => p.nome)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* ---------- roteamento ---------- */
const app = $('#app');
const routes = [
  ['#/', 'Painel', renderDash, null, true], ['#/registros', 'Registros', renderList, null, true], ['#/auditoria', 'Auditoria', renderAudit, null, true], ['#/biblioteca', 'Biblioteca', renderBiblio],
  ['#/usuarios', 'Usuários', renderUsers, 'admin'], ['#/contabilidades', 'Contabilidades', renderContabs, 'admin'],
  ['#/categorias', 'Categorias', renderCats, 'admin'], ['#/backup', 'Backup', renderBackup, 'admin', true], ['#/sobre', 'Sobre / versão', renderAbout]
];
let bind = null, seq = 0;
function contabSelector() {
  if (db.contabs.length > 1) return `<label for="cs" style="margin-top:0">Contabilidade</label><select id="cs">${db.contabs.map(c => `<option value="${esc(c.id)}" ${c.id === cid ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`;
  if (db.contabs.length === 1) return `<div class="small muted">Contabilidade</div><div><b>${esc(db.contabs[0].nome)}</b></div>`;
  return '<div class="small muted">Nenhuma contabilidade</div>';
}
async function route() {
  if (!me) return renderLogin();
  const my = ++seq;
  const h = location.hash || '#/';
  let view, main = h, needs = false, recRoute = null;
  if (h.startsWith('#/registro/')) { const p = h.split('/'); recRoute = { c: p[2], id: p[3] }; main = '#/registros'; needs = true; }
  else if (h.startsWith('#/biblioteca/')) { main = '#/biblioteca'; const slug = h.slice(13); view = () => renderBiblioDoc(slug); }
  else {
    const r = routes.find(x => x[0] === h) || routes[0];
    main = r[0]; needs = !!r[4];
    view = (r[3] === 'admin' && !can.admin()) ? () => `<h1>Acesso negado</h1><p class="muted">Seu perfil não permite acessar esta área.</p>` : r[2];
  }
  const nav = routes.filter(r => r[3] !== 'admin' || can.admin())
    .map(r => `<a href="${r[0]}" class="${r[0] === main ? 'on' : ''}">${r[1]}</a>`).join('');
  app.innerHTML = `<div class="shell"><aside class="side"><div class="logo"><img src="assets/logo.png" alt="SAN Conecta — Conectando Empresas a Soluções"></div><div class="prod">LGPDSAN <span class="muted">· Conformidade LGPD</span></div>
    <div id="csel" class="csel"></div>
    <nav class="nav">${nav}</nav>
    <div class="who small"><b>${esc(me.nome)}</b><br><span class="muted">${ROLES[me.role]} · v${VERSION}</span><br><button class="link" id="out">Sair</button></div></aside>
    <main id="main"><p class="muted">Carregando…</p></main></div>`;
  $('#out').onclick = guard(logout);
  let html;
  try {
    bind = null;
    if (recRoute && recRoute.c) { cid = recRoute.c; }
    await loadCore();
    if (my !== seq) return;
    $('#csel').innerHTML = contabSelector();
    const cs = $('#cs'); if (cs) cs.onchange = () => { cid = cs.value; try { sessionStorage.setItem('lgpdsan:cid', cid); } catch (e) {} if (recRoute) location.hash = '#/registros'; else route(); };
    if (needs && !cid) html = can.admin()
      ? `<h1>Nenhuma contabilidade cadastrada</h1><p class="muted">Crie a primeira em <a href="#/contabilidades">Contabilidades</a>.</p>`
      : `<h1>Sem contabilidade vinculada</h1><p class="muted">Seu usuário ainda não está vinculado a nenhuma contabilidade. Procure o administrador.</p>`;
    else if (recRoute) html = await renderRecord(recRoute.id);
    else html = await view();
  } catch (e) { console.error(e); html = `<h1>Não foi possível carregar</h1><p class="muted">${esc(errMsg(e))}</p>`; bind = null; }
  if (my !== seq) return;
  $('#main').innerHTML = html;
  if (bind) { const f = bind; bind = null; f(); }
}
window.addEventListener('hashchange', route);

/* ---------- login ---------- */
function renderLogin(msg = '') {
  app.innerHTML = `<div class="login"><div class="card"><div class="logo big"><img src="assets/logo.png" alt="SAN Conecta — Conectando Empresas a Soluções"></div><h1 class="prod-title">LGPDSAN <span class="muted">· Conformidade LGPD</span></h1>
    <form id="f"><label for="em">E-mail</label><input id="em" type="email" required autocomplete="username">
    <label for="pw">Senha</label><input id="pw" type="password" required autocomplete="current-password">
    <p id="err" class="small" style="color:var(--bad);min-height:1.2em">${esc(msg)}</p>
    <button class="primary" style="width:100%">Entrar</button></form>
    <p class="small" style="margin-top:.75rem"><button class="link" id="fp" type="button">Esqueci minha senha</button></p>
    <p class="small muted">Acesso restrito a usuários cadastrados pelo administrador · v${VERSION}<br>${siteLink()}</p></div></div>`;
  const err = $('#err');
  $('#f').onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    try {
      await setPersistence(auth, browserSessionPersistence);
      justSignedIn = true;
      await signInWithEmailAndPassword(auth, $('#em').value.trim(), $('#pw').value);
    } catch (x) {
      justSignedIn = false;
      err.textContent = x.code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde alguns minutos.' : 'E-mail ou senha inválidos.';
    }
  };
  $('#fp').onclick = async () => {
    const em = $('#em').value.trim(); if (!em) { err.textContent = 'Informe o e-mail e clique de novo.'; return; }
    try { await sendPasswordResetEmail(auth, em); } catch (x) { /* resposta neutra de propósito */ }
    err.style.color = 'var(--ok)'; err.textContent = 'Se o e-mail estiver cadastrado, você receberá um link de redefinição.';
  };
}
async function logout() { try { await auditNow('Logout'); } catch (e) {} me = null; cid = null; try { sessionStorage.removeItem('lgpdsan:cid'); } catch (e) {} await signOut(auth); location.hash = '#/'; }

/* ---------- painel ---------- */
const recLink = r => `#/registro/${cid}/${r.id}`;
async function renderDash() {
  const rs = db.records.filter(r => !r.deleted);
  const by = s => rs.filter(r => cur(r).status === s).length;
  const od = rs.filter(overdue);
  const mine = rs.filter(r => cur(r).responsavel === me.nome && cur(r).status !== 'Arquivado');
  const recent = (await loadAudit(8)).slice(0, 6);
  return `<div class="bar"><div><h1>Painel</h1><p class="muted">${esc(contabNome(cid))} · visão geral da conformidade.</p></div>
    ${can.edit() ? '<a class="btn primary" href="#/registros" id="dnew">+ Novo registro</a>' : ''}</div>
    <div class="grid"><div class="stat"><b>${rs.length}</b>Registros ativos</div>
    <div class="stat"><b>${by('Em vigor')}</b>Em vigor</div><div class="stat"><b>${by('Em revisão')}</b>Em revisão</div>
    <div class="stat"><b style="color:${od.length ? 'var(--bad)' : 'inherit'}">${od.length}</b>Prazos vencidos</div></div>
    <div class="card"><h2>Prazos vencidos</h2>${od.length ? miniTable(od) : '<p class="muted">Nenhum prazo vencido.</p>'}</div>
    <div class="card"><h2>Atribuídos a mim</h2>${mine.length ? miniTable(mine) : '<p class="muted">Nada atribuído a você.</p>'}</div>
    <div class="card"><h2>Atividade recente</h2>${recent.length ? recent.map(a => `<div class="fieldrow small"><b>${esc(a.acao)}</b> · ${esc(a.user)} · <span class="muted">${fmt(a.ts)}</span><br>${esc(a.recTitulo)}</div>`).join('') : '<p class="muted">Sem atividade.</p>'}</div>`;
}
const chkCell = (g, d) => { const p = progresso(g, d); return `<span class="tag ${p.nao ? 'bad' : p.pend ? 'warn' : 'ok'}">${p.pct}%</span> <span class="muted small">${p.pend} pend.</span>`; };
const miniTable = rs => `<div class="tablewrap"><table><tr><th>Registro</th><th>Status</th><th>Prazo</th></tr>${rs.map(r => `<tr><td><a href="${recLink(r)}">${esc(cur(r).titulo)}</a></td><td>${statusTag(cur(r).status)}</td><td>${fmtD(cur(r).prazo)}</td></tr>`).join('')}</table></div>`;

/* ---------- lista ---------- */
function renderList() {
  bind = () => {
    const q = $('#q'), fc = $('#fc'), fs_ = $('#fs'), fp = $('#fp'), fd = $('#fd');
    let shown = [];
    const draw = () => {
      const t = q.value.toLowerCase();
      shown = db.records.filter(r => fd.value === 'del' ? r.deleted : !r.deleted).filter(r => { const c = cur(r);
        return (!fc.value || c.categoria === fc.value) && (!fs_.value || c.status === fs_.value) && (!fp.value || c.prioridade === fp.value) &&
          (!t || [c.titulo, c.descricao, c.responsavel, c.evidencias, c.categoria].join(' ').toLowerCase().includes(t)); })
        .sort((a, b) => cur(a).titulo.localeCompare(cur(b).titulo, 'pt-BR'));
      $('#cnt').textContent = `${contabNome(cid)} · ${shown.length} registro(s)`;
      $('#rows').innerHTML = shown.map(r => { const c = cur(r);
        return `<tr><td><a href="${recLink(r)}">${esc(c.titulo)}</a>${r.deleted ? ' <span class="tag bad">excluído</span>' : ''}<br><span class="muted small">${esc(c.categoria)}</span></td>
        <td>${statusTag(c.status)}</td><td>${priorTag(c.prioridade)}</td><td>${esc(c.responsavel) || '—'}</td>
        <td>${overdue(r) ? '<span class="tag bad">vencido</span> ' : ''}${fmtD(c.prazo)}</td><td>${guiaDe(c.categoria) ? chkCell(guiaDe(c.categoria), c.dados) : '<span class="muted">—</span>'}</td><td>v${r.versao}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Nenhum registro encontrado.</td></tr>';
      const gb = $('#gbtn'); if (gb) gb.hidden = !guiaDe(fc.value);
    };
    [q, fc, fs_, fp, fd].forEach(el => el.addEventListener('input', draw)); draw();
    const nb = $('#new'); if (nb) nb.onclick = () => recordForm();
    const ex = $('#exp'); if (ex) ex.onclick = guard(() => exportCSV(shown));
    $('#prn').onclick = () => window.print();
    $('#gbtn').onclick = () => { const g = guiaDe(fc.value); if (g) modal(`<h2>Guia de referência · ${esc(g.titulo)}</h2><div class="guide-ref">${g.referencia}</div><div class="actions"><button id="x">Fechar</button></div>`, d => { $('#x', d).onclick = () => d.close(); }); };
  };
  return `<div class="bar"><div><h1>Registros</h1><p class="muted" id="cnt"></p></div><div class="actions" style="margin:0">
    ${can.edit() ? '<button class="primary" id="new">+ Novo registro</button>' : ''}
    ${can.export() ? '<button id="exp">Exportar CSV</button>' : ''}<button id="gbtn" hidden>Guia de referência</button><button id="prn">Imprimir relatório</button></div></div>
    <div class="filters"><div><label for="q">Pesquisa</label><input id="q" type="search" placeholder="Palavra-chave…"></div>
    <div><label for="fc">Categoria</label><select id="fc">${opts(catList(), '', 'Todas')}</select></div>
    <div><label for="fs">Status</label><select id="fs">${opts(STATUS, '', 'Todos')}</select></div>
    <div><label for="fp">Prioridade</label><select id="fp">${opts(PRIOR, '', 'Todas')}</select></div>
    <div><label for="fd">Exibir</label><select id="fd"><option value="">Ativos</option>${can.admin() ? '<option value="del">Excluídos</option>' : ''}</select></div></div>
    <div class="card tablewrap"><table><thead><tr><th>Registro</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Checklist</th><th>Versão</th></tr></thead><tbody id="rows"></tbody></table></div>`;
}
async function exportCSV(rs) {
  if (!can.export()) return;
  const q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1") + '"';
  const head = ['Contabilidade', 'Título', 'Categoria', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Versão', 'Descrição', 'Evidências'];
  const lines = [head.map(q).join(';')].concat(rs.map(r => { const c = cur(r);
    return [contabNome(cid), c.titulo, c.categoria, c.status, c.prioridade, c.responsavel, c.prazo, r.versao, c.descricao, c.evidencias].map(q).join(';'); }));
  download('lgpdsan-registros-' + today() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  await auditNow('Exportação CSV', null, `${contabNome(cid)} · ${rs.length} registro(s)`);
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- checklist (guias por categoria) ---------- */
const fieldUnion = (c1, c2) => { const m = new Map(); [...fieldList(c1), ...fieldList(c2)].forEach(([k, l]) => m.set(k, l)); return [...m.entries()]; };
const respTag = v => `<span class="tag ${{ 'Conforme': 'ok', 'Parcial': 'warn', 'Não conforme': 'bad' }[v] || ''}">${esc(v || 'Não avaliado')}</span>`;
function checklistForm(g, dados) {
  const dd = dados || {};
  const item = i => {
    const v = dd[i.id], help = i.ajuda ? `<div class="muted small">${esc(i.ajuda)}</div>` : '';
    const extra = i.extra ? ' <span class="tag brand" title="Item acrescentado pela equipe técnica; validar juridicamente">extra</span>' : '';
    const lab = `<label>${esc(i.label)}${extra}</label>`;
    if (i.tipo === 'texto') return `<div class="gi">${lab}<input data-k="${i.id}" maxlength="300" value="${esc(v)}">${help}</div>`;
    if (i.tipo === 'area') return `<div class="gi">${lab}<textarea data-k="${i.id}" maxlength="2000" style="min-height:70px">${esc(v)}</textarea>${help}</div>`;
    if (i.tipo === 'select') return `<div class="gi">${lab}<select data-k="${i.id}">${opts(i.opcoes, v, '— selecione —')}</select>${help}</div>`;
    if (i.tipo === 'multi') { const sel = new Set(Array.isArray(v) ? v : []);
      return `<div class="gi">${lab}${i.opcoes.map(o => `<label class="chk"><input type="checkbox" data-m="${i.id}" value="${esc(o)}" ${sel.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}${help}</div>`; }
    return `<div class="gi">${lab}<div class="row"><select data-k="${i.id}">${opts(RESP, v, 'Não avaliado')}</select><input data-k="${i.id}#o" maxlength="300" placeholder="Observação / evidência (opcional)" value="${esc(dd[i.id + '#o'])}"></div>${help}</div>`;
  };
  return `<div class="card guide"><h3>Checklist · ${esc(g.titulo)}</h3><p class="muted small">${esc(g.resumo)}</p>
    ${g.secoes.map(sec => `<details open><summary>${esc(sec.titulo)}</summary>${sec.itens.map(item).join('')}</details>`).join('')}</div>`;
}
function collectDados(root) {
  const o = {};
  root.querySelectorAll('[data-k]').forEach(el => { const v = el.value.trim(); if (v) o[el.dataset.k] = v.slice(0, el.tagName === 'TEXTAREA' ? 2000 : 300); });
  const ms = {};
  root.querySelectorAll('[data-m]:checked').forEach(el => { (ms[el.dataset.m] = ms[el.dataset.m] || []).push(el.value); });
  Object.assign(o, ms);
  return o;
}
function checklistView(g, dados) {
  const dd = dados || {}, pr = progresso(g, dd), alerts = g.alertas(dd);
  const val = i => {
    const v = dd[i.id];
    if (i.tipo === 'sn') return respTag(v) + (dd[i.id + '#o'] ? `<div class="muted small">${esc(dd[i.id + '#o'])}</div>` : '');
    return v && v.length ? esc(fmtVal(v)) : '<span class="muted">—</span>';
  };
  return `<div class="card"><h2>Checklist · ${esc(g.titulo)}</h2>
    <div class="prog" title="${pr.pct}% conforme"><span style="width:${pr.pct}%"></span></div>
    <p class="small"><b>${pr.pct}% conforme</b> (itens aplicáveis) · ${pr.ok} conformes · ${pr.parcial} parciais · ${pr.nao} não conformes · ${pr.na} N/A · ${pr.pend} sem avaliação</p>
    ${alerts.length ? `<div class="notice bad"><b>Pontos de atenção</b><ul>${alerts.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${g.secoes.map(sec => `<h3 style="margin-top:1rem">${esc(sec.titulo)}</h3><div class="tablewrap"><table>${sec.itens.map(i =>
      `<tr><td style="width:55%">${esc(i.label)}${i.extra ? ' <span class="tag brand">extra</span>' : ''}</td><td>${val(i)}</td></tr>`).join('')}</table></div>`).join('')}</div>`;
}

/* ---------- formulário de registro ---------- */
function recordForm(rec) {
  const c = rec ? cur(rec) : { titulo: '', categoria: catList()[0] || '', descricao: '', status: 'Rascunho', prioridade: 'Média', responsavel: me.nome, prazo: '', evidencias: '' };
  const statusOpts = me.role === 'admin' ? STATUS : STATUS.filter(s => s !== 'Arquivado');
  modal(`<h3>${rec ? 'Editar registro' : 'Novo registro'} <span class="muted small">· ${esc(contabNome(cid))}</span></h3><form id="rf">
    <label for="t">Título *</label><input id="t" required maxlength="200" value="${esc(c.titulo)}">
    <div class="row"><div><label for="c">Categoria *</label><select id="c" required>${opts(catList(), c.categoria)}</select></div>
    <div><label for="s">Status</label><select id="s">${opts(statusOpts, c.status)}</select></div>
    <div><label for="p">Prioridade</label><select id="p">${opts(PRIOR, c.prioridade)}</select></div></div>
    <div class="row"><div><label for="r">Responsável</label><select id="r">${opts(responsaveis(), c.responsavel, '— ninguém —')}</select></div>
    <div><label for="z">Prazo</label><input id="z" type="date" value="${esc(c.prazo)}"></div></div>
    <label for="d">Descrição / procedimento</label><textarea id="d" maxlength="20000">${esc(c.descricao)}</textarea>
    <label for="e">Evidências (um link ou referência por linha)</label><textarea id="e" maxlength="5000" style="min-height:70px">${esc(c.evidencias)}</textarea>
    <div id="gx"></div>
    <label for="j">Justificativa da alteração *</label><input id="j" required maxlength="300" placeholder="${rec ? 'Por que está alterando?' : 'Criação inicial'}">
    <div class="actions"><button class="primary" id="sv">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`,
    d => {
      let dadosAtual = JSON.parse(JSON.stringify(c.dados || {}));
      const drawGuide = () => {
        const g = guiaDe($('#c', d).value);
        $('#gx', d).innerHTML = g ? checklistForm(g, dadosAtual) : '';
        $('#t', d).placeholder = g ? g.tituloHint : '';
      };
      $('#c', d).onchange = () => { if (guiaDe(c0)) dadosAtual = collectDados($('#gx', d)); c0 = $('#c', d).value; drawGuide(); };
      let c0 = $('#c', d).value; drawGuide();
      $('#x', d).onclick = () => d.close();
      $('#rf', d).onsubmit = guard(async e => {
        e.preventDefault();
        const snap = { titulo: $('#t', d).value.trim(), categoria: $('#c', d).value, descricao: $('#d', d).value, status: $('#s', d).value,
          prioridade: $('#p', d).value, responsavel: $('#r', d).value, prazo: $('#z', d).value, evidencias: $('#e', d).value };
        if (guiaDe(snap.categoria)) snap.dados = collectDados($('#gx', d));
        const just = $('#j', d).value.trim();
        $('#sv', d).disabled = true;
        const batch = writeBatch(fs);
        let id;
        try {
          if (rec) {
            if (!can.editRec(rec)) { $('#sv', d).disabled = false; return toast('Sem permissão para editar este registro.'); }
            const before = cur(rec), changed = fieldUnion(before.categoria, snap.categoria).filter(([k]) => String(fval(before, k)) !== String(fval(snap, k))).map(([, l]) => l);
            if (!changed.length) { d.close(); return toast('Nenhuma alteração.'); }
            const n = rec.versao + 1; id = rec.id;
            batch.update(rdoc(id), { snap, versao: n, atualizado: serverTimestamp() });
            batch.set(vdoc(id, n), { n, snap, autor: me.nome, autorId: me.id, quando: serverTimestamp(), just });
            auditOp(batch, 'Edição', { id, snap }, `v${n} · ${changed.join(', ')} · ${just}`);
            await batch.commit(); toast('Nova versão v' + n + ' criada.');
          } else {
            id = doc(rcol()).id;
            batch.set(rdoc(id), { snap, versao: 1, deleted: false, criado: serverTimestamp(), criadoPor: me.id });
            batch.set(vdoc(id, 1), { n: 1, snap, autor: me.nome, autorId: me.id, quando: serverTimestamp(), just });
            auditOp(batch, 'Criação', { id, snap }, just);
            await batch.commit(); toast('Registro criado.');
          }
        } catch (x) { $('#sv', d).disabled = false; throw x; }
        d.close(); const h = `#/registro/${cid}/${id}`; if (location.hash === h) route(); else location.hash = h;
      });
    });
}

/* ---------- detalhe ---------- */
async function renderRecord(id) {
  const back = '<p><a href="#/registros">Voltar</a></p>';
  let rec;
  try { const s = await getDoc(rdoc(id)); if (!s.exists()) return `<h1>Registro não encontrado</h1>${back}`; rec = { id: s.id, ...s.data() }; }
  catch (e) { return `<h1>Registro não disponível</h1>${back}`; }
  if (rec.deleted && !can.admin()) return `<h1>Registro não disponível</h1>${back}`;
  const vs = (await getDocs(vcol(id))).docs.map(d => d.data()).sort((a, b) => a.n - b.n);
  const au = (await getDocs(query(collection(fs, 'contabilidades', cid, 'auditoria'), where('recId', '==', id)))).docs
    .map(d => d.data()).sort((a, b) => tms(b.ts) - tms(a.ts));
  const c = cur(rec);
  bind = () => {
    const reload = () => route();
    const e = $('#edit'); if (e) e.onclick = () => recordForm(rec);
    const dl = $('#del'); if (dl) dl.onclick = () => confirmBox('Excluir logicamente este registro? Ele sai das listas, mas pode ser restaurado.', 'Excluir', async () => {
      const b = writeBatch(fs); b.update(rdoc(id), { deleted: true }); auditOp(b, 'Exclusão lógica', rec); await b.commit(); reload(); });
    const rs = $('#rest'); if (rs) rs.onclick = guard(async () => {
      const b = writeBatch(fs); b.update(rdoc(id), { deleted: false }); auditOp(b, 'Registro restaurado', rec); await b.commit(); reload(); });
    const hd = $('#hard'); if (hd) hd.onclick = () => confirmBox('Excluir DEFINITIVAMENTE, com todo o histórico de versões? Não pode ser desfeito. A auditoria é mantida.', 'Excluir definitivamente', async () => {
      const b = writeBatch(fs);
      (await getDocs(vcol(id))).docs.forEach(d => b.delete(d.ref));
      b.delete(rdoc(id)); auditOp(b, 'Exclusão permanente', rec); await b.commit(); location.hash = '#/registros'; });
    document.querySelectorAll('[data-restore]').forEach(btn => btn.onclick = () => {
      const v = vs[+btn.dataset.restore - 1];
      confirmBox(`Restaurar o conteúdo da v${v.n}? Será criada uma nova versão (o histórico não é apagado).`, 'Restaurar', async () => {
        const n = rec.versao + 1, st = (me.role !== 'admin' && v.snap.status === 'Arquivado') ? 'Em revisão' : v.snap.status;
        const snap = { ...v.snap, status: st }, b = writeBatch(fs);
        b.update(rdoc(id), { snap, versao: n, atualizado: serverTimestamp() });
        b.set(vdoc(id, n), { n, snap, autor: me.nome, autorId: me.id, quando: serverTimestamp(), just: `Restauração da v${v.n}` });
        auditOp(b, 'Restauração de versão', rec, `v${v.n} → v${n}`); await b.commit(); reload(); }, false);
    });
    const cmp = () => {
      const a = vs[+$('#va').value - 1].snap, b = vs[+$('#vb').value - 1].snap;
      const ch = fieldUnion(a.categoria, b.categoria).filter(([k]) => String(fval(a, k)) !== String(fval(b, k)));
      $('#diff').innerHTML = ch.length ? ch.map(([k, l]) => `<div class="fieldrow"><b>${l}</b><div class="diff pre">${wordDiff(fval(a, k), fval(b, k))}</div></div>`).join('') : '<p class="muted">Sem diferenças entre as versões selecionadas.</p>';
    };
    if (vs.length > 1) { $('#va').onchange = $('#vb').onchange = cmp; cmp(); }
  };
  const vopts = sel => vs.map(v => `<option value="${v.n}" ${v.n === sel ? 'selected' : ''}>v${v.n} · ${fmt(v.quando)}</option>`).join('');
  const last = vs.length;
  return `<p class="small"><a href="#/registros">← Registros</a> · ${esc(contabNome(cid))}</p>
    <div class="bar"><div><h1>${esc(c.titulo)} ${rec.deleted ? '<span class="tag bad">excluído</span>' : ''}</h1>
    <p>${statusTag(c.status)} ${priorTag(c.prioridade)} <span class="tag">${esc(c.categoria)}</span> <span class="tag brand">v${rec.versao}</span></p></div>
    <div class="actions" style="margin:0">
    ${can.editRec(rec) ? '<button class="primary" id="edit">Editar</button>' : ''}
    ${!rec.deleted && can.admin() ? '<button class="danger" id="del">Excluir</button>' : ''}
    ${rec.deleted && can.admin() ? '<button id="rest">Restaurar registro</button><button class="danger" id="hard">Excluir definitivamente</button>' : ''}</div></div>
    ${overdue(rec) ? '<div class="notice bad">Prazo vencido em ' + fmtD(c.prazo) + '.</div>' : ''}
    <div class="card"><div class="row small"><div><span class="muted">Responsável</span><br>${esc(c.responsavel) || '—'}</div><div><span class="muted">Prazo</span><br>${fmtD(c.prazo)}</div>
    <div><span class="muted">Criado em</span><br>${fmt(rec.criado)}</div></div>
    <h3 style="margin-top:1rem">Descrição / procedimento</h3><div class="pre">${esc(c.descricao) || '<span class="muted">—</span>'}</div>
    <h3 style="margin-top:1rem">Evidências</h3><div class="pre">${esc(c.evidencias) || '<span class="muted">—</span>'}</div></div>
    ${guiaDe(c.categoria) ? checklistView(guiaDe(c.categoria), c.dados) : ''}
    <div class="card"><h2>Histórico de versões</h2><div class="tablewrap"><table><tr><th>Versão</th><th>Quando</th><th>Autor</th><th>Justificativa</th><th></th></tr>
    ${vs.slice().reverse().map(v => `<tr><td>v${v.n}${v.n === last ? ' <span class="tag ok">atual</span>' : ''}</td><td>${fmt(v.quando)}</td><td>${esc(v.autor)}</td><td>${esc(v.just)}</td>
    <td>${can.editRec(rec) && v.n !== last ? `<button data-restore="${v.n}">Restaurar</button>` : ''}</td></tr>`).join('')}</table></div></div>
    ${vs.length > 1 ? `<div class="card"><h2>Comparar versões</h2><div class="row"><div><label for="va">De</label><select id="va">${vopts(vs.length - 1)}</select></div>
    <div><label for="vb">Para</label><select id="vb">${vopts(vs.length)}</select></div></div><div id="diff"></div></div>` : ''}
    <div class="card"><h2>Auditoria deste registro</h2>${auditRows(au)}</div>`;
}

/* ---------- auditoria ---------- */
const auditRows = list => list.length ? `<div class="tablewrap"><table><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Detalhe</th></tr>
  ${list.map(a => `<tr><td>${fmt(a.ts)}</td><td>${esc(a.user)}<br><span class="muted small">${esc(ROLES[a.role] || '')}</span></td><td>${esc(a.acao)}</td><td>${esc(a.recTitulo)}</td><td>${esc(a.detalhe)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Sem eventos.</p>';
async function renderAudit() {
  const all = await loadAudit(500);
  const sys = can.admin() ? await loadSysAudit(200) : null;
  bind = () => { const q = $('#aq'), draw = () => { const t = q.value.toLowerCase();
    $('#alist').innerHTML = auditRows(all.filter(a => !t || [a.user, a.acao, a.recTitulo, a.detalhe].join(' ').toLowerCase().includes(t))); }; q.oninput = draw; draw(); };
  return `<div class="bar"><div><h1>Auditoria</h1><p class="muted">${esc(contabNome(cid))} · últimos 500 eventos. Somente leitura: o servidor não permite editar nem apagar eventos.</p></div></div>
    <div class="card"><label for="aq" style="margin-top:0">Filtrar</label><input id="aq" type="search" placeholder="Usuário, ação, registro…"><div id="alist" style="margin-top:.75rem"></div></div>
    ${sys ? `<div class="card"><h2>Eventos do sistema (administrador)</h2><p class="muted small">Logins, usuários, contabilidades, categorias. Últimos 200.</p>${auditRows(sys)}</div>` : ''}`;
}

/* ---------- usuários (admin) ---------- */
const activeAdmins = () => db.users.filter(u => u.ativo && u.role === 'admin');
function syncPessoas(b, uid, nome, role, ativo, ids, prevIds = []) {
  const target = (role !== 'admin' && ativo) ? ids : [];
  prevIds.filter(x => !target.includes(x)).forEach(c => b.delete(doc(fs, 'contabilidades', c, 'pessoas', uid)));
  target.forEach(c => b.set(doc(fs, 'contabilidades', c, 'pessoas', uid), { nome }));
}
function renderUsers() {
  bind = () => {
    $('#nu').onclick = () => userForm();
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = guard(() => userAction(b.dataset.a, db.users.find(u => u.id === b.dataset.u))));
  };
  const firms = u => u.role === 'admin' ? '<span class="muted">todas</span>' : ((u.contabilidades || []).map(contabNome).map(esc).join(', ') || '<span class="tag bad">nenhuma</span>');
  return `<div class="bar"><div><h1>Usuários</h1><p class="muted">O novo usuário recebe um e-mail para definir a própria senha; ninguém, nem o administrador, vê senhas. Administrador enxerga todas as contabilidades; Consulta e Edição só as vinculadas.</p></div><button class="primary" id="nu">+ Novo usuário</button></div>
    <div class="card tablewrap"><table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Contabilidades</th><th>Situação</th><th></th></tr>
    ${db.users.slice().sort(byName).map(u => `<tr><td>${esc(u.nome)}${u.id === me.id ? ' <span class="tag brand">você</span>' : ''}</td><td>${esc(u.email)}</td><td>${ROLES[u.role] || esc(u.role)}</td><td>${firms(u)}</td>
    <td>${u.ativo ? '<span class="tag ok">ativo</span>' : '<span class="tag bad">bloqueado</span>'}</td>
    <td class="actions" style="margin:0"><button data-u="${u.id}" data-a="edit">Editar</button><button data-u="${u.id}" data-a="pw">Enviar redefinição de senha</button>
    <button data-u="${u.id}" data-a="toggle">${u.ativo ? 'Bloquear' : 'Desbloquear'}</button><button class="danger" data-u="${u.id}" data-a="rm">Remover acesso</button></td></tr>`).join('')}</table></div>`;
}
const genPw = () => { const ch = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'; return [...crypto.getRandomValues(new Uint8Array(24))].map(b => ch[b % ch.length]).join(''); };
function userForm(u) {
  const have = new Set(u?.contabilidades || []);
  modal(`<h3>${u ? 'Editar usuário' : 'Novo usuário'}</h3><form id="uf"><label for="n">Nome *</label><input id="n" required maxlength="100" value="${esc(u?.nome)}">
    <label for="m">E-mail *</label><input id="m" type="email" required value="${esc(u?.email)}" ${u ? 'disabled' : ''}>
    <label for="r">Perfil</label><select id="r">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div id="fw"><label>Contabilidades com acesso *</label>${db.contabs.length ? db.contabs.map(c => `<label style="font-weight:400;margin:.2rem 0"><input type="checkbox" style="width:auto" name="cb" value="${esc(c.id)}" ${have.has(c.id) ? 'checked' : ''}> ${esc(c.nome)}</label>`).join('') : '<p class="muted small">Cadastre contabilidades primeiro.</p>'}</div>
    <p class="muted small" id="adm" hidden>Administrador acessa todas as contabilidades.</p>
    <div class="actions"><button class="primary" id="sv">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
    const sync = () => { const a = $('#r', d).value === 'admin'; $('#fw', d).hidden = a; $('#adm', d).hidden = !a; };
    $('#r', d).onchange = sync; sync();
    $('#x', d).onclick = () => d.close();
    $('#uf', d).onsubmit = guard(async e => {
      e.preventDefault();
      const role = $('#r', d).value, nome = $('#n', d).value.trim();
      const ids = role === 'admin' ? [] : [...d.querySelectorAll('[name=cb]:checked')].map(x => x.value);
      if (role !== 'admin' && !ids.length) return toast('Selecione ao menos uma contabilidade.');
      $('#sv', d).disabled = true;
      try {
        if (u) {
          if (u.role === 'admin' && role !== 'admin' && activeAdmins().length === 1) throw { message: 'Mantenha ao menos um administrador ativo.' };
          const b = writeBatch(fs); b.update(doc(fs, 'users', u.id), { nome, role, contabilidades: ids });
          syncPessoas(b, u.id, nome, role, u.ativo, ids, u.contabilidades || []);
          auditOp(b, 'Usuário editado', null, `${u.email} · ${ROLES[u.role]} → ${ROLES[role]} · ${ids.map(contabNome).join(', ') || 'todas'}`); await b.commit();
        } else {
          const email = $('#m', d).value.toLowerCase().trim();
          const sec = initializeApp(firebaseConfig, 'sec' + Date.now()), sa = getAuth(sec);
          const cred = await createUserWithEmailAndPassword(sa, email, genPw());
          await signOut(sa);
          const b = writeBatch(fs); b.set(doc(fs, 'users', cred.user.uid), { nome, email, role, ativo: true, contabilidades: ids, criado: serverTimestamp() });
          syncPessoas(b, cred.user.uid, nome, role, true, ids, []);
          auditOp(b, 'Usuário criado', null, `${email} · ${ROLES[role]} · ${ids.map(contabNome).join(', ') || 'todas'}`); await b.commit();
          await sendPasswordResetEmail(auth, email);
          toast('Usuário criado. Um e-mail para definir a senha foi enviado.');
        }
        d.close(); route();
      } catch (x) { $('#sv', d).disabled = false; throw x; }
    });
  });
}
async function userAction(a, u) {
  if (a === 'edit') return userForm(u);
  if (a === 'pw') { await sendPasswordResetEmail(auth, u.email); await auditNow('Redefinição de senha enviada', null, u.email); return toast('E-mail de redefinição enviado.'); }
  if (a === 'toggle') {
    if (u.ativo && u.role === 'admin' && activeAdmins().length === 1) return toast('Mantenha ao menos um administrador ativo.');
    if (u.id === me.id) return toast('Você não pode bloquear a si mesmo.');
    const b = writeBatch(fs); b.update(doc(fs, 'users', u.id), { ativo: !u.ativo });
    syncPessoas(b, u.id, u.nome, u.role, !u.ativo, u.contabilidades || [], u.contabilidades || []);
    auditOp(b, u.ativo ? 'Usuário bloqueado' : 'Usuário desbloqueado', null, u.email); await b.commit(); return route();
  }
  if (a === 'rm') {
    if (u.id === me.id) return toast('Você não pode remover a si mesmo.');
    if (u.ativo && u.role === 'admin' && activeAdmins().length === 1) return toast('Mantenha ao menos um administrador ativo.');
    confirmBox(`Remover o acesso de ${u.nome}? A conta de login continua existindo no Firebase (apague-a no console se necessário). Para uso temporário, prefira Bloquear.`, 'Remover acesso', async () => {
      const b = writeBatch(fs); b.delete(doc(fs, 'users', u.id)); syncPessoas(b, u.id, u.nome, u.role, false, [], u.contabilidades || []);
      auditOp(b, 'Acesso de usuário removido', null, u.email); await b.commit(); route(); });
  }
}

/* ---------- contabilidades (admin) ---------- */
function renderContabs() {
  const nextName = () => {
    const nums = db.contabs.map(c => /^Contabilidade (\d+)$/.exec(c.nome)).filter(Boolean).map(m => +m[1]);
    return 'Contabilidade ' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
  };
  bind = () => {
    const create = guard(async nome => {
      nome = nome.trim(); if (!nome) return toast('Informe o nome.');
      if (db.contabs.some(c => c.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe uma contabilidade com este nome.');
      const ref = doc(collection(fs, 'contabilidades')), b = writeBatch(fs);
      b.set(ref, { nome, criado: serverTimestamp() }); auditOp(b, 'Contabilidade criada', null, nome); await b.commit();
      toast(nome + ' criada.'); route();
    });
    $('#cf').onsubmit = e => { e.preventDefault(); create($('#cn').value); };
    $('#cnext').onclick = () => create(nextName());
    document.querySelectorAll('[data-ren]').forEach(btn => btn.onclick = () => {
      const c = db.contabs.find(x => x.id === btn.dataset.ren);
      modal(`<h3>Renomear contabilidade</h3><form id="rn"><label for="nn">Nome</label><input id="nn" required maxlength="100" value="${esc(c.nome)}"><div class="actions"><button class="primary">Salvar</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
        $('#x', d).onclick = () => d.close();
        $('#rn', d).onsubmit = guard(async e => { e.preventDefault(); const nome = $('#nn', d).value.trim(); if (!nome) return;
          const b = writeBatch(fs); b.update(doc(fs, 'contabilidades', c.id), { nome }); auditOp(b, 'Contabilidade renomeada', null, `${c.nome} → ${nome}`); await b.commit(); d.close(); route(); });
      });
    });
  };
  return `<div class="bar"><div><h1>Contabilidades</h1><p class="muted">Cada contabilidade tem registros, versões e auditoria próprios, isolados no servidor. Vincule usuários em <a href="#/usuarios">Usuários</a>.</p></div></div>
    <div class="card"><form id="cf" class="row" style="align-items:end"><div><label for="cn" style="margin-top:0">Nova contabilidade</label><input id="cn" maxlength="100" placeholder="Nome do escritório"></div>
    <div class="actions" style="margin:0"><button class="primary">Adicionar</button><button type="button" id="cnext">Criar “${esc(nextName())}”</button></div></form></div>
    <div class="card tablewrap"><table><tr><th>Nome</th><th>Usuários vinculados</th><th></th></tr>${db.contabs.map(c => {
      const us = db.users.filter(u => u.role !== 'admin' && u.ativo && (u.contabilidades || []).includes(c.id)).length;
      return `<tr><td>${esc(c.nome)}</td><td>${us}</td><td style="text-align:right"><button data-ren="${esc(c.id)}">Renomear</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="muted">Nenhuma contabilidade.</td></tr>'}</table></div>`;
}

/* ---------- categorias (admin) ---------- */
function renderCats() {
  bind = () => {
    $('#cf').onsubmit = guard(async e => { e.preventDefault(); const v = $('#cn').value.trim();
      if (!v || db.categorias.includes(v)) return toast('Informe um nome novo.');
      const b = writeBatch(fs); b.set(doc(fs, 'config', 'app'), { lista: [...db.categorias, v] }); auditOp(b, 'Categoria criada', null, v); await b.commit(); route(); });
    document.querySelectorAll('[data-rc]').forEach(btn => btn.onclick = guard(async () => {
      const n = btn.dataset.rc;
      if (db.records.some(r => cur(r).categoria === n)) return toast('Categoria em uso por registros da contabilidade selecionada; não pode ser removida. (Registros de outras contabilidades não são verificados.)');
      const b = writeBatch(fs); b.set(doc(fs, 'config', 'app'), { lista: db.categorias.filter(x => x !== n) }); auditOp(b, 'Categoria removida', null, n); await b.commit(); route(); }));
  };
  return `<div class="bar"><div><h1>Categorias</h1><p class="muted">Lista única, compartilhada por todas as contabilidades.</p></div></div><div class="card"><form id="cf" class="row" style="align-items:end"><div><label for="cn" style="margin-top:0">Nova categoria</label><input id="cn" maxlength="80"></div><div><button class="primary">Adicionar</button></div></form></div>
    <div class="card tablewrap"><table>${catList().map(c => `<tr><td>${esc(c)}</td><td style="text-align:right"><button class="danger" data-rc="${esc(c)}">Remover</button></td></tr>`).join('')}</table></div>`;
}

/* ---------- backup (admin) ---------- */
async function exportFirm(id) {
  const prev = cid; cid = id;
  try {
    const regs = (await getDocs(rcol())).docs.map(d => ({ id: d.id, ...d.data() }));
    const registros = [];
    for (const r of regs) registros.push({ ...r, versoes: (await getDocs(vcol(r.id))).docs.map(d => d.data()) });
    const auditoria = (await getDocs(collection(fs, 'contabilidades', id, 'auditoria'))).docs.map(d => d.data());
    return { id, nome: contabNome(id), registros, auditoria };
  } finally { cid = prev; }
}
function renderBackup() {
  const toJson = o => JSON.stringify(o, (k, v) => (v && v.toMillis ? new Date(v.toMillis()).toISOString() : v));
  bind = () => {
    $('#bk').onclick = guard(async () => {
      $('#bk').disabled = true;
      try {
        const out = { versao_app: VERSION, gerado: new Date().toISOString(), categorias: db.categorias, contabilidade: await exportFirm(cid) };
        download(`lgpdsan-backup-${contabNome(cid).replace(/\W+/g, '-')}-${today()}.json`, toJson(out), 'application/json');
        await auditNow('Backup exportado (contabilidade)', null, contabNome(cid));
      } finally { $('#bk').disabled = false; }
    });
    $('#bka').onclick = guard(async () => {
      $('#bka').disabled = true;
      try {
        const out = { versao_app: VERSION, gerado: new Date().toISOString(), categorias: db.categorias, usuarios: db.users, contabilidades: [] };
        for (const c of db.contabs) out.contabilidades.push(await exportFirm(c.id));
        out.auditoria_sistema = await loadSysAudit(5000);
        download('lgpdsan-backup-completo-' + today() + '.json', toJson(out), 'application/json');
        await auditNow('Backup completo exportado', null, db.contabs.length + ' contabilidade(s)');
      } finally { $('#bka').disabled = false; }
    });
  };
  return `<div class="bar"><div><h1>Backup</h1></div></div>
    <div class="card"><h2>Contabilidade selecionada: ${esc(contabNome(cid))}</h2><p class="muted">Registros com todas as versões e a auditoria desta contabilidade. Trate o arquivo como dado sensível.</p><button class="primary" id="bk">Exportar esta contabilidade</button></div>
    <div class="card"><h2>Todas as contabilidades</h2><p class="muted">Inclui usuários, categorias e auditoria do sistema. Importação automática e política de retenção ficam para versões futuras.</p><button id="bka">Exportar tudo</button></div>`;
}

/* ---------- sobre ---------- */
function renderBiblio() {
  return `<div class="bar"><div><h1>Biblioteca</h1><p class="muted">Documentos de referência usados nos checklists. Somente leitura.</p></div></div>
    <div class="notice"><b>Atenção:</b> todos os documentos recebidos estão incompletos e 8 dos 9 têm citação ou termo legal incorreto. As correções ficam em "Notas de revisão", no guia de cada categoria. As citações foram conferidas em fonte oficial em 06/10/2026 (por resumo automático; alguns pontos ficaram sem verificação). <b>Validação por advogado e contador: pendente.</b> Não use os prazos e artigos dos documentos sem essa validação.</div>
    <div class="card tablewrap"><table><thead><tr><th>Documento</th><th>Termina em</th><th>Checklist</th></tr></thead><tbody>
    ${BIBLIO.map(b => `<tr><td><a href="#/biblioteca/${b.slug}"><b>${esc(b.titulo)}</b></a></td><td class="small muted">${esc(b.fim)}</td><td><span class="tag ${GUIAS[b.cat] ? 'brand' : ''}">${esc(b.cat)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
}
async function renderBiblioDoc(slug) {
  const b = BIBLIO.find(x => x.slug === slug);
  if (!b) return `<h1>Documento não encontrado</h1><p><a href="#/biblioteca">Voltar à Biblioteca</a></p>`;
  let corpo;
  try {
    const r = await fetch(`biblioteca/${b.slug}.html?v=${VERSION}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    corpo = await r.text();
  } catch (e) { corpo = `<p class="muted">Não foi possível carregar o documento (${esc(e.message)}).</p>`; }
  const g = guiaDe(b.cat);
  bind = () => { const n = $('#bnotas'); if (n && g) n.onclick = () => { const d = document.createElement('dialog'); d.innerHTML = `<div class="guide-ref"><h2>${esc(g.titulo)} · referência</h2>${g.referencia}</div><div class="actions"><button id="bx">Fechar</button></div>`; document.body.appendChild(d); d.showModal(); $('#bx', d).onclick = () => { d.close(); d.remove(); }; d.onclose = () => d.remove(); }; };
  return `<div class="bar"><div><p class="small"><a href="#/biblioteca">← Biblioteca</a></p><h1>${esc(b.titulo)}</h1><p class="muted small">Documento recebido, somente leitura. Termina em: ${esc(b.fim)}.</p></div>
    <div class="actions" style="margin:0"><a class="btn" href="biblioteca/${b.slug}.docx" download>Baixar original (.docx)</a>${g ? '<button id="bnotas">Notas de revisão</button>' : ''}</div></div>
    <div class="card doc">${corpo}</div>`;
}

function renderAbout() {
  return `<div class="bar"><div><h1>Sobre</h1><p class="muted">LGPDSAN v${VERSION}</p></div></div>
    <div class="card"><h2>Como a segurança funciona</h2><p>Login pelo Firebase Authentication. Permissões, isolamento entre contabilidades e auditoria são <b>aplicados no servidor</b> pelas Regras do Firestore; esconder um botão na tela não é a proteção.</p>
    <ul><li>Dados no Firestore, região São Paulo.</li><li>Cada contabilidade é isolada: usuários só leem e gravam nas contabilidades a que estão vinculados. Somente o Administrador acessa todas.</li><li>Auditoria somente de criação: nem o administrador altera eventos pelo app.</li><li>Versões de registros são imutáveis; só a exclusão permanente do registro as remove.</li></ul></div>
    <div class="card"><h2>Limitações conhecidas</h2><ul><li>Sem upload de arquivos (links/referências), sem e-mails de prazo e sem links temporários.</li>
    <li>Tentativas de login falhas não entram na auditoria (o servidor limita tentativas, mas o log fica no console do Firebase).</li>
    <li>Sem política de retenção automática nem importação de backup.</li>
    <li>Categorias são compartilhadas entre contabilidades. Não há administrador por contabilidade: usuários são gerenciados pelo Administrador geral.</li></ul></div>
    <div class="card"><h2>Versionamento do sistema</h2><p>SemVer (<code>MAIOR.MENOR.CORREÇÃO</code>). Veja o CHANGELOG no repositório.</p>
    <p>Desenvolvido por <b>SAN Conecta</b> — Conectando Empresas a Soluções · ${siteLink()}</p></div>`;
}

/* ---------- inicialização ---------- */
onAuthStateChanged(auth, async u => {
  if (!u) { me = null; seq++; return renderLogin(); }
  try {
    const s = await getDoc(doc(fs, 'users', u.uid));
    if (!s.exists() || !s.data().ativo) { me = null; await signOut(auth); return renderLogin('Conta sem acesso ao sistema. Procure o administrador.'); }
    me = { id: u.uid, ...s.data() };
    if (justSignedIn) { justSignedIn = false; try { await auditNow('Login'); } catch (e) { console.error(e); } }
    route();
  } catch (e) { console.error(e); me = null; await signOut(auth); renderLogin('Não foi possível validar o acesso: ' + errMsg(e)); }
});
