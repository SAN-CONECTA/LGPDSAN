import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit, startAfter,
  serverTimestamp, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js?v=2.34.0';
import { BIBLIO } from './biblioteca.js?v=2.34.0';
import { MANUAL_LGPD } from './manual-lgpd.js?v=2.34.0';
import { GUIAS, RESP, guiaDe, itensDe, fmtVal, progresso, pontuacao, critIds, aplicaItem, ESTAGIOS } from './guias.js?v=2.34.0';

import { ANPD_URL, anpdData, anpdFiltra, anpdOrdena, anpdLidasSet } from './anpd.js?v=2.34.0';

const VERSION = '2.41.0';
const SITE = 'https://www.sanconecta.com';
const siteLink = (t = 'www.sanconecta.com') => `<a href="${SITE}" target="_blank" rel="noopener noreferrer">${t}</a>`;
const ROLES = { consulta: 'Consulta', edicao: 'Edição', admin: 'Administrador' };
const STATUS = ['Rascunho', 'Em vigor', 'Em revisão', 'Arquivado'];
const ACAO_STATUS = ['A fazer', 'Em andamento', 'Concluída'];
const PRIOR = ['Baixa', 'Média', 'Alta'];
const DEFAULT_CATS = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores', 'Segurança da Informação',
  'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura', 'Mapeamento de Dados'];
// Ordem sugerida de adequação (v2.23.0): por dependência, não por exigência legal. Categorias criadas pelo administrador vão ao final.
const TRILHA = [
  ['Governança e Políticas', 'Define quem responde (encarregado, art. 41) e dá mandato ao resto.'],
  ['Mapeamento de Dados', 'Base de tudo (art. 37): quais dados existem, onde estão e por quê.'],
  ['Segurança da Informação', 'Maior exposição real (art. 46); começa junto com o mapeamento.'],
  ['Incidentes', 'Plano pronto antes de acontecer (art. 48).'],
  ['Contratos e Operadores', 'Precisa do mapeamento para saber quem recebe dados.'],
  ['Retenção e Descarte', 'Precisa do mapeamento para saber o que guardar e por quanto tempo.'],
  ['Direitos dos Titulares', 'Responder em 15 dias exige saber onde estão os dados (art. 18).'],
  ['Tratamento de Email', 'Regras de uso do e-mail, que apoiam políticas e segurança.'],
  ['Treinamento e Cultura', 'Treina-se sobre o que já está decidido; contínuo.']];
const trilhaPos = c => { const i = TRILHA.findIndex(t => t[0] === c); return i < 0 ? 999 : i; };
const FIELDS = [['titulo', 'Título'], ['categoria', 'Categoria'], ['descricao', 'Descrição / procedimento'],
  ['status', 'Status'], ['prioridade', 'Prioridade'], ['responsavel', 'Responsável'], ['prazo', 'Prazo'], ['revisao', 'Próxima revisão'], ['evidencias', 'Evidências (links/referências)']];
// campos comparáveis de um registro: os fixos + os itens do checklist da categoria
const fieldList = cat => { const g = guiaDe(cat); return g ? FIELDS.concat(itensDe(g).filter(i => i.tipo !== 'resultado').flatMap(i => i.tipo === 'sn' ? [['d:' + i.id, i.label], ['d:' + i.id + '#o', 'Observação: ' + i.label], ['d:' + i.id + '#e', 'Estágio: ' + i.label]] : [['d:' + i.id, i.label]])) : FIELDS; };
const fval = (snap, k) => k.startsWith('d:') ? fmtVal((snap.dados || {})[k.slice(2)]) : (snap[k] ?? '');
const FIRM_ACTS = new Set(['Exportação CSV', 'Backup exportado (contabilidade)', 'Evidência enviada', 'Evidência excluída']);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
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
const storage = getStorage(fbApp);
storage.maxUploadRetryTime = 30000; storage.maxOperationRetryTime = 30000; // falha em ~30 s em vez de tentar por 10 minutos
// Modo emulador (teste local, sem tocar no projeto de produção): abra com ?emulador=1 na URL.
// Usa o Firebase Emulator Suite — Firestore na porta 8080 e Auth na 9099 (ver firebase.json).
if (new URLSearchParams(location.search).has('emulador')) {
  connectFirestoreEmulator(fs, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}

let me = null;
let cid = null; // contabilidade ativa
let db = { users: [], records: [], categorias: [], contabs: [], pessoas: [], presencas: [] };
let justSignedIn = false;
let presenceTimer = null, presenceRefreshTimer = null;
const ONLINE_MS = 2 * 60 * 1000;

/* ---------- caminhos (tudo de uma contabilidade fica sob contabilidades/{cid}) ---------- */
const rcol = () => collection(fs, 'contabilidades', cid, 'registros');
const rdoc = id => doc(fs, 'contabilidades', cid, 'registros', id);
const vcol = id => collection(fs, 'contabilidades', cid, 'registros', id, 'versoes');
const vdoc = (id, n) => doc(fs, 'contabilidades', cid, 'registros', id, 'versoes', String(n));
const acaoCol = () => collection(fs, 'contabilidades', cid, 'acoes');
const acaoDoc = id => doc(fs, 'contabilidades', cid, 'acoes', id);
const contabNome = id => (db.contabs.find(c => c.id === id) || {}).nome || '(removida)';
/* Publicações oficiais da ANPD: coleção global `anpd` (sincronizada por scripts/anpd_sync.py) +
   status de leitura por usuário em users/{uid}/anpdLidas. Nada disso depende de contabilidade. */
const anpdCol = () => collection(fs, 'anpd');
const anpdLidasCol = () => collection(fs, 'users', me.id, 'anpdLidas');
const presenceDoc = () => doc(fs, 'presencas', me.id);

/* ---------- permissões ---------- */
const cur = r => r.snap;
const can = {
  edit: () => me && me.role !== 'consulta',
  admin: () => me && me.role === 'admin',
  export: () => me && me.role !== 'consulta',
  editRec: r => me && (me.role === 'admin' || (me.role === 'edicao' && cur(r).status !== 'Arquivado' && !r.deleted))
};
const catList = () => db.categorias.slice().sort((a, b) => trilhaPos(a) - trilhaPos(b) || a.localeCompare(b, 'pt-BR'));

/* ---------- auditoria (gravada no servidor, só criação) ---------- */
const isSys = (acao, rec) => !rec && !FIRM_ACTS.has(acao);
const aCol = sys => sys ? collection(fs, 'auditoria') : collection(fs, 'contabilidades', cid, 'auditoria');
function auditData(acao, rec, detalhe, sys) {
  return { ts: serverTimestamp(), userId: me.id, user: me.nome, userEmail: me.email || '', role: me.role, acao, recId: rec ? rec.id : null,
    recTitulo: rec ? cur(rec).titulo : '', detalhe: detalhe || '', escopo: sys ? 'sistema' : 'registro', contabId: sys ? null : cid };
}
const auditOp = (batch, acao, rec, detalhe) => { const s = isSys(acao, rec); batch.set(doc(aCol(s)), auditData(acao, rec, detalhe, s)); };
const auditNow = (acao, rec, detalhe) => { const s = isSys(acao, rec); return setDoc(doc(aCol(s)), auditData(acao, rec, detalhe, s)); };

/* ---------- presença: sinal renovado a cada minuto; sem sinal por 2 min = offline ---------- */
async function pingPresence() {
  if (!me) return;
  await setDoc(presenceDoc(), { userId: me.id, user: me.nome, userEmail: me.email || '', role: me.role, lastSeen: serverTimestamp() });
}
function startPresence() {
  clearInterval(presenceTimer);
  pingPresence().catch(e => console.warn('Presença não atualizada', e));
  presenceTimer = setInterval(() => pingPresence().catch(e => console.warn('Presença não atualizada', e)), 60000);
}
function stopPresence() { clearInterval(presenceTimer); presenceTimer = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pingPresence().catch(() => {}); });

/* ---------- UI utilitários ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4500); }
function errMsg(e) {
  const c = e && e.code || '';
  if (c === 'permission-denied') return 'Operação negada: sem permissão ou o registro foi alterado por outra pessoa. Recarregue a página e tente de novo.';
  if (c === 'storage/unauthorized') return 'Sem permissão para enviar ou abrir arquivos. Confira se as regras do Storage (storage.rules) estão publicadas e se seu perfil tem acesso a esta contabilidade.';
  if (c === 'storage/retry-limit-exceeded' || c === 'storage/unknown') return 'O envio não concluiu a tempo. Verifique a conexão e se o Storage está ativado no Firebase (plano Blaze) com as regras publicadas.';
  if (c === 'storage/object-not-found') return 'O arquivo não foi encontrado no Storage.';
  if (c === 'unavailable') return 'Sem conexão com o servidor. Tente novamente.';
  if (c === 'auth/email-already-in-use') return 'Este e-mail já existe no Authentication. Desbloqueie o usuário existente ou remova a conta no console do Firebase.';
  if (c === 'auth/weak-password') return 'Senha fraca.';
  return 'Erro: ' + (e && e.message || e);
}
/* ---------- logo do escritório (guardada como imagem pequena no documento da contabilidade) ---------- */
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const logoOk = l => typeof l === 'string' && l.length <= 300000 && LOGO_RE.test(l);
const firmLogo = (id = cid) => { const c = db.contabs.find(x => x.id === id); return c && logoOk(c.logo) ? c.logo : ''; };
async function prepararLogo(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use uma imagem PNG, JPG ou WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 5 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Não foi possível ler a imagem.')); i.src = url; });
    // 1) recorta margens vazias (transparentes ou quase brancas), para a marca ocupar o espaço de 480×180
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    try {
      const k = Math.min(1, 800 / Math.max(img.width, img.height)), tw = Math.max(1, Math.round(img.width * k)), th = Math.max(1, Math.round(img.height * k));
      const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
      const tx = tc.getContext('2d', { willReadFrequently: true }); tx.drawImage(img, 0, 0, tw, th);
      const px = tx.getImageData(0, 0, tw, th).data; let x0 = tw, y0 = th, x1 = -1, y1 = -1;
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = (y * tw + x) * 4;
        if (px[i + 3] > 12 && (px[i] < 240 || px[i + 1] < 240 || px[i + 2] < 240)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 >= x0 && y1 >= y0) {
        const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
        x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(tw - 1, x1 + pad); y1 = Math.min(th - 1, y1 + pad);
        sx = x0 / k; sy = y0 / k; sw = (x1 - x0 + 1) / k; sh = (y1 - y0 + 1) / k;
      }
    } catch (e) { /* sem recorte: segue com a imagem inteira */ }
    // 2) reduz para no máximo 480×180 px, mantendo a proporção
    let scale = Math.min(1, 480 / sw, 180 / sh);
    for (let t = 0; t < 6; t++, scale *= 0.8) {
      const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const out = file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
      if (logoOk(out) && out.length <= 150000) return out;
    }
    throw new Error('Imagem complexa demais; use um arquivo menor ou mais simples.');
  } finally { URL.revokeObjectURL(url); }
}
/* ---------- tema claro / escuro (escolha por usuário) ---------- */
const TEMAS = { auto: 'Automático (do sistema)', claro: 'Claro (verde-azulado)', azul: 'Azul', lilas: 'Lilás', rosa: 'Rosa', laranja: 'Laranja', verde: 'Verde', grafite: 'Grafite', escuro: 'Escuro', 'escuro-azul': 'Escuro azulado', 'escuro-lilas': 'Escuro lilás' };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: vale só nesta sessão */ } };
function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'claro') el.dataset.theme = 'light'; else if (t === 'escuro') el.dataset.theme = 'dark'; else if (t !== 'auto' && t in TEMAS) el.dataset.theme = t; else delete el.dataset.theme;
}
const temaDe = u => [u && u.tema, u && lsGet('lgpdsan:tema:' + u.id)].find(t => t in TEMAS) || 'auto'; // 'lgpdsan:tema' (sem usuário) só evita o piscar na tela de login
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
// revisão periódica e aprovação formal (v2.17.0)
const diasAte = d => Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
const revInfo = r => { const c = cur(r); if (!c.revisao || c.status === 'Arquivado' || r.deleted) return null; const n = diasAte(c.revisao);
  return n < 0 ? { n, k: 'bad', t: `revisão vencida há ${-n} dia(s)` } : n <= 30 ? { n, k: 'warn', t: n === 0 ? 'revisão hoje' : `revisão em ${n} dia(s)` } : null; };
const revTag = r => { const v = revInfo(r); return v ? `<span class="tag ${v.k}">${v.t}</span>` : ''; };
const aprovada = r => !!r.aprovacao && r.aprovacao.versao === r.versao;
const semAprov = r => !r.deleted && cur(r).status === 'Em vigor' && !aprovada(r);
const maisMeses = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
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
  db.contabsAll = db.contabs; // inclui as excluídas (só a tela Contabilidades as mostra, para restaurar)
  db.contabs = db.contabs.filter(c => !c.excluida);
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

  if (can.admin()) {
    const [users, presencas] = await Promise.all([getDocs(collection(fs, 'users')), getDocs(collection(fs, 'presencas'))]);
    db.users = users.docs.map(d => ({ id: d.id, ...d.data() }));
    db.presencas = presencas.docs.map(d => ({ id: d.id, ...d.data() }));
  } else { db.users = [me]; db.presencas = []; }
  if (cid) {
    db.pessoas = (await getDocs(collection(fs, 'contabilidades', cid, 'pessoas'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const q = can.admin() ? rcol() : query(rcol(), where('deleted', '==', false));
    db.records = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } else { db.pessoas = []; db.records = []; }
}
// evidências da contabilidade ativa (se as regras ainda não foram publicadas, segue sem elas e a pontuação "comprovada" fica indisponível)
async function loadEvid() {
  try { db.evid = (await getDocs(evCol())).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => tms(b.ts) - tms(a.ts)); db.evidOk = true; }
  catch (e) { db.evid = []; db.evidOk = false; }
}
const evDe = (recId, itemId) => (db.evid || []).filter(e => e.registroId === recId && (!itemId || e.itemId === itemId));
const evPorItem = recId => { if (!db.evidOk) return null; const o = {}; (db.evid || []).forEach(e => { if (e.registroId === recId && e.itemId) o[e.itemId] = (o[e.itemId] || 0) + 1; }); return o; };
async function loadAudit(n = 500) {
  const q = query(collection(fs, 'contabilidades', cid, 'auditoria'), orderBy('ts', 'desc'), limit(n));
  return (await getDocs(q)).docs.map(d => d.data()).sort((a, b) => tms(b.ts) - tms(a.ts));
}
async function loadSysAudit(n = 200) {
  const q = query(collection(fs, 'auditoria'), orderBy('ts', 'desc'), limit(n));
  return (await getDocs(q)).docs.map(d => d.data()).sort((a, b) => tms(b.ts) - tms(a.ts));
}
const responsaveis = () => [...new Set([me.nome, ...db.pessoas.map(p => p.nome)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* ---------- atualizações ANPD (leitura + status de leitura por usuário) ---------- */
async function loadAnpd() {
  const [ps, ls] = await Promise.all([getDocs(anpdCol()), getDocs(anpdLidasCol())]);
  const pubs = ps.docs.map(d => ({ id: d.id, ...d.data() }));
  db.anpd = anpdOrdena(pubs);
  db.anpdLidas = anpdLidasSet(ls.docs);
  db.anpdUnread = pubs.filter(p => !db.anpdLidas.has(p.id)).length;
  anpdBadgeAt = Date.now();
  return { pubs: db.anpd, lidas: db.anpdLidas, unread: db.anpdUnread };
}
const paintBadge = () => { const n = db.anpdUnread ? String(db.anpdUnread) : ''; ['#anpd-badge', '#anpd-bell-badge'].forEach(s => { const b = $(s); if (b) { b.textContent = n; b.hidden = !db.anpdUnread; } }); };
let anpdBadgeAt = 0;
// Atualiza o contador "não lidas" no menu. Cache de 60 s para não reler o Firestore a cada navegação.
async function refreshAnpdBadge(force) {
  const now = Date.now();
  if (!force && db.anpdUnread !== undefined && now - anpdBadgeAt < 60000) { paintBadge(); return; }
  try { await loadAnpd(); } catch (e) { db.anpdUnread = null; }
  anpdBadgeAt = now; paintBadge();
}
const anpdMarcar = (id, lida) => lida
  ? setDoc(doc(fs, 'users', me.id, 'anpdLidas', id), { pubId: id, quando: serverTimestamp() })
  : deleteDoc(doc(fs, 'users', me.id, 'anpdLidas', id));

/* ---------- busca global (top bar) ---------- */
async function buscaGlobal(q) {
  const t = String(q || '').trim().toLowerCase();
  if (t.length < 2) return [];
  const out = [];
  for (const r of (db.records || [])) {
    if (r.deleted) continue;
    const c = cur(r);
    if ([c.titulo, c.descricao, c.responsavel, c.categoria, c.evidencias].join(' ').toLowerCase().includes(t))
      out.push({ tipo: 'Registro', t: c.titulo, s: c.categoria, href: recLink(r) });
  }
  if (!db.evidOk) { try { await loadEvid(); } catch (e) {} }
  for (const e of (db.evid || [])) {
    if ([e.nome, e.descricao, e.autor].join(' ').toLowerCase().includes(t))
      out.push({ tipo: 'Evidência', t: e.nome, s: e.autor || '', href: '#/evidencias' });
  }
  try {
    const aud = await loadAudit(150);
    for (const a of aud) {
      if ([a.acao, a.user, a.recTitulo].join(' ').toLowerCase().includes(t))
        out.push({ tipo: 'Evento', t: a.acao, s: `${a.user} · ${a.recTitulo || ''}`, href: '#/auditoria' });
    }
  } catch (e) {}
  return out.slice(0, 20);
}
let buscaDocLigada = false;
function ligaBuscaGlobal() {
  const inp = $('#gsearch'), pop = $('#gsearch-pop');
  if (!inp || !pop) return;
  let timer = null, seqB = 0;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    const my = ++seqB;
    if (!inp.value.trim()) { pop.hidden = true; return; }
    timer = setTimeout(async () => {
      const rs = await buscaGlobal(inp.value);
      if (my !== seqB) return;
      pop.innerHTML = rs.length
        ? rs.map(r => `<a class="grow" href="${r.href}"><span class="gtipo">${esc(r.tipo)}</span><span class="gt">${esc(r.t)}</span><span class="gs">${esc(r.s)}</span></a>`).join('')
        : '<div class="gempty">Nada encontrado.</div>';
      pop.hidden = false;
    }, 300);
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') { pop.hidden = true; inp.blur(); } });
  if (!buscaDocLigada) {
    buscaDocLigada = true;
    document.addEventListener('click', e => { const p = $('#gsearch-pop'); if (p && !e.target.closest('.gsearch-box')) p.hidden = true; });
  }
}

/* ---------- roteamento ---------- */
const app = $('#app');
const routes = [
  ['#/', 'Painel', renderDash, null, true], ['#/registros', 'Registros', renderList, null, true], ['#/plano-acao', 'Plano de ação', renderAcoes, null, true], ['#/evidencias', 'Evidências', renderEvid, null, true], ['#/auditoria', 'Auditoria', renderAudit, null, true], ['#/biblioteca', 'Biblioteca', renderBiblio], ['#/termo', 'Termo de Ciência', renderTermo, null, true], ['#/manual', 'Manual', renderManual], ['#/anpd', 'Atualizações ANPD', renderAnpd], ['#/manual-lgpd', 'Manual da LGPD', renderManualLgpd, 'admin'],
  ['#/usuarios', 'Usuários', renderUsers, 'admin'], ['#/contabilidades', 'Contabilidades', renderContabs, 'admin'],
  ['#/categorias', 'Categorias', renderCats, 'admin'], ['#/backup', 'Backup', renderBackup, 'admin', true], ['#/sobre', 'Sobre / versão', renderAbout]
];
// Grupos recolhíveis do menu (v2.30.2). [id, título, itens [hash, rótulo, soAdmin]]
const GRUPOS = [
  ['contabilidade', 'Contabilidade', [['#/', 'Painel', false], ['#/registros', 'Registros', false], ['#/plano-acao', 'Plano de ação', false], ['#/evidencias', 'Evidências', false], ['#/termo', 'Termo de Ciência', false]]],
  ['controle', 'Controle', [['#/auditoria', 'Auditoria', false], ['#/usuarios', 'Usuários', true], ['#/contabilidades', 'Contabilidades', true]]],
  ['aprendizado', 'Aprendizado', [['#/anpd', 'Atualizações ANPD', false], ['#/biblioteca', 'Biblioteca', false], ['#/manual', 'Manual', false], ['#/manual-lgpd', 'Manual da LGPD', true]]],
  ['config', 'Configurações', [['#/categorias', 'Categorias', true], ['#/backup', 'Backup', true], ['#/sobre', 'Sobre / versão', false]]]
];
const NAV_EMOJIS = {
  'Painel': '📊', 'Registros': '📄', 'Plano de ação': '✅', 'Evidências': '📎', 'Termo de Ciência': '✍️',
  'Auditoria': '🕘', 'Usuários': '👥', 'Contabilidades': '🏢', 'Atualizações ANPD': '🔔',
  'Biblioteca': '📚', 'Manual': '📖', 'Manual da LGPD': '🛡️', 'Categorias': '⚙️',
  'Backup': '⬇️', 'Sobre / versão': 'ℹ️'
};
const GRUPO_EMOJIS = { contabilidade: '💼', controle: '🛠️', aprendizado: '📚', config: '⚙️' };
const gruposAbertos = new Set(['contabilidade']);
let bind = null, seq = 0;
function contabSelector() {
  if (db.contabs.length > 1) return `<label for="cs" style="margin-top:0">Contabilidade</label><select id="cs">${db.contabs.map(c => `<option value="${esc(c.id)}" ${c.id === cid ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`;
  if (db.contabs.length === 1) return `<div class="small muted">Contabilidade</div><div><b>${esc(db.contabs[0].nome)}</b></div>`;
  return '<div class="small muted">Nenhuma contabilidade</div>';
}
// O menu lateral rola quando há grupos abertos demais para a tela; mantém à vista o elemento indicado.
function mostraNoMenu(el) {
  const side = document.querySelector('.side');
  if (!el || !side || side.scrollHeight <= side.clientHeight) return;
  const r = el.getBoundingClientRect(), s = side.getBoundingClientRect(), baixo = r.bottom - s.bottom;
  if (baixo > 0) side.scrollTop += Math.min(baixo + 8, Math.max(r.top - s.top, 0));   // sem esconder o topo do próprio elemento
  else if (r.top < s.top) side.scrollTop -= s.top - r.top + 8;
}
async function route() {
  if (!me) return renderLogin();
  const my = ++seq;
  const h = location.hash || '#/';
  if (h !== '#/usuarios') { clearTimeout(presenceRefreshTimer); presenceRefreshTimer = null; }
  let view, main = h, needs = false, recRoute = null;
  if (h.startsWith('#/registro/')) { const p = h.split('/'); recRoute = { c: p[2], id: p[3] }; main = '#/registros'; needs = true; }
  else if (h.startsWith('#/biblioteca/')) { main = '#/biblioteca'; const slug = h.slice(13); view = () => renderBiblioDoc(slug); }
  else if (h.startsWith('#/manual-lgpd/')) { main = '#/manual-lgpd'; const cod = decodeURIComponent(h.slice(14)); view = can.admin() ? () => renderManualLgpdDoc(cod) : () => `<h1>Acesso negado</h1><p class="muted">Seu perfil não permite acessar esta área.</p>`; }
  else {
    const r = routes.find(x => x[0] === h) || routes[0];
    main = r[0]; needs = !!r[4];
    view = (r[3] === 'admin' && !can.admin()) ? () => `<h1>Acesso negado</h1><p class="muted">Seu perfil não permite acessar esta área.</p>` : r[2];
  }
  const mk = (hash, rot, cls, extra = '') => `<a href="${hash}" class="${cls || ''}${hash === main ? ' on' : ''}"><span class="nav-icon" aria-hidden="true">${NAV_EMOJIS[rot] || '•'}</span><span>${esc(rot)}</span>${extra}</a>`;
  const nav = GRUPOS.map(g => {
    const itens = g[2].filter(x => !x[2] || can.admin());
    if (!itens.length) return '';
    const ativo = itens.some(x => x[0] === main);
    if (ativo) gruposAbertos.add(g[0]);
    const aberto = gruposAbertos.has(g[0]);
    const csel = g[0] === 'contabilidade' ? '<div id="csel" class="csel"></div>' : '';
    return `<div class="grp${aberto ? ' open' : ''}${ativo ? ' ativo' : ''}" data-g="${g[0]}"><button type="button" class="grph" aria-expanded="${aberto}"><span><span class="group-icon" aria-hidden="true">${GRUPO_EMOJIS[g[0]] || '•'}</span>${esc(g[1])}</span><span class="car" aria-hidden="true"></span></button><div class="subnav">${csel}${itens.map(x => mk(x[0], x[1], '', x[0] === '#/anpd' ? '<span class="anpd-badge" id="anpd-badge" hidden></span>' : '')).join('')}</div></div>`;
  }).join('');
  const rolagemMenu = (document.querySelector('.side') || {}).scrollTop || 0;
  app.innerHTML = `<div class="shell"><aside class="side"><div class="app-brand"><img src="assets/logo-icon.png" alt=""><span><b>LGPDSAN</b><small>Conformidade LGPD</small></span></div>
    <nav class="nav">${nav}</nav>
    <div class="who small"><b>${esc(me.nome)}</b><br><span class="muted">${ROLES[me.role]} · v${VERSION}</span><div class="themesel"><label for="tema">Tema</label><select id="tema">${Object.entries(TEMAS).map(([k, v]) => `<option value="${k}"${k === me.tema ? ' selected' : ''}>${v}</option>`).join('')}</select></div><button class="link" id="out">Sair</button></div></aside>
    <div class="content"><header class="topbar"><div class="crumbs" id="crumbs"></div><div class="topbar-right"><div class="gsearch-box"><input id="gsearch" type="search" placeholder="Buscar registros, evidências e eventos…" autocomplete="off" aria-label="Busca global"><div class="gsearch-pop" id="gsearch-pop" hidden></div></div><a class="bell" id="anpd-bell" href="#/anpd" title="Atualizações ANPD" aria-label="Atualizações ANPD">🔔<span class="anpd-badge" id="anpd-bell-badge" hidden></span></a></div></header>
    <main id="main"><p class="muted">Carregando…</p></main></div></div>`;
  { const sd = document.querySelector('.side'); if (sd) sd.scrollTop = rolagemMenu; mostraNoMenu(document.querySelector('.nav a.on')); }
  document.querySelectorAll('.nav .grph').forEach(bt => bt.onclick = () => {
    const gd = bt.parentElement, id = gd.dataset.g, ab = !gd.classList.contains('open');
    gd.classList.toggle('open', ab); bt.setAttribute('aria-expanded', ab);
    if (ab) { gruposAbertos.add(id); mostraNoMenu(gd); } else gruposAbertos.delete(id);
  });
  $('#out').onclick = guard(logout);
  ligaBuscaGlobal();
  $('#tema').onchange = async e => { const t = e.target.value; me.tema = t; applyTheme(t); lsSet('lgpdsan:tema:' + me.id, t); lsSet('lgpdsan:tema', t);
    try { await updateDoc(doc(fs, 'users', me.id), { tema: t }); } catch (err) { /* sem permissão nas regras: a escolha fica só neste navegador */ } };
  let html;
  try {
    bind = null;
    if (recRoute && recRoute.c) { cid = recRoute.c; }
    await loadCore();
    if (my !== seq) return;
    $('#csel').innerHTML = contabSelector();
    const rot = routes.find(r => r[0] === main);
    $('#crumbs').innerHTML = `${esc(contabNome(cid))} / ${esc(rot ? rot[1] : '')}`;
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
  refreshAnpdBadge();
}
window.addEventListener('hashchange', route);

/* ---------- login ---------- */
function renderLogin(msg = '') {
  app.innerHTML = `<div class="login-shell"><section class="login-hero" aria-label="LGPDSAN">
    <div class="login-brand"><img src="assets/logo-icon.png" alt=""><span><b>LGPDSAN</b><small>SAN Conecta</small></span></div>
    <div class="login-hero-copy"><h1>Conformidade LGPD do escritório,<br>registrada e auditável.</h1><p>Políticas, contratos, evidências e checklists de cada contabilidade em um só lugar, com histórico de versões e trilha de auditoria.</p>
      <ul><li>Cada edição gera uma nova versão, com justificativa</li><li>Auditoria só de criação: ninguém altera ou apaga eventos</li><li>Dados de cada contabilidade isolados no servidor</li></ul></div>
    <p class="login-hero-foot">Dados no Firestore, região São Paulo · ${siteLink()}</p>
  </section><main class="login-panel"><div class="card login-card"><h1 class="prod-title">Entrar</h1><p class="muted small">Use o e-mail cadastrado pelo administrador.</p>
    <form id="f"><label for="em">E-mail</label><input id="em" type="email" required autocomplete="username">
    <label for="pw">Senha</label><input id="pw" type="password" required autocomplete="current-password">
    <p id="err" class="small form-error">${esc(msg)}</p>
    <button class="primary" style="width:100%">Entrar</button></form>
    <p class="small" style="margin-top:.75rem"><button class="link" id="fp" type="button">Esqueci minha senha</button></p>
    <p class="small muted login-meta">Acesso restrito a usuários cadastrados pelo administrador.<br><span>v${VERSION} · ${siteLink()}</span></p></div></main></div>`;
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
async function logout() { try { await auditNow('Logout'); } catch (e) {} try { await deleteDoc(presenceDoc()); } catch (e) {} stopPresence(); me = null; cid = null; try { sessionStorage.removeItem('lgpdsan:cid'); } catch (e) {} await signOut(auth); location.hash = '#/'; }

/* ---------- painel ---------- */
const recLink = r => `#/registro/${cid}/${r.id}`;
function trilhaHtml(rs) {
  const cats = catList(), passos = cats.map(c => { const rc = rs.filter(r => cur(r).categoria === c), vig = rc.filter(r => cur(r).status === 'Em vigor').length, g = guiaDe(c);
    const decl = g && rc.length ? Math.round(rc.reduce((a, r) => a + pontuacao(g, cur(r).dados).declarado, 0) / rc.length) : null;
    return { c, n: rc.length, vig, decl, dica: (TRILHA.find(t => t[0] === c) || [])[1] || 'Categoria acrescentada pelo administrador.' }; });
  const prox = passos.find(p => !p.vig);
  const proxN = passos.indexOf(prox), visiveis = prox ? passos.slice(proxN, proxN + 3) : passos.slice(-3);
  const tabela = `<div class="tablewrap"><table><tr><th>#</th><th>Categoria</th><th>Situação</th><th>Registros</th><th>Declarado</th></tr>${passos.map((p, i) => `<tr${p === prox ? ' class="is-highlight"' : ''}><td>${i + 1}</td><td><b>${esc(p.c)}</b>${p === prox ? ' <span class="tag brand">próximo passo</span>' : ''}<br><span class="muted small">${esc(p.dica)}</span></td>
    <td><span class="tag ${p.vig ? 'ok' : p.n ? 'warn' : ''}">${p.vig ? 'Em vigor' : p.n ? 'Em andamento' : 'Não iniciada'}</span></td><td>${p.n}</td><td>${p.decl === null ? '<span class="muted">—</span>' : p.decl + '%'}</td></tr>`).join('')}</table></div>`;
  if (!prox) return `<div class="journey-done"><span aria-hidden="true">✓</span><div><b>Trilha concluída</b><p>Há registros em vigor em todas as categorias. Continue acompanhando revisões e prazos.</p></div></div><details class="journey-all"><summary>Ver todas as ${passos.length} etapas</summary>${tabela}</details>`;
  return `<div class="journey-next"><div class="journey-step">${proxN + 1}</div><div class="journey-copy"><span class="dash-eyebrow">COMECE POR AQUI</span><h3>${esc(prox.c)}</h3><p>${esc(prox.dica)}</p></div><div class="journey-action">${can.edit() ? `<button class="primary" type="button" data-start-cat="${esc(prox.c)}">${prox.n ? 'Continuar etapa' : 'Criar primeiro registro'}</button>` : `<a class="btn" href="#/registros" data-start-cat="${esc(prox.c)}">Ver registros</a>`}<span class="small muted">${prox.n ? `${prox.n} registro(s) nesta etapa` : 'Nenhum registro criado'}</span></div></div>
    <div class="journey-upcoming">${visiveis.map((p, i) => `<div class="journey-mini${p === prox ? ' is-now' : ''}"><span>${proxN + i + 1}</span><div><b>${esc(p.c)}</b><small>${p.vig ? 'Concluída' : p.n ? 'Em andamento' : p === prox ? 'Etapa atual' : 'A seguir'}</small></div>${p.vig ? '<i aria-label="Concluída">✓</i>' : ''}</div>`).join('')}</div>
    <details class="journey-all"><summary>Ver todas as ${passos.length} etapas e indicadores</summary>${tabela}</details>`;
}
async function renderDash() {
  const rs = db.records.filter(r => !r.deleted);
  const by = s => rs.filter(r => cur(r).status === s).length;
  const od = rs.filter(overdue);
  const rv = rs.filter(r => revInfo(r)).sort((a, b) => cur(a).revisao.localeCompare(cur(b).revisao)), sa = rs.filter(semAprov);
  const mine = rs.filter(r => cur(r).responsavel === me.nome && cur(r).status !== 'Arquivado');
  let minhasAcoes = [];
  try { minhasAcoes = (await getDocs(acaoCol())).docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.responsavel === me.nome && a.status !== 'Concluída'); } catch (e) {}
  const emSeteDias = new Date(); emSeteDias.setDate(emSeteDias.getDate() + 7);
  const limiteSemana = emSeteDias.toISOString().slice(0, 10);
  minhasAcoes.sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
  const semana = minhasAcoes.filter(a => !a.prazo || a.prazo <= limiteSemana);
  const recent = (await loadAudit(8)).slice(0, 6);
  const trilha = catList();
  const proximaCategoria = trilha.find(c => !rs.some(r => cur(r).categoria === c && cur(r).status === 'Em vigor')) || trilha[0];
  const categoriasIniciadas = trilha.filter(c => rs.some(r => cur(r).categoria === c)).length;
  bind = () => {
    $$('[data-start-cat]').forEach(el => el.addEventListener('click', () => { try { sessionStorage.setItem('lgpdsan:preselectCategoria', el.dataset.startCat); } catch (e) {} location.hash = '#/registros'; }));
    $$('[data-quick-list]').forEach(el => el.addEventListener('click', () => { try { sessionStorage.setItem('lgpdsan:quickList', el.dataset.quickList); } catch (e) {} location.hash = '#/registros'; }));
  };
  let anpdCard = '';
  try {
    const a = await loadAnpd();
    const recentA = a.pubs.slice(0, 5);
    anpdCard = `<div class="card"><h2>Atualizações ANPD</h2>${a.unread ? `<p class="small"><span class="tag brand">${a.unread} nova(s)</span> publicação(ões) ainda não lida(s).</p>` : '<p class="small muted">Tudo lido por enquanto.</p>'}
    ${recentA.length ? recentA.map(p => `<div class="fieldrow small"><b>${a.lidas.has(p.id) ? '' : '<span class="tag brand">nova</span> '}<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.titulo)}</a></b> <span class="muted">· ${anpdData(p) ? fmtD(anpdData(p)) : ''}</span></div>`).join('') : '<p class="muted">Nenhuma publicação sincronizada ainda.</p>'}
    <div class="actions" style="margin-top:.5rem"><a class="btn" href="#/anpd">Ver todas</a></div></div>`;
  } catch (e) { /* regras do Firestore sem a seção anpd: o cartão simplesmente não aparece */ }
  return `<section class="dash-hero"><div class="dash-hero-title">${firmLogo() ? `<div class="dash-firm-logo"><img src="${firmLogo()}" alt="Logo ${esc(contabNome(cid))}"></div>` : ''}<div><p class="dash-eyebrow">VISÃO GERAL</p><h1>Painel de conformidade</h1><p class="muted">${esc(contabNome(cid))} · acompanhe prioridades, pendências e evolução da LGPD.</p></div></div>
    ${can.edit() ? '<a class="btn primary dash-new" href="#/registros" id="dnew">+ Novo registro</a>' : ''}</section>
    <section class="dash-progress" aria-label="Próximo passo recomendado"><div class="dash-progress-icon" aria-hidden="true">✦</div><div><span class="dash-eyebrow">PRÓXIMO PASSO</span><b>${esc(proximaCategoria || 'Comece sua adequação')}</b><p>${categoriasIniciadas ? `${categoriasIniciadas} de ${trilha.length} categorias já iniciadas.` : 'Registre a primeira ação para começar a organizar a adequação.'}</p></div><button class="btn primary" type="button" data-start-cat="${esc(proximaCategoria || '')}">${can.edit() ? 'Começar agora' : 'Ver categoria'}</button></section>
    <section class="metrics-section" aria-label="Resumo dos registros"><div class="section-label"><span>Resumo</span><small>situação dos registros</small></div><div class="metrics-grid"><div class="stat stat-main"><span class="stat-icon" aria-hidden="true">📄</span><b>${rs.length}</b><span>Registros ativos</span></div>
    <div class="stat stat-ok"><span class="stat-icon" aria-hidden="true">✓</span><b>${by('Em vigor')}</b><span>Em vigor</span></div><div class="stat"><span class="stat-icon" aria-hidden="true">↻</span><b>${by('Em revisão')}</b><span>Em revisão</span></div>
    <button class="stat stat-action is-critical" type="button" data-quick-list="overdue" aria-label="Ver ${od.length} prazo(s) vencido(s)"><span class="stat-icon" aria-hidden="true">!</span><b class="${od.length ? 'tone-bad' : ''}">${od.length}</b><span>Prazos vencidos</span><small>Ver lista</small></button>
    <button class="stat stat-action is-attention" type="button" data-quick-list="review" aria-label="Ver ${rv.length} revisão(ões) próxima(s) ou vencida(s)"><span class="stat-icon" aria-hidden="true">◷</span><b class="${rv.some(r => revInfo(r).n < 0) ? 'tone-bad' : rv.length ? 'tone-warn' : ''}">${rv.length}</b><span>Revisões em 30 dias</span><small>Ver lista</small></button>
    <div class="stat is-attention"><span class="stat-icon" aria-hidden="true">⌁</span><b class="${sa.length ? 'tone-warn' : ''}">${sa.length}</b><span>Sem aprovação atual</span></div></div></section>
    <div class="dashboard-layout"><div class="dashboard-primary">
      <div class="card dashboard-trilha"><div class="card-heading"><div><span class="dash-eyebrow">ROTEIRO</span><h2>Trilha de adequação</h2></div><span class="tag brand">${categoriasIniciadas}/${trilha.length} iniciadas</span></div><p class="muted small">Ordem sugerida por dependência entre os temas. “Em vigor” indica que há ao menos um registro vigente na categoria.</p>${trilhaHtml(rs)}</div>
      <div class="card"><h2><span aria-hidden="true">⚠️</span> Prazos vencidos</h2>${od.length ? miniTable(od) : '<p class="muted">Nenhum prazo vencido.</p>'}</div>
      <div class="card"><h2><span aria-hidden="true">🕘</span> Revisões vencidas ou nos próximos 30 dias</h2>${rv.length ? `<div class="tablewrap"><table><tr><th>Registro</th><th>Categoria</th><th>Próxima revisão</th><th></th></tr>${rv.map(r => `<tr><td><a href="${recLink(r)}">${esc(cur(r).titulo)}</a></td><td>${esc(cur(r).categoria)}</td><td>${fmtD(cur(r).revisao)}</td><td>${revTag(r)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nenhuma revisão vencida ou próxima do vencimento. Defina a "Próxima revisão" nos registros de políticas, contratos, treinamentos e avaliações.</p>'}</div>
    </div><aside class="dashboard-secondary">
      ${anpdCard}
      <div class="card"><h2><span aria-hidden="true">🛡️</span> Em vigor sem aprovação atual</h2>${sa.length ? miniTable(sa) : '<p class="muted">Todos os registros em vigor têm a versão atual aprovada.</p>'}</div>
      <div class="card"><h2><span aria-hidden="true">📅</span> Minha semana</h2>${semana.length ? semana.slice(0, 5).map(a => `<div class="fieldrow small"><b>${esc(a.titulo)}</b>${a.prazo ? ` <span class="tag ${a.prazo < today() ? 'bad' : 'warn'}">${a.prazo < today() ? 'vencida' : fmtD(a.prazo)}</span>` : ''}<br><span class="muted">${esc(a.registroTitulo)} · ${esc(a.status)}</span></div>`).join('') + `<div class="actions" style="margin-top:.5rem"><a class="btn" href="#/plano-acao">Ver plano de ação</a></div>` : '<p class="muted">Nenhuma ação para os próximos 7 dias.</p>'}</div>
      <div class="card"><h2><span aria-hidden="true">👤</span> Registros atribuídos a mim</h2>${mine.length ? miniTable(mine) : '<p class="muted">Nada atribuído a você.</p>'}</div>
      <div class="card"><h2><span aria-hidden="true">🕘</span> Atividade recente</h2>${recent.length ? recent.map(a => `<div class="fieldrow small"><b>${esc(a.acao)}</b> · ${esc(a.user)} · <span class="muted">${fmt(a.ts)}</span><br>${esc(a.recTitulo)}</div>`).join('') : '<p class="muted">Sem atividade.</p>'}</div>
    </aside></div>`;
}
const chkCell = (g, d, recId) => { const p = progresso(g, d), q = pontuacao(g, d, evPorItem(recId));
  return `<span class="tag ${p.nao ? 'bad' : p.pend ? 'warn' : 'ok'}" title="Declarado: o que foi respondido (itens críticos pesam 2; Parcial vale metade)">Decl. ${q.declarado}%</span> <span class="tag ${q.comprovado === null ? '' : q.comprovado >= q.declarado && q.declarado ? 'ok' : 'warn'}" title="Comprovado: itens Conforme com evidência anexada (e, nos críticos, estágio Implantado ou Testado)">Comp. ${q.comprovado === null ? '—' : q.comprovado + '%'}</span> <span class="muted small">${p.pend} pend.</span>`; };
const miniTable = rs => `<div class="tablewrap"><table><tr><th>Registro</th><th>Status</th><th>Prazo</th></tr>${rs.map(r => `<tr><td><a href="${recLink(r)}">${esc(cur(r).titulo)}</a></td><td>${statusTag(cur(r).status)}</td><td>${fmtD(cur(r).prazo)}</td></tr>`).join('')}</table></div>`;

/* ---------- lista ---------- */
async function renderList() {
  await loadEvid();
  bind = () => {
    const q = $('#q'), fc = $('#fc'), fs_ = $('#fs'), fp = $('#fp'), fd = $('#fd');
    let quickScope = '';
    try {
      const categoriaInicial = sessionStorage.getItem('lgpdsan:preselectCategoria');
      if (categoriaInicial && [...fc.options].some(o => o.value === categoriaInicial)) { fc.value = categoriaInicial; sessionStorage.removeItem('lgpdsan:preselectCategoria'); }
      quickScope = sessionStorage.getItem('lgpdsan:quickList') || '';
      sessionStorage.removeItem('lgpdsan:quickList');
    } catch (e) {}
    const quickLabels = { overdue: 'Prazos vencidos', review: 'Revisões vencidas ou nos próximos 30 dias' };
    const quickNote = $('#quick-filter');
    const clearQuick = () => { quickScope = ''; quickNote.hidden = true; draw(); };
    if (quickScope && quickLabels[quickScope]) { $('#quick-filter-name').textContent = quickLabels[quickScope]; quickNote.hidden = false; $('#clear-quick').onclick = clearQuick; }
    let shown = [];
    const draw = () => {
      const t = q.value.toLowerCase();
      shown = db.records.filter(r => fd.value === 'del' ? r.deleted : !r.deleted).filter(r => { const c = cur(r);
        return (!fc.value || c.categoria === fc.value) && (!fs_.value || c.status === fs_.value) && (!fp.value || c.prioridade === fp.value) &&
          (!quickScope || quickScope === 'overdue' && overdue(r) || quickScope === 'review' && !!revInfo(r)) &&
          (!t || [c.titulo, c.descricao, c.responsavel, c.evidencias, c.categoria].join(' ').toLowerCase().includes(t)); })
        .sort((a, b) => cur(a).titulo.localeCompare(cur(b).titulo, 'pt-BR'));
      $('#cnt').textContent = `${contabNome(cid)} · ${shown.length} registro(s)`;
      $('#rows').innerHTML = shown.map(r => { const c = cur(r);
        return `<tr><td><a href="${recLink(r)}">${esc(c.titulo)}</a>${r.deleted ? ' <span class="tag bad">excluído</span>' : ''}<br><span class="muted small">${esc(c.categoria)}</span></td>
        <td>${statusTag(c.status)}</td><td>${priorTag(c.prioridade)}</td><td>${esc(c.responsavel) || '—'}</td>
        <td>${overdue(r) ? '<span class="tag bad">vencido</span> ' : ''}${fmtD(c.prazo)}${revInfo(r) ? '<br>' + revTag(r) : ''}</td><td>${guiaDe(c.categoria) ? chkCell(guiaDe(c.categoria), c.dados, r.id) : '<span class="muted">—</span>'}</td><td>v${r.versao}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Nenhum registro encontrado.</td></tr>';
      const gb = $('#gbtn'); if (gb) gb.hidden = !guiaDe(fc.value);
    };
    [q, fc, fs_, fp, fd].forEach(el => el.addEventListener('input', draw)); draw();
    const nb = $('#new'); if (nb) nb.onclick = () => recordForm();
    const ex = $('#exp'); if (ex) ex.onclick = guard(() => exportCSV(shown));
    $('#prn').onclick = () => window.print();
    $('#gbtn').onclick = () => { const g = guiaDe(fc.value); if (g) modal(`<h2>Guia de referência · ${esc(g.titulo)}</h2><div class="guide-ref">${g.referencia}</div><div class="actions"><button id="x">Fechar</button></div>`, d => { $('#x', d).onclick = () => d.close(); }); };
  };
  return `<div class="printhead">${firmLogo() ? `<img class="firmlogo" src="${firmLogo()}" alt="Logo ${esc(contabNome(cid))}">` : ''}<div><b>${esc(contabNome(cid))}</b><br><span class="small">Relatório de registros · emitido em ${new Date().toLocaleDateString('pt-BR')}</span></div></div>
    <div class="bar"><div><h1>Registros</h1><p class="muted" id="cnt"></p></div>${firmLogo() ? `<img class="firmlogo no-print" src="${firmLogo()}" alt="Logo ${esc(contabNome(cid))}">` : ''}<div class="actions" style="margin:0">
    ${can.edit() ? '<button class="primary" id="new">+ Novo registro</button>' : ''}
    ${can.export() ? '<button id="exp">Exportar CSV</button>' : ''}<button id="gbtn" hidden>Guia de referência</button><button id="prn">Imprimir relatório</button></div></div>
    <div class="filters"><div><label for="q">Pesquisa</label><input id="q" type="search" placeholder="Palavra-chave…"></div>
    <div><label for="fc">Categoria</label><select id="fc">${opts(catList(), '', 'Todas')}</select></div>
    <div><label for="fs">Status</label><select id="fs">${opts(STATUS, '', 'Todos')}</select></div>
    <div><label for="fp">Prioridade</label><select id="fp">${opts(PRIOR, '', 'Todas')}</select></div>
    <div><label for="fd">Exibir</label><select id="fd"><option value="">Ativos</option>${can.admin() ? '<option value="del">Excluídos</option>' : ''}</select></div></div>
    <div class="quick-filter" id="quick-filter" hidden><span>Mostrando: <b id="quick-filter-name"></b></span><button type="button" id="clear-quick">Limpar filtro</button></div>
    <div class="card tablewrap"><table><thead><tr><th>Registro</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Checklist</th><th>Versão</th></tr></thead><tbody id="rows"></tbody></table></div>`;
}
async function exportCSV(rs) {
  if (!can.export()) return;
  const q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1") + '"';
  const head = ['Contabilidade', 'Título', 'Categoria', 'Status', 'Prioridade', 'Responsável', 'Prazo', 'Próxima revisão', 'Versão', 'Aprovação', 'Descrição', 'Evidências'];
  const lines = [head.map(q).join(';')].concat(rs.map(r => { const c = cur(r);
    return [contabNome(cid), c.titulo, c.categoria, c.status, c.prioridade, c.responsavel, c.prazo, c.revisao || '', r.versao, r.aprovacao ? `v${r.aprovacao.versao} por ${r.aprovacao.por}${aprovada(r) ? '' : ' (desatualizada)'}` : 'não aprovada', c.descricao, c.evidencias].map(q).join(';'); }));
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
/* ---------- consulta de CNPJ (BrasilAPI, dados públicos da Receita Federal) ---------- */
function cnpjValido(c) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let t = 0, p = n - 7; for (let i = 0; i < n; i++) { t += +c[i] * p--; if (p < 2) p = 9; } const r = t % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
const tituloCase = t => String(t || '').toLowerCase().replace(/(^|[\s\-\/(])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase()).replace(/^(.)/, c => c.toUpperCase());
const fmtEnd = (tipo, lg, num, comp, bairro, mun, uf, cepRaw) => {
  tipo = tituloCase(tipo); lg = tituloCase(lg);
  const rua = tipo && !lg.toLowerCase().startsWith(tipo.toLowerCase()) ? tipo + ' ' + lg : lg;
  const cep = String(cepRaw || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return [rua && (rua + (num ? ', ' + num : '')), comp && tituloCase(comp), tituloCase(bairro), (tituloCase(mun) + (uf ? '/' + uf : '')).replace(/^\/$/, ''), cep && 'CEP ' + cep].filter(Boolean).join(' - ').replace(/\s+/g, ' ').trim();
};
const PORTES = ['Microempresa (ME)', 'Empresa de pequeno porte (EPP)', 'MEI', 'Demais'];
const normPorte = (txt, mei) => mei ? 'MEI' : /micro/i.test(String(txt || '')) ? PORTES[0] : /pequeno/i.test(String(txt || '')) ? PORTES[1] : /demais/i.test(String(txt || '')) ? PORTES[3] : '';
const CNPJ_FONTES = [
  { nome: 'BrasilAPI', url: c => 'https://brasilapi.com.br/api/cnpj/v1/' + c,
    le: d => ({ razao: String(d.razao_social || '').trim(), end: fmtEnd(d.descricao_tipo_de_logradouro, d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep),
      situacao: d.descricao_situacao_cadastral || '', individual: /individual|mei/i.test(String(d.natureza_juridica || '')) || d.opcao_pelo_mei === true,
      porte: normPorte(d.porte, d.opcao_pelo_mei === true), simples: d.opcao_pelo_simples === true ? 'Sim' : d.opcao_pelo_simples === false ? 'Não' : '', nat: String(d.natureza_juridica || '').trim() }) },
  { nome: 'CNPJ.ws', url: c => 'https://publica.cnpj.ws/cnpj/' + c,
    le: d => { const e = d.estabelecimento || {}; return { razao: String(d.razao_social || '').trim(),
      end: fmtEnd(e.tipo_logradouro, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade && e.cidade.nome, e.estado && e.estado.sigla, e.cep),
      situacao: String(e.situacao_cadastral || ''), individual: /individual|mei/i.test(String((d.natureza_juridica && d.natureza_juridica.descricao) || '')),
      porte: normPorte(d.porte && d.porte.descricao, !!(d.simples && /sim/i.test(String(d.simples.mei || '')))), simples: d.simples ? (/sim/i.test(String(d.simples.simples || '')) ? 'Sim' : 'Não') : '', nat: String((d.natureza_juridica && d.natureza_juridica.descricao) || '').trim() }; } }
];
async function consultaCnpj(c) {
  const motivos = [];
  for (const f of CNPJ_FONTES) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(f.url(c), { signal: ac.signal });
      if (r.status === 404) return { naoEncontrado: true };
      if (!r.ok) { motivos.push(f.nome + ': HTTP ' + r.status + (r.status === 429 ? ' (limite de consultas)' : '')); continue; }
      const out = f.le(await r.json());
      if (!out.razao && !out.end) { motivos.push(f.nome + ': resposta sem dados'); continue; }
      out.fonte = f.nome; return out;
    } catch (e) {
      motivos.push(f.nome + ': ' + (e && e.name === 'AbortError' ? 'sem resposta em 8 s' : 'bloqueado ou sem rede (extensão, firewall ou CORS)'));
      console.warn('[consulta CNPJ]', f.nome, e);
    } finally { clearTimeout(t); }
  }
  return { falha: true, motivo: motivos.join('; ') };
}
function ligaBuscaCnpj(inp, st, campos) {
  if (!inp || !st) return;
  let ultimo = '', seq = 0;
  ['razao', 'end', 'porte', 'simples', 'nat'].forEach(k => { const el = campos[k]; if (el) el.addEventListener('input', () => { delete el.dataset.auto; }); });
  const poe = (k, v) => { const el = campos[k]; if (el && v && (!el.value.trim() || el.dataset.auto === '1')) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dataset.auto = '1'; } };
  inp.addEventListener('input', async () => {
    const dig = inp.value.replace(/\D/g, ''), my = ++seq;
    if (dig.length === 11) { st.textContent = 'CPF: não existe consulta pública. Preencha nome e endereço manualmente.'; const p = campos.pessoa; if (p && !p.value) p.value = 'Física'; return; }
    if (dig.length !== 14) { st.textContent = ''; ultimo = ''; return; }
    if (!cnpjValido(dig)) { st.textContent = 'CNPJ inválido. Confira os dígitos.'; return; }
    if (dig === ultimo) return;
    st.textContent = 'Consultando a base pública…';
    const r = await consultaCnpj(dig); if (my !== seq) return;
    if (r.naoEncontrado) { st.textContent = 'CNPJ não encontrado na base pública. Preencha manualmente.'; return; }
    if (r.falha) { st.textContent = 'Não foi possível consultar agora (' + r.motivo + '). Preencha manualmente.'; return; }
    ultimo = dig;
    const p = campos.pessoa; if (p && !p.value) p.value = 'Jurídica';
    poe('razao', r.razao); poe('end', r.end); poe('porte', r.porte); poe('simples', r.simples); poe('nat', r.nat); inp.dataset.consulta = new Date().toISOString().slice(0, 10);
    const av = []; if (r.situacao && !/ativa/i.test(r.situacao)) av.push('Situação cadastral: ' + r.situacao + '.'); if (r.individual) av.push('Empresário individual/MEI: o endereço pode ser residencial (dado pessoal). Confira se é necessário guardá-lo.');
    st.textContent = 'Preenchido a partir da Receita Federal (' + (r.fonte || 'BrasilAPI') + '). Confira antes de salvar. ' + av.join(' ');
  });
}
// legenda "Como responder" (v2.22.0): ícone ⓘ ao lado da pergunta; quadro abre ao passar o mouse, ao clicar ou pelo teclado
const legIcon = (i, titulo = 'Como responder') => i.legenda ? `<span class="legwrap no-print"><button type="button" class="info" aria-label="${esc(titulo)}" aria-expanded="false">ⓘ</button><span class="legtxt" hidden><b>${esc(titulo)}</b><ul>${i.legenda.map(([r, t]) => `<li><b>${esc(r)}:</b> ${esc(t)}</li>`).join('')}</ul></span></span>` : '';
(() => {
  let pop = null, dono = null, fixo = false, tmo = 0, aberto = 0;
  const fecha = () => { if (pop) pop.remove(); if (dono) dono.setAttribute('aria-expanded', 'false'); pop = dono = null; fixo = false; };
  const abre = btn => {
    if (dono === btn && pop) return;
    fecha(); dono = btn; aberto = Date.now(); btn.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'legpop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = btn.nextElementSibling.innerHTML; (btn.closest('dialog') || document.body).appendChild(pop); // dentro da janela modal, senão fica atrás dela
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    const abaixo = r.bottom + 6, h = pop.offsetHeight;
    pop.style.top = (abaixo + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : abaixo) + 'px';
    pop.addEventListener('mouseenter', () => clearTimeout(tmo));
    pop.addEventListener('mouseleave', () => { if (!fixo) tmo = setTimeout(fecha, 200); });
  };
  const hover = () => window.matchMedia && matchMedia('(hover: hover)').matches;
  document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('.info'); if (b && hover()) { clearTimeout(tmo); abre(b); } });
  document.addEventListener('mouseout', e => { const b = e.target.closest && e.target.closest('.info'); if (b && !fixo && hover()) tmo = setTimeout(fecha, 200); });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.info');
    if (b) { e.preventDefault(); if (dono === b && fixo) fecha(); else { abre(b); fixo = true; } return; }
    if (pop && !e.target.closest('.legpop')) fecha();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.preventDefault(); e.stopPropagation(); const b = dono; fecha(); if (b) b.focus(); } }, true);
  window.addEventListener('hashchange', fecha); window.addEventListener('scroll', () => { if (pop && !fixo && Date.now() - aberto > 600) fecha(); }, true);
})();
// textos curtos das respostas (v2.22.4): aparecem no dropdown e na barra fixa. Edite aqui.
const RESP_DICA = { '': 'ainda não respondi', 'Conforme': 'faço e consigo mostrar', 'Parcial': 'faço em parte', 'Não conforme': 'não faço', 'N/A': 'não se aplica' };
const respOpts = sel => ['', ...RESP].map(v => `<option value="${esc(v)}" ${v === (sel || '') ? 'selected' : ''}>${esc(v || 'Não avaliado')} — ${esc(RESP_DICA[v])}</option>`).join('');
const barraResp = () => `<div class="respbar no-print">${['Conforme', 'Parcial', 'Não conforme', 'N/A'].map(v => `<span><b>${v}</b> ${esc(RESP_DICA[v])}</span>`).join('')}${legIcon(LEG_GERAL, 'Legenda das respostas')}</div>`;
// legenda geral das cinco respostas (ⓘ da barra)
const LEG_GERAL = { legenda: [
  ['Não avaliado', 'ainda não foi respondida; é pendência, não uma resposta. Na nota: vale 0, como Não conforme, e conta no total.'],
  ['Conforme', 'o escritório faz isso hoje e consegue mostrar como (documento, registro ou configuração). Na nota: Declarado vale 1; só entra no Comprovado com pelo menos uma evidência anexada.'],
  ['Parcial', 'faz em parte, ou faz sem formalizar ou sem cobrir tudo. Na nota: Declarado vale 0,5; nunca conta como Comprovado.'],
  ['Não conforme', 'não faz. Nos itens críticos, gera ponto de atenção e a pergunta vale peso 2. Na nota: vale 0.'],
  ['N/A', 'não se aplica ao escritório. Só use se tiver conferido; "acho que não" não vale. Na nota: sai do cálculo.'],
  ['Perguntas com ⓘ próprio', 'têm uma legenda específica, que vale no lugar desta.']] };
const resHtml = r => `<div class="resbox-in ${r.nivel}"><b>${esc(r.titulo)}</b><ul>${r.linhas.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="muted small">${esc(r.aviso)}</div></div>`;
// Atualiza, no formulário, os itens que dependem de outras respostas (aplica) e os blocos calculados (resultado).
function atualizaGuia(g, root) {
  const d = collectDados(root);
  itensDe(g).forEach(i => {
    if (i.aplica) { const w = root.querySelector('[data-ap="' + i.id + '"]'); if (!w) return; const ap = aplicaItem(i, d);
      w.classList.toggle('inativo', !ap); w.querySelectorAll('[data-k]').forEach(el => { el.disabled = !ap; });
      let n = w.querySelector('.apnota'); if (!ap && !n) { n = document.createElement('div'); n.className = 'apnota muted small'; n.textContent = 'Não se aplica com a situação atual do encarregado (conta como N/A).'; w.appendChild(n); } if (ap && n) n.remove(); }
    if (i.tipo === 'resultado') { const w = root.querySelector('[data-calc="' + i.id + '"]'); if (w) w.innerHTML = resHtml(i.calc(d)); }
  });
}
function checklistForm(g, dados) {
  const dd = dados || {}, crit = critIds(g);
  const item = i => {
    const cadV = i.cad ? ((db.contabs.find(x => x.id === cid) || {})[i.cad] || '') : undefined;
    const v = dd[i.id] !== undefined ? dd[i.id] : cadV, help = i.ajuda ? `<div class="muted small">${esc(i.ajuda)}</div>` : '';
    const extra = i.extra ? ' <span class="tag brand" title="Item acrescentado pela equipe técnica; validar juridicamente">extra</span>' : '';
    const bp = i.bp ? ' <span class="tag" title="Boa prática / critério interno: não é exigência expressa da LGPD ou de resolução da ANPD">boa prática</span>' : '';
    const lab = `<div class="labrow"><label>${esc(i.label)}${extra}${bp}</label>${legIcon(i)}</div>`;
    if (i.tipo === 'resultado') return `<div class="gi">${lab}<div class="resbox" data-calc="${i.id}"></div></div>`;
    if (i.tipo === 'texto') return `<div class="gi">${lab}<input data-k="${i.id}" maxlength="300" value="${esc(v)}"${i.busca ? ` data-busca="${i.busca}" inputmode="numeric" autocomplete="off"` : ''}>${i.busca ? '<div class="muted small" data-bs aria-live="polite"></div>' : ''}${help}</div>`;
    if (i.tipo === 'area') return `<div class="gi">${lab}<textarea data-k="${i.id}" maxlength="2000" style="min-height:70px">${esc(v)}</textarea>${help}</div>`;
    if (i.tipo === 'select') return `<div class="gi">${lab}<select data-k="${i.id}">${opts(i.opcoes, v, '— selecione —')}</select>${help}</div>`;
    if (i.tipo === 'multi') { const sel = new Set(Array.isArray(v) ? v : []);
      return `<div class="gi">${lab}${i.opcoes.map(o => `<label class="chk"><input type="checkbox" data-m="${i.id}" value="${esc(o)}" ${sel.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}${help}</div>`; }
    const est = crit.has(i.id) ? `<div class="stage" data-for="${i.id}" ${['Conforme', 'Parcial'].includes(v) ? '' : 'hidden'}><label>Estágio do controle <span class="tag warn" title="Item crítico: para contar como comprovado, precisa estar Implantado ou Testado, com evidência anexada">crítico</span></label><select data-k="${i.id}#e">${opts(ESTAGIOS, dd[i.id + '#e'], '— selecione —')}</select></div>` : '';
    return `<div class="gi" ${i.aplica ? `data-ap="${i.id}"` : ''}>${lab}<div class="row"><select data-k="${i.id}">${respOpts(v)}</select><input data-k="${i.id}#o" maxlength="300" placeholder="Observação (opcional)" value="${esc(dd[i.id + '#o'])}"></div>${est}${help}</div>`;
  };
  return `<div class="card guide"><div class="stickhd"><h3>Checklist · ${esc(g.titulo)}</h3>${barraResp()}</div><p class="muted small">${esc(g.resumo)}</p>
    ${g.secoes.map(sec => `<details><summary>${esc(sec.titulo)}</summary>${sec.itens.map(item).join('')}</details>`).join('')}</div>`;
}
function collectDados(root) {
  const o = {};
  root.querySelectorAll('[data-k]').forEach(el => { if (el.disabled) return; const v = el.value.trim(); if (v) o[el.dataset.k] = v.slice(0, el.tagName === 'TEXTAREA' ? 2000 : 300); });
  const ms = {};
  root.querySelectorAll('[data-m]:checked').forEach(el => { (ms[el.dataset.m] = ms[el.dataset.m] || []).push(el.value); });
  Object.assign(o, ms);
  return o;
}
function checklistView(g, dados, rec) {
  const dd = dados || {}, pr = progresso(g, dd), alerts = g.alertas(dd), crit = critIds(g);
  const pt = pontuacao(g, dd, rec ? evPorItem(rec.id) : null);
  const evBtn = e => `<button class="link" data-evopen="${esc(e.id)}" title="${esc(e.descricao)}">${esc(e.nome)}</button>`;
  const val = i => {
    const v = dd[i.id];
    if (i.tipo === 'resultado') return resHtml(i.calc(dd));
    if (i.tipo !== 'sn') return v && v.length ? esc(fmtVal(v)) : '<span class="muted">—</span>';
    if (!aplicaItem(i, dd)) return respTag('N/A') + '<div class="muted small">Não se aplica com a situação atual do encarregado.</div>';
    let h = respTag(v) + (dd[i.id + '#o'] ? `<div class="muted small">${esc(dd[i.id + '#o'])}</div>` : '');
    if (rec && v && v !== 'N/A') {
      const evs = evDe(rec.id, i.id), est = dd[i.id + '#e'];
      if (crit.has(i.id) && v === 'Conforme') h += `<div class="small">Estágio: <b>${esc(est || 'Redigido (não informado)')}</b></div>`;
      h += `<div class="small evrow">${evs.length ? 'Evidências: ' + evs.map(evBtn).join(' · ') : (v === 'Conforme' ? '<span class="tag warn">sem evidência</span>' : '')}${can.editRec(rec) && db.evidOk ? ` <button data-anexar="${esc(i.id)}">+ Evidência</button>` : ''}${can.editRec(rec) ? ` <button data-criar-acao="${esc(i.id)}">+ Plano de ação</button>` : ''}</div>`;
    }
    return h;
  };
  return `<div class="card"><h2>Checklist · ${esc(g.titulo)}${legIcon(LEG_GERAL, 'Legenda das respostas')}</h2>
    <p class="small" style="margin-bottom:.3rem"><b>Declarado ${pt.declarado}%</b> <span class="muted">o que foi respondido</span></p>
    <div class="prog" title="${pt.declarado}% declarado"><span style="width:${pt.declarado}%"></span></div>
    <p class="small" style="margin:.6rem 0 .3rem"><b>Comprovado ${pt.comprovado === null ? 'indisponível' : pt.comprovado + '%'}</b> <span class="muted">itens Conforme com evidência${pt.criticos ? ' (críticos também precisam estar Implantados ou Testados)' : ''}</span></p>
    <div class="prog" title="${pt.comprovado === null ? '' : pt.comprovado + '% comprovado'}"><span style="width:${pt.comprovado || 0}%;background:var(--ok)"></span></div>
    <p class="small muted">${pr.ok} conformes · ${pr.parcial} parciais · ${pr.nao} não conformes · ${pr.na} N/A · ${pr.pend} sem avaliação${pt.semProva ? ` · <b>${pt.semProva} conforme(s) ainda sem prova</b>` : ''}. Critérios em Configurações › Sobre / versão.</p>
    ${pt.comprovado === null ? '<div class="notice">As evidências não puderam ser lidas (regras do Firestore sem a seção <code>evidencias</code>). Publique o <code>firestore.rules</code> atualizado.</div>' : ''}
    ${alerts.length ? `<div class="notice bad"><b>Pontos de atenção</b><ul>${alerts.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${g.secoes.map(sec => `<h3 style="margin-top:1rem">${esc(sec.titulo)}</h3><div class="tablewrap"><table>${sec.itens.map(i =>
      `<tr><td style="width:55%">${esc(i.label)}${legIcon(i)}${i.extra ? ' <span class="tag brand">extra</span>' : ''}${i.bp ? ' <span class="tag">boa prática</span>' : ''}${crit.has(i.id) ? ' <span class="tag warn" title="Item crítico: peso 2 na pontuação">crítico</span>' : ''}</td><td>${val(i)}</td></tr>`).join('')}</table></div>`).join('')}</div>`;
}

/* ---------- formulário de registro ---------- */
function recordForm(rec) {
  const c = rec ? cur(rec) : { titulo: '', categoria: catList()[0] || '', descricao: '', status: 'Rascunho', prioridade: 'Média', responsavel: me.nome, prazo: '', revisao: '', evidencias: '' };
  const statusOpts = me.role === 'admin' ? STATUS : STATUS.filter(s => s !== 'Arquivado');
  modal(`<h3>${rec ? 'Editar registro' : 'Novo registro'} <span class="muted small">· ${esc(contabNome(cid))}</span></h3><form id="rf">
    <label for="t">Título *</label><input id="t" required maxlength="200" value="${esc(c.titulo)}">
    <div class="row"><div><label for="c">Categoria *</label><select id="c" required>${opts(catList(), c.categoria)}</select></div>
    <div><label for="s">Status</label><select id="s">${opts(statusOpts, c.status)}</select></div>
    <div><label for="p">Prioridade</label><select id="p">${opts(PRIOR, c.prioridade)}</select></div></div>
    <div class="row"><div><label for="r">Responsável</label><select id="r">${opts(responsaveis(), c.responsavel, '— ninguém —')}</select></div>
    <div><label for="z">Prazo</label><input id="z" type="date" value="${esc(c.prazo)}"></div>
    <div><label for="rv">Próxima revisão</label><input id="rv" type="date" value="${esc(c.revisao)}"></div></div>
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
        if (g) { const gx = $('#gx', d), cp = k => gx.querySelector('[data-k="' + k + '"]'); ligaBuscaCnpj(gx.querySelector('[data-busca="cnpj"]'), gx.querySelector('[data-bs]'), { razao: cp('razao'), end: cp('end'), pessoa: cp('pessoa') }); }
        if (g) { const gx = $('#gx', d), run = () => atualizaGuia(g, gx); gx.oninput = run; gx.onchange = run; run(); }
        $('#t', d).placeholder = g ? g.tituloHint : '';
        $$('.stage', d).forEach(st => { const sel = $('[data-k="' + st.dataset.for + '"]', d), es = $('select', st);
          const upd = () => { const ok = ['Conforme', 'Parcial'].includes(sel.value); st.hidden = !ok; if (!ok) es.value = ''; };
          sel.addEventListener('change', upd); });
      };
      $('#c', d).onchange = () => { if (guiaDe(c0)) dadosAtual = collectDados($('#gx', d)); c0 = $('#c', d).value; drawGuide(); };
      let c0 = $('#c', d).value; drawGuide();
      $('#s', d).onchange = () => { if ($('#s', d).value === 'Em vigor' && !$('#rv', d).value) { $('#rv', d).value = maisMeses(12); toast('Próxima revisão sugerida: 12 meses. Ajuste se precisar.'); } };
      $('#x', d).onclick = () => d.close();
      $('#rf', d).onsubmit = guard(async e => {
        e.preventDefault();
        const snap = { titulo: $('#t', d).value.trim(), categoria: $('#c', d).value, descricao: $('#d', d).value, status: $('#s', d).value,
          prioridade: $('#p', d).value, responsavel: $('#r', d).value, prazo: $('#z', d).value, revisao: $('#rv', d).value, evidencias: $('#e', d).value };
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
  await loadEvid();
  const c = cur(rec);
  const guia = guiaDe(c.categoria);
  const placar = guia ? pontuacao(guia, c.dados, evPorItem(rec.id)) : null;
  const situacaoPrazo = overdue(rec) ? `Vencido em ${fmtD(c.prazo)}` : c.prazo ? `Prazo: ${fmtD(c.prazo)}` : 'Sem prazo definido';
  bind = () => {
    const reload = () => route();
    $$('[data-evopen]').forEach(b => b.onclick = guard(() => abrirEvidencia(db.evid.find(x => x.id === b.dataset.evopen))));
    $$('[data-anexar]').forEach(b => b.onclick = () => anexarModal(rec, b.dataset.anexar));
    $$('[data-criar-acao]').forEach(b => b.onclick = () => { const item = guia && itensDe(guia).find(i => i.id === b.dataset.criarAcao); acaoForm(rec, item); });
    const e = $('#edit'); if (e) e.onclick = () => recordForm(rec);
    const ap = $('#aprov'); if (ap) ap.onclick = () => confirmBox(`Aprovar formalmente a v${rec.versao} deste registro? Ficam registrados seu nome, a data e a versão. Qualquer edição posterior exigirá nova aprovação.`, 'Aprovar', async () => {
      const b = writeBatch(fs); b.update(rdoc(id), { aprovacao: { versao: rec.versao, porId: me.id, por: me.nome, em: serverTimestamp() } });
      auditOp(b, 'Versão aprovada', rec, 'v' + rec.versao); await b.commit(); toast('Versão aprovada.'); reload(); }, false);
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
  return `<section class="record-hero"><div class="record-hero-top"><a class="record-back" href="#/registros">← Todos os registros</a><span>${esc(contabNome(cid))}</span></div>
    <div class="record-hero-main"><div><span class="record-kicker">REGISTRO DE CONFORMIDADE</span><h1>${esc(c.titulo)} ${rec.deleted ? '<span class="tag bad">excluído</span>' : ''}</h1><div class="record-tags">${statusTag(c.status)} ${priorTag(c.prioridade)} <span class="tag">${esc(c.categoria)}</span> <span class="tag brand">v${rec.versao}</span> ${aprovada(rec) ? `<span class="tag ok" title="Aprovada por ${esc(rec.aprovacao.por)} em ${fmt(rec.aprovacao.em)}">aprovada</span>` : rec.aprovacao ? '<span class="tag warn">reaprovar</span>' : '<span class="tag">sem aprovação</span>'}</div></div>
    <div class="record-hero-actions">
    ${can.editRec(rec) ? '<button class="primary" id="edit">Editar registro</button>' : ''}
    ${can.admin() && !rec.deleted && c.status !== 'Arquivado' && !aprovada(rec) ? '<button id="aprov">Aprovar versão</button>' : ''}
    ${!rec.deleted && can.admin() ? '<button class="danger record-delete" id="del" aria-label="Excluir registro">Excluir</button>' : ''}
    ${rec.deleted && can.admin() ? '<button id="rest">Restaurar</button><button class="danger" id="hard">Excluir definitivamente</button>' : ''}</div></div>
    <div class="record-hero-foot"><span><i aria-hidden="true">●</i> ${esc(c.responsavel) || 'Sem responsável'}</span><span class="${overdue(rec) ? 'is-bad' : ''}">${situacaoPrazo}</span>${revInfo(rec) ? `<span class="${revInfo(rec).k === 'bad' ? 'is-bad' : ''}">${revInfo(rec).t}</span>` : ''}</div></section>
    ${placar ? `<section class="record-radar" aria-label="Resumo do checklist"><div class="record-radar-head"><div><span class="record-kicker">RADAR DE CONFORMIDADE</span><h2>O que precisa de atenção agora</h2></div><span class="muted small">Os indicadores são atualizados a cada versão</span></div><div class="record-radar-grid"><div class="radar-card radar-brand"><span>Declarado</span><b>${placar.declarado}%</b><small>respostas preenchidas</small></div><div class="radar-card radar-ok"><span>Comprovado</span><b>${placar.comprovado === null ? '—' : placar.comprovado + '%'}</b><small>com evidência válida</small></div><div class="radar-card ${placar.semProva ? 'radar-warn' : 'radar-ok'}"><span>Sem evidência</span><b>${placar.semProva || 0}</b><small>itens “Conforme” a comprovar</small></div><div class="radar-card ${overdue(rec) ? 'radar-bad' : ''}"><span>Agenda</span><b>${overdue(rec) ? 'Atenção' : c.revisao ? fmtD(c.revisao) : 'Livre'}</b><small>${situacaoPrazo}</small></div></div></section>` : ''}
    ${overdue(rec) ? '<div class="notice bad">Prazo vencido em ' + fmtD(c.prazo) + '.</div>' : ''}
    ${revInfo(rec) ? `<div class="notice ${revInfo(rec).k === 'bad' ? 'bad' : ''}">Próxima revisão em ${fmtD(c.revisao)}: ${revInfo(rec).t}.</div>` : ''}
    ${semAprov(rec) ? `<div class="notice">${rec.aprovacao ? `Este registro foi alterado depois da aprovação (aprovada a v${rec.aprovacao.versao}; a atual é a v${rec.versao}).` : 'Este registro está em vigor, mas nunca foi aprovado formalmente.'} Um administrador pode aprovar a versão atual.</div>` : ''}
    <div class="card"><div class="row small"><div><span class="muted">Responsável</span><br>${esc(c.responsavel) || '—'}</div><div><span class="muted">Prazo</span><br>${fmtD(c.prazo)}</div>
    <div><span class="muted">Criado em</span><br>${fmt(rec.criado)}</div></div>
    <h3 style="margin-top:1rem">Descrição / procedimento</h3><div class="pre">${esc(c.descricao) || '<span class="muted">—</span>'}</div>
    <h3 style="margin-top:1rem">Evidências</h3><div class="pre">${esc(c.evidencias) || '<span class="muted">—</span>'}</div></div>
    ${guia ? checklistView(guia, c.dados, rec) : ''}
    <div class="card"><h2>Histórico de versões</h2><div class="tablewrap"><table><tr><th>Versão</th><th>Quando</th><th>Autor</th><th>Justificativa</th><th></th></tr>
    ${vs.slice().reverse().map(v => `<tr><td>v${v.n}${v.n === last ? ' <span class="tag ok">atual</span>' : ''}</td><td>${fmt(v.quando)}</td><td>${esc(v.autor)}</td><td>${esc(v.just)}</td>
    <td>${can.editRec(rec) && v.n !== last ? `<button data-restore="${v.n}">Restaurar</button>` : ''}</td></tr>`).join('')}</table></div></div>
    ${vs.length > 1 ? `<div class="card"><h2>Comparar versões</h2><div class="row"><div><label for="va">De</label><select id="va">${vopts(vs.length - 1)}</select></div>
    <div><label for="vb">Para</label><select id="vb">${vopts(vs.length)}</select></div></div><div id="diff"></div></div>` : ''}
    <div class="card"><h2>Auditoria deste registro</h2>${auditRows(au, false)}</div>`;
}

/* ---------- evidências: arquivos no Firebase Storage; dados de cada uma no Firestore ---------- */
/* ---------- plano de ação ---------- */
const acaoTag = s => `<span class="tag ${s === 'Concluída' ? 'ok' : s === 'Em andamento' ? 'warn' : ''}">${esc(s)}</span>`;
function acaoForm(registro = null, item = null) {
  const regs = db.records.filter(r => !r.deleted); if (!regs.length) return toast('Crie um registro antes de abrir uma ação.');
  const escolhido = registro || regs[0];
  modal(`<h3>Nova ação</h3><form id="af"><label for="at">Ação *</label><input id="at" required maxlength="200" value="${esc(item?.label || '')}" placeholder="Ex.: Anexar a política assinada"><div class="row"><div><label for="ar">Registro</label><select id="ar" ${registro ? 'disabled' : ''}>${regs.map(r => `<option value="${esc(r.id)}" ${r.id === escolhido.id ? 'selected' : ''}>${esc(cur(r).titulo)}</option>`).join('')}</select></div><div><label for="ap">Responsável</label><select id="ap">${opts(responsaveis(), me.nome, '— ninguém —')}</select></div></div><div class="row"><div><label for="az">Prazo</label><input id="az" type="date"></div><div><label for="ai">Prioridade</label><select id="ai">${opts(PRIOR, 'Média')}</select></div></div>${item ? `<p class="small muted">Item do checklist: ${esc(item.label)}</p>` : ''}<div class="actions"><button class="primary" id="as">Criar ação</button><button type="button" id="ac">Cancelar</button></div></form>`, d => {
    $('#ac', d).onclick = () => d.close(); $('#af', d).onsubmit = guard(async e => { e.preventDefault(); const rec = registro || regs.find(r => r.id === $('#ar', d).value); const tarefa = { titulo: $('#at', d).value.trim(), status: 'A fazer', prioridade: $('#ai', d).value, responsavel: $('#ap', d).value, prazo: $('#az', d).value, registroId: rec.id, registroTitulo: cur(rec).titulo, itemId: item?.id || '', itemRot: item?.label || '', criadoPor: me.id, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() }; $('#as', d).disabled = true; await setDoc(doc(acaoCol()), tarefa); await auditNow('Ação criada', rec, tarefa.titulo); d.close(); toast('Ação criada.'); route(); });
  });
}
async function renderAcoes() {
  let lista; try { lista = (await getDocs(acaoCol())).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return `<h1>Plano de ação</h1><div class="notice bad">Publique as regras atualizadas para habilitar o Plano de ação.</div>`; }
  const ord = { 'A fazer': 0, 'Em andamento': 1, 'Concluída': 2 }; lista.sort((a, b) => ord[a.status] - ord[b.status] || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
  bind = () => { const novo = $('#nova-acao'); if (novo) novo.onclick = acaoForm; $$('[data-acao-status]').forEach(s => s.onchange = guard(async () => { const a = lista.find(x => x.id === s.dataset.acaoStatus), rec = db.records.find(r => r.id === a.registroId); await updateDoc(acaoDoc(a.id), { status: s.value, atualizadoEm: serverTimestamp() }); await auditNow('Ação atualizada', rec, `${a.titulo} · ${s.value}`); toast('Status atualizado.'); route(); })); };
  const abertas = lista.filter(a => a.status !== 'Concluída'), vencidas = abertas.filter(a => a.prazo && a.prazo < today());
  return `<div class="bar"><div><h1>Plano de ação</h1><p class="muted">${esc(contabNome(cid))} · pendências organizadas em trabalho.</p></div>${can.edit() ? '<button class="primary" id="nova-acao">+ Nova ação</button>' : ''}</div><div class="action-summary"><div><b>${abertas.length}</b><span>em aberto</span></div><div class="${vencidas.length ? 'tone-bad' : ''}"><b>${vencidas.length}</b><span>vencidas</span></div><div><b>${lista.filter(a => a.status === 'Concluída').length}</b><span>concluídas</span></div></div><div class="action-board">${ACAO_STATUS.map(status => { const col = lista.filter(a => a.status === status); return `<section class="action-column"><h2>${acaoTag(status)} <span>${col.length}</span></h2>${col.length ? col.map(a => `<article class="action-card">${priorTag(a.prioridade)} ${a.prazo && a.prazo < today() && a.status !== 'Concluída' ? '<span class="tag bad">vencida</span>' : ''}<b>${esc(a.titulo)}</b><a href="#/registro/${cid}/${a.registroId}">${esc(a.registroTitulo)}</a><small>👤 ${esc(a.responsavel) || 'Sem responsável'} · ${a.prazo ? fmtD(a.prazo) : 'sem prazo'}</small>${can.edit() ? `<select data-acao-status="${esc(a.id)}">${opts(ACAO_STATUS, a.status)}</select>` : ''}</article>`).join('') : '<p class="muted small">Nada aqui.</p>'}</section>`; }).join('')}</div>`;
}
const EV_MAX = 10 * 1024 * 1024;
const EV_TIPOS = { pdf: 'application/pdf', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const evExt = n => (String(n).includes('.') ? String(n).split('.').pop() : '').toLowerCase();
const fmtTam = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const evCol = () => collection(fs, 'contabilidades', cid, 'evidencias');
const evDoc = id => doc(fs, 'contabilidades', cid, 'evidencias', id);
// confere os primeiros bytes: o arquivo precisa ser mesmo do tipo que a extensão diz
async function evAssinaturaOk(file, ext) {
  if (ext === 'txt') return true;
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer()), at = (...v) => v.every((x, i) => b[i] === x);
  if (ext === 'pdf') return at(0x25, 0x50, 0x44, 0x46);
  if (ext === 'docx') return at(0x50, 0x4B, 0x03, 0x04);
  if (ext === 'png') return at(0x89, 0x50, 0x4E, 0x47);
  if (ext === 'jpg' || ext === 'jpeg') return at(0xFF, 0xD8, 0xFF);
  if (ext === 'webp') return at(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}
// foto de celular costuma passar de 5 MB: reduz para no máximo 2400 px (JPEG)
async function evReduzFoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Não foi possível ler a imagem.')); i.src = url; });
    const k = Math.min(1, 2400 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
async function enviarEvidencia(file, categoria, descricao, onProg, vinculo) {
  const ext = evExt(file.name);
  if (!EV_TIPOS[ext]) throw new Error('Tipo não permitido. Use PDF, TXT, DOCX, JPG, PNG ou WEBP.');
  if (!(await evAssinaturaOk(file, ext))) throw new Error('O conteúdo do arquivo não corresponde ao tipo ".' + ext + '".');
  let blob = file, mime = EV_TIPOS[ext], nome = file.name;
  if (mime.startsWith('image/') && file.size > 2 * 1024 * 1024) { blob = await evReduzFoto(file); mime = 'image/jpeg'; nome = nome.replace(/\.[^.]+$/, '') + '.jpg'; }
  if (blob.size > EV_MAX) throw new Error('Arquivo muito grande (máximo 10 MB).');
  if (blob.size === 0) throw new Error('O arquivo está vazio.');
  const id = doc(evCol()).id, seguro = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-100) || 'arquivo';
  const path = `evidencias/${cid}/${id}/${seguro}`, r = sRef(storage, path);
  await new Promise((ok, no) => { const t = uploadBytesResumable(r, blob, { contentType: mime });
    t.on('state_changed', sn => onProg && onProg(Math.round(100 * sn.bytesTransferred / Math.max(1, sn.totalBytes))), no, ok); });
  try {
    await setDoc(evDoc(id), { categoria, descricao, nome: nome.slice(0, 200), tipo: ext, tamanho: blob.size, path, contabId: cid,
      autorId: me.id, autor: me.nome, ts: serverTimestamp(),
      ...(vinculo ? { registroId: vinculo.registroId, itemId: vinculo.itemId, itemRot: String(vinculo.itemRot || '').slice(0, 200) } : {}) });
  } catch (e) { try { await deleteObject(r); } catch (e2) { /* sem arquivo órfão se der */ } throw e; }
  await auditNow('Evidência enviada', null, categoria + ' · ' + nome + ' (' + fmtTam(blob.size) + ')' + (vinculo ? ' · item ' + vinculo.itemId : ''));
}
async function abrirEvidencia(e) {
  if (!e) return;
  const w = window.open('', '_blank'); if (w) w.opener = null;
  try { const u = await getDownloadURL(sRef(storage, e.path)); if (w) w.location.href = u; else location.href = u; } catch (er) { if (w) w.close(); throw er; }
}
function anexarModal(rec, itemId) {
  const g = guiaDe(cur(rec).categoria), item = g && itensDe(g).find(i => i.id === itemId); if (!item) return;
  const existentes = [...new Map((db.evid || []).map(e => [e.path, e])).values()].filter(e => !evDe(rec.id, itemId).some(x => x.path === e.path));
  modal(`<h3>Anexar evidência</h3><p class="small muted">${esc(cur(rec).titulo)} · ${esc(item.label)}</p>
    <form id="axf"><label for="axfile">Arquivo *</label><input id="axfile" type="file" required accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,.webp">
    <label for="axd">Descrição *</label><input id="axd" required maxlength="300" placeholder="O que este arquivo comprova?">
    <p class="muted small">PDF, TXT, DOCX, JPG, PNG ou WEBP, até 10 MB. Evite dados pessoais além do necessário para comprovar.</p>
    ${existentes.length ? `<details style="margin:.5rem 0"><summary>Ou reaproveitar um arquivo já enviado</summary><label for="axre">Arquivo existente</label><select id="axre"><option value="">— selecione —</option>${existentes.map(e => `<option value="${esc(e.id)}">${esc(e.nome)} · ${esc(e.descricao.slice(0, 60))}</option>`).join('')}</select><div class="actions"><button type="button" id="axru">Usar este arquivo neste item</button></div></details>` : ''}
    <div class="actions"><button class="primary" id="axs">Enviar</button><button type="button" id="axc">Cancelar</button><span class="muted small" id="axst"></span></div></form>`,
  d => { $('#axc', d).onclick = () => d.close();
    const ru = $('#axru', d); if (ru) ru.onclick = guard(async () => { const o = existentes.find(x => x.id === $('#axre', d).value); if (!o) return toast('Escolha o arquivo.');
      const id = doc(evCol()).id;
      await setDoc(evDoc(id), { categoria: cur(rec).categoria, descricao: o.descricao, nome: o.nome, tipo: o.tipo, tamanho: o.tamanho, path: o.path, contabId: cid, reuso: true,
        autorId: me.id, autor: me.nome, ts: serverTimestamp(), registroId: rec.id, itemId, itemRot: String(item.label).slice(0, 200) });
      await auditNow('Evidência enviada', null, o.categoria + ' · ' + o.nome + ' (reaproveitada) · item ' + itemId);
      d.close(); toast('Arquivo reaproveitado neste item.'); route(); });
    $('#axf', d).onsubmit = guard(async ev => { ev.preventDefault(); const btn = $('#axs', d); btn.disabled = true;
      try { await enviarEvidencia($('#axfile', d).files[0], cur(rec).categoria, $('#axd', d).value.trim(), p => { $('#axst', d).textContent = 'Enviando… ' + p + '%'; },
          { registroId: rec.id, itemId, itemRot: item.label });
        d.close(); toast('Evidência anexada ao item.'); route(); }
      catch (e) { $('#axst', d).textContent = ''; btn.disabled = false; throw e; } }); });
}
async function renderEvid() {
  const lista = (await getDocs(evCol())).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => tms(b.ts) - tms(a.ts));
  db.evid = lista; db.evidOk = true;
  const cats = catList(), contagem = c => lista.filter(e => e.categoria === c).length;
  const linhas = f => { const l = lista.filter(e => !f || e.categoria === f);
    return l.length ? `<div class="tablewrap"><table><tr><th>Categoria</th><th>Arquivo</th><th>Descrição / item</th><th>Enviado por</th><th>Quando</th><th>Tamanho</th><th></th></tr>
    ${l.map(e => `<tr><td><span class="tag brand">${esc(e.categoria)}</span></td><td><button data-open="${esc(e.id)}">${esc(e.nome)}</button></td><td>${esc(e.descricao)}${e.itemRot ? `<div class="muted small">Item: ${esc(e.itemRot)}</div>` : ''}${e.reuso ? ' <span class="tag">reaproveitada</span>' : ''}</td>
    <td>${esc(e.autor)}</td><td>${fmt(e.ts)}</td><td>${esc(fmtTam(e.tamanho || 0))}</td><td>${can.admin() ? `<button class="danger" data-del="${esc(e.id)}">Excluir</button>` : ''}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">Nenhuma evidência' + (f ? ' nesta categoria' : '') + ' enviada ainda.</p>'; };
  bind = () => {
    const draw = () => { const f = $('#evf').value; $('#evl').innerHTML = linhas(f);
      $$('[data-open]', $('#evl')).forEach(b => b.onclick = guard(() => abrirEvidencia(lista.find(x => x.id === b.dataset.open))));
      $$('[data-del]', $('#evl')).forEach(b => b.onclick = () => { const e = lista.find(x => x.id === b.dataset.del); if (!e) return;
        confirmBox(`Excluir a evidência "${e.nome}"? O arquivo será apagado do servidor e não poderá ser recuperado.`, 'Excluir', async () => {
          if (!lista.some(x => x.id !== e.id && x.path === e.path)) { try { await deleteObject(sRef(storage, e.path)); } catch (er) { if (!(er && er.code === 'storage/object-not-found')) throw er; } }
          await deleteDoc(evDoc(e.id)); await auditNow('Evidência excluída', null, e.categoria + ' · ' + e.nome); toast('Evidência excluída.'); route(); }); }); };
    $('#evf').onchange = draw; draw();
    const f = $('#evup'); if (f) f.onsubmit = guard(async ev => { ev.preventDefault();
      const file = $('#evfile').files[0], btn = $('#evsend'), st = $('#evst'); if (!file) return toast('Escolha um arquivo.');
      btn.disabled = true;
      try { await enviarEvidencia(file, $('#evcat').value, $('#evdesc').value.trim(), p => { st.textContent = 'Enviando… ' + p + '%'; });
        toast('Evidência enviada.'); route(); }
      catch (e) { st.textContent = ''; throw e; } finally { btn.disabled = false; } });
  };
  return `<div class="bar"><div><h1>Evidências</h1><p class="muted">${esc(contabNome(cid))} · ${lista.length} arquivo(s). Comprovantes de que as tratativas de cada categoria estão sendo feitas.</p></div></div>
    ${can.edit() ? `<div class="card"><h2>Enviar evidência</h2><form id="evup">
      <div class="row"><div><label for="evcat">Categoria *</label><select id="evcat" required>${opts(cats, '', '— selecione —')}</select></div>
      <div><label for="evfile">Arquivo *</label><input id="evfile" type="file" required accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"></div></div>
      <label for="evdesc">Descrição *</label><input id="evdesc" required maxlength="300" placeholder="O que este arquivo comprova? Ex.: Termo de treinamento de 03/2026">
      <p class="muted small">PDF, TXT, DOCX, JPG, PNG ou WEBP, até 10 MB. Fotos grandes são reduzidas automaticamente. Não envie dados pessoais além do necessário para comprovar a tratativa.</p>
      <div class="actions"><button class="primary" id="evsend">Enviar</button><span class="muted small" id="evst"></span></div></form></div>` : ''}
    <div class="card"><label for="evf" style="margin-top:0">Categoria</label><select id="evf"><option value="">Todas (${lista.length})</option>${cats.map(c => `<option value="${esc(c)}">${esc(c)} (${contagem(c)})</option>`).join('')}</select>
    <div id="evl" style="margin-top:.75rem"></div></div>`;
}

/* ---------- auditoria ---------- */
const audContab = a => a.contabId ? contabNome(a.contabId) : 'Sistema';
const auditRows = (list, comContab = true) => list.length ? `<div class="tablewrap"><table><tr><th>Quando</th><th>Usuário</th>${comContab ? '<th>Contabilidade</th>' : ''}<th>Ação</th><th>Registro</th><th>Detalhe</th></tr>
  ${list.map(a => `<tr><td>${fmt(a.ts)}</td><td>${esc(a.user)}${a.userEmail ? `<br><span class="muted small">${esc(a.userEmail)}</span>` : ''}<br><span class="muted small">${esc(ROLES[a.role] || '')}</span></td>${comContab ? `<td>${esc(audContab(a))}</td>` : ''}<td>${esc(a.acao)}</td><td>${esc(a.recTitulo)}</td><td>${esc(a.detalhe)}</td></tr>`).join('')}</table></div>` : '<p class="muted">Sem eventos.</p>';
const PAG_AUD = 200; // eventos por página; "Carregar mais" não tem teto
const novoPager = colRef => ({ colRef, itens: [], last: null, fim: false });
async function maisEventos(pg) {
  const q = pg.last ? query(pg.colRef, orderBy('ts', 'desc'), startAfter(pg.last), limit(PAG_AUD)) : query(pg.colRef, orderBy('ts', 'desc'), limit(PAG_AUD));
  const snap = await getDocs(q);
  pg.itens = pg.itens.concat(snap.docs.map(d => d.data()));
  if (snap.docs.length) pg.last = snap.docs[snap.docs.length - 1];
  pg.fim = snap.docs.length < PAG_AUD;
}
const pagInfo = pg => `${pg.itens.length} evento${pg.itens.length === 1 ? '' : 's'} carregado${pg.itens.length === 1 ? '' : 's'}${pg.fim ? ' · todos os eventos já estão na tela' : ''}`;
// Tabela de auditoria com filtro por coluna (linha de filtros sob o cabeçalho): texto livre em Quando/Registro/Detalhe, lista em Usuário/Contabilidade/Ação.
const audCols = cc => [['ts', 'Quando', 't'], ['user', 'Usuário', 's'], ...(cc ? [['cont', 'Contabilidade', 's']] : []), ['acao', 'Ação', 's'], ['rec', 'Registro', 't'], ['det', 'Detalhe', 't']];
const audUser = a => a.userEmail ? `${a.user} · ${a.userEmail}` : a.user;
const audVal = (a, k) => String(k === 'ts' ? fmt(a.ts) : k === 'user' ? audUser(a) : k === 'cont' ? audContab(a) : k === 'acao' ? a.acao : k === 'rec' ? a.recTitulo : a.detalhe) || '';
const audTabela = (id, cc) => `<div class="tablewrap"><table class="audt" id="${id}"><thead><tr>${audCols(cc).map(c => `<th>${c[1]}</th>`).join('')}</tr>
  <tr class="filtros">${audCols(cc).map(c => `<th>${c[2] === 's' ? `<select data-f="${c[0]}" aria-label="Filtrar por ${c[1]}"></select>` : `<input type="search" data-f="${c[0]}" placeholder="filtrar" aria-label="Filtrar por ${c[1]}">`}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`;
// Redesenha só o corpo (os campos de filtro ficam intocados). Devolve quantas linhas passam nos filtros.
function audDesenha(id, itens, cc, geral = '') {
  const root = $('#' + id), cols = audCols(cc), f = {};
  root.querySelectorAll('[data-f]').forEach(el => { f[el.dataset.f] = el.value; });
  cols.filter(c => c[2] === 's').forEach(c => { const sel = root.querySelector(`select[data-f="${c[0]}"]`), cur = sel.value;
    const vals = [...new Set(itens.map(a => audVal(a, c[0])).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
    const html = `<option value="">Todos</option>` + vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (sel.dataset.h !== html) { sel.innerHTML = html; sel.dataset.h = html; sel.value = vals.includes(cur) ? cur : ''; } });
  const g = geral.toLowerCase();
  const ok = itens.filter(a => cols.every(c => { const t = f[c[0]]; if (!t) return true; const v = audVal(a, c[0]); return c[2] === 's' ? v === t : v.toLowerCase().includes(t.toLowerCase()); })
    && (!g || cols.map(c => audVal(a, c[0])).join(' ').toLowerCase().includes(g)));
  root.querySelector('tbody').innerHTML = ok.length ? ok.map(a => `<tr><td>${fmt(a.ts)}</td><td>${esc(a.user)}${a.userEmail ? `<br><span class="muted small">${esc(a.userEmail)}</span>` : ''}<br><span class="muted small">${esc(ROLES[a.role] || '')}</span></td>${cc ? `<td>${esc(audContab(a))}</td>` : ''}<td>${esc(a.acao)}</td><td>${esc(a.recTitulo)}</td><td>${esc(a.detalhe)}</td></tr>`).join('')
    : `<tr><td colspan="${cols.length}" class="muted">Sem eventos${itens.length ? ' com esses filtros' : ''}.</td></tr>`;
  return { n: ok.length, filtrado: !!g || Object.values(f).some(Boolean) };
}
async function renderAudit() {
  const pc = novoPager(collection(fs, 'contabilidades', cid, 'auditoria')), ps = can.admin() ? novoPager(collection(fs, 'auditoria')) : null;
  await maisEventos(pc); if (ps) await maisEventos(ps);
  bind = () => {
    const q = $('#aq');
    const info = (pg, r) => pagInfo(pg) + (r.filtrado ? ` · ${r.n} com os filtros (valem só para os eventos carregados)` : '');
    const draw = () => { const r = audDesenha('atab', pc.itens, true, q.value); $('#ainfo').textContent = info(pc, r); $('#amais').hidden = pc.fim; };
    const drawS = () => { if (!ps) return; const r = audDesenha('stab', ps.itens, false); $('#sinfo').textContent = info(ps, r); $('#smais').hidden = ps.fim; };
    q.oninput = draw; $('#atab').addEventListener('input', draw); $('#atab').addEventListener('change', draw);
    if (ps) { $('#stab').addEventListener('input', drawS); $('#stab').addEventListener('change', drawS); }
    draw(); drawS();
    $('#amais').onclick = guard(async () => { $('#amais').disabled = true; try { await maisEventos(pc); } finally { $('#amais').disabled = false; } draw(); });
    if (ps) $('#smais').onclick = guard(async () => { $('#smais').disabled = true; try { await maisEventos(ps); } finally { $('#smais').disabled = false; } drawS(); });
  };
  return `<div class="bar"><div><h1>Auditoria</h1><p class="muted">${esc(contabNome(cid))} · do mais recente para o mais antigo. Somente leitura: o servidor não permite editar nem apagar eventos.</p></div></div>
    <div class="card"><label for="aq" style="margin-top:0">Busca geral</label><input id="aq" type="search" placeholder="Procura em todas as colunas…"><div style="margin-top:.75rem">${audTabela('atab', true)}</div>
      <div class="actions"><span class="muted small" id="ainfo" aria-live="polite"></span><button id="amais" type="button">Carregar mais ${PAG_AUD}</button></div></div>
    ${ps ? `<div class="card"><h2>Log de acessos e eventos do sistema (administrador)</h2><p class="muted small">Cada entrada e saída bem-sucedida registra data/hora, nome, e-mail e perfil do usuário. Também inclui usuários, contabilidades e categorias.</p>${audTabela('stab', false)}
      <div class="actions"><span class="muted small" id="sinfo" aria-live="polite"></span><button id="smais" type="button">Carregar mais ${PAG_AUD}</button></div></div>` : ''}`;
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
    clearTimeout(presenceRefreshTimer);
    presenceRefreshTimer = setTimeout(() => { if (location.hash === '#/usuarios') route(); }, 30000);
  };
  const firms = u => u.role === 'admin' ? '<span class="muted">todas</span>' : ((u.contabilidades || []).map(contabNome).map(esc).join(', ') || '<span class="tag bad">nenhuma</span>');
  const online = new Map(db.presencas.filter(p => tms(p.lastSeen) && Date.now() - tms(p.lastSeen) < ONLINE_MS).map(p => [p.id, p]));
  return `<div class="bar"><div><h1>Usuários</h1><p class="muted"><b>${online.size} online agora</b> · o status é renovado a cada minuto e considera offline após 2 minutos sem sinal. Administrador enxerga todas as contabilidades; Consulta e Edição só as vinculadas.</p></div><button class="primary" id="nu">+ Novo usuário</button></div>
    <div class="card tablewrap"><table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Contabilidades</th><th>Agora</th><th>Situação</th><th></th></tr>
    ${db.users.slice().sort(byName).map(u => `<tr><td>${esc(u.nome)}${u.id === me.id ? ' <span class="tag brand">você</span>' : ''}</td><td>${esc(u.email)}</td><td>${ROLES[u.role] || esc(u.role)}</td><td>${firms(u)}</td>
    <td>${online.has(u.id) ? '<span class="tag ok">online</span>' : '<span class="muted small">offline</span>'}</td>
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
    const nums = (db.contabsAll || db.contabs).map(c => /^Contabilidade (\d+)$/.exec(c.nome)).filter(Boolean).map(m => +m[1]);
    return 'Contabilidade ' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
  };
  bind = () => {
    const create = guard(async nome => {
      nome = nome.trim(); if (!nome) return toast('Informe o nome.');
      if ((db.contabsAll || db.contabs).some(c => c.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe uma contabilidade com este nome.');
      const ref = doc(collection(fs, 'contabilidades')), b = writeBatch(fs);
      b.set(ref, { nome, criado: serverTimestamp() }); auditOp(b, 'Contabilidade criada', null, nome); await b.commit();
      toast(nome + ' criada.'); route();
    });
    $('#cf').onsubmit = e => { e.preventDefault(); create($('#cn').value); };
    $('#cnext').onclick = () => create(nextName());
    document.querySelectorAll('[data-ren]').forEach(btn => btn.onclick = () => {
      const c = db.contabs.find(x => x.id === btn.dataset.ren);
      let novaLogo = null; // null = manter; '' = remover; 'data:…' = nova
      modal(`<h3>Editar contabilidade</h3><form id="rn"><label for="nn">Nome</label><input id="nn" required maxlength="100" value="${esc(c.nome)}">
        <h4 style="margin:1rem 0 .2rem">Dados do escritório (usados no Termo de Ciência)</h4>
        <label for="cz">Razão social</label><input id="cz" maxlength="200" value="${esc(c.razaoSocial)}">
        <label for="cj">CNPJ</label><input id="cj" maxlength="18" inputmode="numeric" autocomplete="off" value="${esc(c.cnpj)}"><div class="muted small" id="cjs" aria-live="polite">Com um CNPJ válido, razão social e endereço são preenchidos pela base pública da Receita Federal.</div>
        <label for="ce">Endereço</label><input id="ce" maxlength="300" value="${esc(c.endereco)}">
        <h4 style="margin:1rem 0 .2rem">Enquadramento (preenchido pela consulta ao CNPJ; confira)</h4>
        <div class="row"><div><label for="cpt">Porte na Receita</label><select id="cpt">${opts(PORTES, c.porteRfb, '— não consultado —')}</select></div>
        <div><label for="csn">Optante pelo Simples Nacional</label><select id="csn">${opts(['Sim', 'Não'], c.simples, '— não consultado —')}</select></div></div>
        <label for="cnat">Natureza jurídica</label><input id="cnat" maxlength="120" value="${esc(c.natJur)}">
        <div class="muted small">${c.consultaEm ? 'Última consulta à Receita: ' + esc(c.consultaEm.split('-').reverse().join('/')) + '. ' : ''}O porte é declarado à Receita e pode estar desatualizado. Alimenta o diagnóstico do checklist de Governança; não decide dispensa de encarregado.</div>
        <label for="cp">Canal de privacidade (e-mail ou outro canal de atendimento)</label><input id="cp" maxlength="200" value="${esc(c.canalPrivacidade)}">
        <label for="lf">Logo do escritório</label>
        <div class="firmlogo-prev" id="lp">${firmLogo(c.id) ? `<img src="${firmLogo(c.id)}" alt="Logo atual">` : '<span class="muted small">Sem logo.</span>'}</div>
        <input id="lf" type="file" accept="image/png,image/jpeg,image/webp">
        <div class="muted small">PNG, JPG ou WEBP. A imagem é reduzida automaticamente. Aparece no cabeçalho dos registros e nos relatórios impressos.</div>
        <div class="actions"><button class="primary">Salvar</button><button type="button" id="lrm"${firmLogo(c.id) ? '' : ' hidden'}>Remover logo</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
        $('#x', d).onclick = () => d.close();
        ligaBuscaCnpj($('#cj', d), $('#cjs', d), { razao: $('#cz', d), end: $('#ce', d), porte: $('#cpt', d), simples: $('#csn', d), nat: $('#cnat', d) });
        const prev = () => { $('#lp', d).innerHTML = novaLogo ? `<img src="${novaLogo}" alt="Nova logo">` : '<span class="muted small">Sem logo.</span>'; };
        $('#lf', d).onchange = guard(async () => { const f = $('#lf', d).files[0]; if (!f) return; try { novaLogo = await prepararLogo(f); prev(); $('#lrm', d).hidden = false; } catch (e) { $('#lf', d).value = ''; toast(e.message); } });
        $('#lrm', d).onclick = () => { novaLogo = ''; $('#lf', d).value = ''; prev(); $('#lrm', d).hidden = true; };
        $('#rn', d).onsubmit = guard(async e => { e.preventDefault(); const nome = $('#nn', d).value.trim(); if (!nome) return;
          if (nome !== c.nome && db.contabsAll.some(x => x.id !== c.id && x.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe uma contabilidade com este nome.');
          const dig = $('#cj', d).value.replace(/\D/g, '');
          if (dig && (dig.length !== 14 || !cnpjValido(dig))) return toast('CNPJ inválido. Confira os dígitos ou deixe em branco.');
          const cad = { razaoSocial: $('#cz', d).value.trim(), cnpj: dig ? dig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '', endereco: $('#ce', d).value.trim(), canalPrivacidade: $('#cp', d).value.trim(),
            porteRfb: $('#cpt', d).value, simples: $('#csn', d).value, natJur: $('#cnat', d).value.trim() };
          if ($('#cj', d).dataset.consulta && ['porteRfb', 'simples', 'natJur'].some(k => (c[k] || '') !== cad[k])) cad.consultaEm = $('#cj', d).dataset.consulta;
          const mudouCad = Object.keys(cad).some(k => (c[k] || '') !== cad[k]);
          const upd = { nome, ...cad }; if (novaLogo !== null) upd.logo = novaLogo;
          if (nome === c.nome && novaLogo === null && !mudouCad) return d.close();
          const b = writeBatch(fs); b.update(doc(fs, 'contabilidades', c.id), upd);
          if (nome !== c.nome) auditOp(b, 'Contabilidade renomeada', null, `${c.nome} → ${nome}`);
          if (mudouCad) auditOp(b, 'Dados cadastrais da contabilidade alterados', null, nome);
          if (novaLogo !== null) auditOp(b, novaLogo ? 'Logo da contabilidade alterada' : 'Logo da contabilidade removida', null, nome);
          await b.commit(); d.close(); await loadCore(); route(); });
      });
    });
    document.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => {
      const c = db.contabs.find(x => x.id === btn.dataset.del);
      const vinc = db.users.filter(u => u.role !== 'admin' && (u.contabilidades || []).includes(c.id));
      modal(`<h3>Excluir contabilidade</h3>
        <p>Você vai excluir <b>${esc(c.nome)}</b>. Ela some das listas e <b>${vinc.length} usuário(s)</b> perdem o acesso a ela.</p>
        <p class="muted small">Os registros, versões e a trilha de auditoria <b>não são apagados</b>: ficam guardados no servidor e a contabilidade pode ser restaurada abaixo, em "Excluídas". A trilha de auditoria é imutável por regra do sistema.</p>
        <form id="dl"><label for="dn">Digite o nome da contabilidade para confirmar</label><input id="dn" autocomplete="off" required><div class="actions"><button class="danger" id="dok" disabled>Excluir</button><button type="button" id="x">Cancelar</button></div></form>`, d => {
        $('#x', d).onclick = () => d.close();
        $('#dn', d).oninput = () => { $('#dok', d).disabled = $('#dn', d).value.trim() !== c.nome; };
        $('#dl', d).onsubmit = guard(async e => { e.preventDefault(); if ($('#dn', d).value.trim() !== c.nome) return;
          const b = writeBatch(fs);
          b.update(doc(fs, 'contabilidades', c.id), { excluida: true, excluidaEm: serverTimestamp() });
          vinc.forEach(u => { b.update(doc(fs, 'users', u.id), { contabilidades: (u.contabilidades || []).filter(x => x !== c.id) }); b.delete(doc(fs, 'contabilidades', c.id, 'pessoas', u.id)); });
          auditOp(b, 'Contabilidade excluída', null, c.nome + (vinc.length ? ` (acesso removido de: ${vinc.map(u => u.nome).join(', ')})` : ''));
          await b.commit(); d.close(); toast(c.nome + ' excluída.'); await loadCore(); route(); });
      });
    });
    document.querySelectorAll('[data-res]').forEach(btn => btn.onclick = guard(async () => {
      const c = db.contabsAll.find(x => x.id === btn.dataset.res); const b = writeBatch(fs);
      b.update(doc(fs, 'contabilidades', c.id), { excluida: false });
      auditOp(b, 'Contabilidade restaurada', null, c.nome); await b.commit(); toast(c.nome + ' restaurada. Vincule os usuários novamente em Usuários.'); await loadCore(); route();
    }));
  };
  return `<div class="bar"><div><h1>Contabilidades</h1><p class="muted">Cada contabilidade tem registros, versões e auditoria próprios, isolados no servidor. Vincule usuários em <a href="#/usuarios">Usuários</a>.</p></div></div>
    <div class="card"><form id="cf" class="row" style="align-items:end"><div><label for="cn" style="margin-top:0">Nova contabilidade</label><input id="cn" maxlength="100" placeholder="Nome do escritório"></div>
    <div class="actions" style="margin:0"><button class="primary">Adicionar</button><button type="button" id="cnext">Criar “${esc(nextName())}”</button></div></form></div>
    <div class="card tablewrap"><table><tr><th>Nome</th><th>Usuários vinculados</th><th></th></tr>${db.contabs.map(c => {
      const us = db.users.filter(u => u.role !== 'admin' && u.ativo && (u.contabilidades || []).includes(c.id));
      return `<tr><td>${firmLogo(c.id) ? `<img class="firmlogo-th" src="${firmLogo(c.id)}" alt=""> ` : ''}${esc(c.nome)}</td><td>${us.length ? us.map(u => `${esc(u.nome)} <span class="muted small">(${esc(ROLES[u.role] || '')})</span>`).join('<br>') : '<span class="muted">Nenhum</span>'}</td><td style="text-align:right"><button data-ren="${esc(c.id)}">Editar</button> <button class="danger" data-del="${esc(c.id)}">Excluir</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="muted">Nenhuma contabilidade.</td></tr>'}</table></div>
    ${(db.contabsAll || []).some(c => c.excluida) ? `<div class="card tablewrap"><h2>Excluídas</h2><table>${db.contabsAll.filter(c => c.excluida).map(c => `<tr><td>${esc(c.nome)}</td><td style="text-align:right"><button data-res="${esc(c.id)}">Restaurar</button></td></tr>`).join('')}</table></div>` : ''}`;
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
    const evidencias = (await getDocs(collection(fs, 'contabilidades', id, 'evidencias'))).docs.map(d => ({ id: d.id, ...d.data() })); // só os metadados: os arquivos ficam no Storage
    return { id, nome: contabNome(id), registros, auditoria, evidencias };
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
        for (const c of (db.contabsAll || db.contabs)) out.contabilidades.push(await exportFirm(c.id));
        out.auditoria_sistema = await loadSysAudit(5000);
        download('lgpdsan-backup-completo-' + today() + '.json', toJson(out), 'application/json');
        await auditNow('Backup completo exportado', null, (db.contabsAll || db.contabs).length + ' contabilidade(s)');
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

/* ---------- atualizações ANPD (somente leitura; conteúdo sincronizado do gov.br) ---------- */
async function renderAnpd() {
  let pubs = [], lidas = new Set(), err = null;
  try { const r = await loadAnpd(); pubs = r.pubs; lidas = r.lidas; }
  catch (e) { err = errMsg(e); }
  bind = () => {
    const draw = () => {
      const q = $('#aq').value, nl = $('#af').value === 'nl';
      let lista = anpdFiltra(pubs, q);
      if (nl) lista = lista.filter(p => !lidas.has(p.id));
      $('#ainfo').textContent = `${lista.length} publicação(ões)` + (nl ? ' não lida(s)' : '') + (q ? ` com "${q}"` : '');
      $('#alist').innerHTML = lista.length ? lista.map(p => {
        const lida = lidas.has(p.id);
        return `<div class="anpd-item${lida ? '' : ' novo'}"><div class="anpd-t"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.titulo)}</a>${lida ? '' : ' <span class="tag brand">nova</span>'}</div>
          <div class="muted small">${anpdData(p) ? fmtD(anpdData(p)) : '—'} · ${esc(p.fonte || 'ANPD')}</div>
          ${p.descricao ? `<div class="small" style="margin-top:.3rem">${esc(p.descricao)}</div>` : ''}
          <div class="actions" style="margin:.5rem 0 0">${lida
            ? `<button data-nl="${esc(p.id)}">Marcar como não lida</button>`
            : `<button class="primary" data-l="${esc(p.id)}">Marcar como lida</button>`}</div></div>`;
      }).join('') : '<p class="muted">Nenhuma publicação' + (q || nl ? ' com esses filtros' : '') + '.</p>';
      $$('#alist [data-l]').forEach(b => b.onclick = guard(async () => { await anpdMarcar(b.dataset.l, true); lidas.add(b.dataset.l); db.anpdUnread = Math.max(0, (db.anpdUnread || 0) - 1); paintBadge(); draw(); }));
      $$('#alist [data-nl]').forEach(b => b.onclick = guard(async () => { await anpdMarcar(b.dataset.nl, false); lidas.delete(b.dataset.nl); db.anpdUnread = (db.anpdUnread || 0) + 1; paintBadge(); draw(); }));
    };
    $('#aq').oninput = draw; $('#af').onchange = draw; draw();
    $('#atodas').onclick = guard(async () => {
      const pend = pubs.filter(p => !lidas.has(p.id));
      if (!pend.length) return toast('Tudo já está marcado como lido.');
      const b = writeBatch(fs);
      pend.forEach(p => b.set(doc(fs, 'users', me.id, 'anpdLidas', p.id), { pubId: p.id, quando: serverTimestamp() }));
      await b.commit(); pend.forEach(p => lidas.add(p.id)); db.anpdUnread = 0; paintBadge(); toast('Todas as publicações marcadas como lidas.'); draw();
    });
  };
  return `<div class="bar"><div><h1>Atualizações ANPD</h1><p class="muted">Publicações oficiais da Autoridade Nacional de Proteção de Dados, sincronizadas de <a href="${ANPD_URL}" target="_blank" rel="noopener noreferrer">gov.br/anpd</a>. Somente leitura — o conteúdo oficial não pode ser alterado pelo sistema.</p></div>
    <div class="actions" style="margin:0"><button id="atodas">Marcar todas como lidas</button></div></div>
    ${err ? `<div class="notice bad">Não foi possível carregar as publicações: ${esc(err)}. Verifique se as regras do Firestore estão publicadas.</div>` : ''}
    <div class="filters"><div><label for="aq">Pesquisa</label><input id="aq" type="search" placeholder="Palavra-chave…"></div>
    <div><label for="af">Exibir</label><select id="af"><option value="">Todas</option><option value="nl">Somente não lidas</option></select></div></div>
    <div class="card"><p class="muted small" id="ainfo" aria-live="polite"></p><div id="alist"></div></div>`;
}

const htmlDeModelo = d => d.arquivo.replace(/\.(docx|xlsx)$/, '.html');
async function renderManualLgpd() {
  const base = 'manual-lgpd/';
  let ausente = false;
  try { const r = await fetch(base + encodeURIComponent(htmlDeModelo(MANUAL_LGPD[0])) + '?v=' + VERSION, { method: 'HEAD', cache: 'no-cache' }); ausente = !r.ok; } catch (e) { ausente = true; }
  const tipo = a => a.endsWith('.xlsx') ? 'Planilha' : 'Word';
  return `<div class="bar"><div><h1>Manual da LGPD</h1><p class="muted">Modelos de documentos para adequação à LGPD. Clique no documento para ler na tela; baixe o original para preencher.</p></div></div>
    ${ausente ? '<div class="card"><p><b>Documentos ainda não publicados.</b> A pasta <code>manual-lgpd/</code> não foi encontrada no site. Envie a pasta ao repositório e publique de novo.</p></div>' : ''}
    <div class="card tablewrap"><table><thead><tr><th>Código</th><th>Documento</th><th>Formato</th><th></th></tr></thead><tbody>
    ${MANUAL_LGPD.map(d => `<tr><td class="small muted">${esc(d.cod)}</td><td><a href="#/manual-lgpd/${encodeURIComponent(d.cod)}"><b>${esc(d.titulo)}</b></a></td><td class="small muted">${tipo(d.arquivo)}</td><td><a class="small" href="${base}${encodeURIComponent(d.arquivo)}" download>Baixar original</a></td></tr>`).join('')}
    </tbody></table></div>`;
}
async function renderManualLgpdDoc(cod) {
  const i = MANUAL_LGPD.findIndex(x => x.cod.toLowerCase() === cod.toLowerCase());
  const d = MANUAL_LGPD[i];
  if (!d) return `<h1>Documento não encontrado</h1><p><a href="#/manual-lgpd">Voltar ao Manual da LGPD</a></p>`;
  const planilha = d.arquivo.endsWith('.xlsx');
  let corpo;
  try {
    const r = await fetch(`manual-lgpd/${encodeURIComponent(htmlDeModelo(d))}?v=${VERSION}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    corpo = await r.text();
  } catch (e) { corpo = `<p class="muted">Não foi possível carregar o documento (${esc(e.message)}). Use <b>Baixar original</b>.</p>`; }
  const ant = MANUAL_LGPD[i - 1], prox = MANUAL_LGPD[i + 1];
  const nav = x => x ? `#/manual-lgpd/${encodeURIComponent(x.cod)}` : '';
  bind = () => {
    const pb = $('#mdprn'); if (pb) pb.onclick = () => window.print();
    const abas = $$('.doc .aba');
    if (abas.length) {
      const bar = document.createElement('div'); bar.className = 'abas no-print'; bar.setAttribute('role', 'tablist');
      const mostra = n => {
        abas.forEach((a, k) => { a.hidden = k !== n; });
        [...bar.children].forEach((b, k) => { b.classList.toggle('on', k === n); b.setAttribute('aria-selected', k === n); });
      };
      abas.forEach((a, k) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = a.dataset.titulo; b.onclick = () => mostra(k); bar.appendChild(b); });
      abas[0].parentElement.insertBefore(bar, abas[0]); mostra(0);
    }
  };
  return `<div class="bar"><div><p class="small"><a href="#/manual-lgpd">← Manual da LGPD</a></p><h1>${esc(d.titulo)}</h1><p class="muted small">${esc(d.cod)} · Modelo para adaptar ao escritório. Os campos entre colchetes [ ] devem ser preenchidos antes do uso.</p></div>
    <div class="actions" style="margin:0"><a class="btn" href="manual-lgpd/${encodeURIComponent(d.arquivo)}" download>Baixar original (.${planilha ? 'xlsx' : 'docx'})</a><button id="mdprn">Imprimir</button></div></div>
    <div class="card doc">${corpo}</div>
    <div class="actions no-print" style="justify-content:space-between">${ant ? `<a class="btn" href="${nav(ant)}">← ${esc(ant.cod)}</a>` : '<span></span>'}${prox ? `<a class="btn" href="${nav(prox)}">${esc(prox.cod)} →</a>` : '<span></span>'}</div>`;
}

async function renderManual() {
  let corpo;
  try {
    const r = await fetch(`manual.html?v=${VERSION}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    corpo = await r.text();
  } catch (e) { corpo = `<p class="muted">Não foi possível carregar o manual (${esc(e.message)}).</p>`; }
  const toc = [...corpo.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)].map(m => `<li><a href="#/manual" data-go="${m[1]}">${m[2]}</a></li>`).join('');
  bind = () => {
    $$('[data-go]').forEach(a => a.onclick = ev => { ev.preventDefault(); const t = document.getElementById(a.dataset.go); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const pb = $('#mprn'); if (pb) pb.onclick = () => window.print();
  };
  return `<div class="bar"><div><h1>Manual do usuário</h1><p class="muted">LGPDSAN v${VERSION}. Como usar cada parte do sistema.</p></div><div class="actions" style="margin:0"><button id="mprn">Imprimir manual</button></div></div>
    <div class="card"><h2>Neste manual</h2><ol class="toc">${toc}</ol></div>
    <div class="card doc">${corpo}</div>`;
}

const TERMO_CAMPOS = [['cnpje', 'Empregador: CNPJ (preenche razão social e endereço)'], ['emp', 'Empregador: razão social'], ['eaddr', 'Empregador: endereço'],
  ['cnpjc', 'Escritório: CNPJ'], ['esc', 'Escritório: razão social'], ['caddr', 'Escritório: endereço'],
  ['nome', 'Empregado(a): nome completo'], ['cpf', 'Empregado(a): CPF'], ['cemp', 'Canal de privacidade do empregador'], ['cesc', 'Canal de privacidade do escritório']];
async function renderTermo() {
  let corpo;
  try {
    const r = await fetch(`termo.html?v=${VERSION}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    corpo = await r.text();
  } catch (e) { corpo = `<p class="muted">Não foi possível carregar o termo (${esc(e.message)}).</p>`; }
  // Nada aqui é gravado: os valores vivem só nesta página e somem ao sair dela.
  const cb = db.contabs.find(x => x.id === cid) || {};
  const vals = { esc: cb.razaoSocial || contabNome(cid), cnpjc: cb.cnpj || '', caddr: cb.endereco || '', cesc: cb.canalPrivacidade || '' };
  const paint = modo => $$('#termo .ph').forEach(sp => { const v = (vals[sp.dataset.f] || '').trim();
    sp.textContent = v || (modo === 'print' ? '______________________________' : '[' + sp.dataset.l + ']'); sp.classList.toggle('vazio', !v); });
  const imprimir = () => { paint('print'); try { window.print(); } finally { paint('screen'); } };
  bind = () => {
    paint('screen');
    window.onbeforeprint = () => paint('print'); window.onafterprint = () => paint('screen');
    $$('[data-tf]').forEach(inp => inp.oninput = () => { vals[inp.dataset.tf] = inp.value; paint('screen'); });
    const tf = k => $('#tf_' + k);
    ligaBuscaCnpj(tf('cnpje'), $('#tfs_cnpje'), { razao: tf('emp'), end: tf('eaddr') });
    ligaBuscaCnpj(tf('cnpjc'), $('#tfs_cnpjc'), { razao: tf('esc'), end: tf('caddr') });
    $('#tedit').onclick = () => { const t = $('#termo'), on = t.contentEditable !== 'true'; t.contentEditable = on ? 'true' : 'false'; t.classList.toggle('editando', on);
      $('#tedit').textContent = on ? 'Concluir edição do texto' : 'Editar texto do termo'; if (on) t.focus(); };
    $('#tclr').onclick = () => { $$('[data-tf]').forEach(inp => { inp.value = ''; vals[inp.dataset.tf] = ''; }); paint('screen'); };
    $('#tprn').onclick = () => { const faltam = TERMO_CAMPOS.filter(([k]) => !(vals[k] || '').trim()).length;
      if (!faltam) return imprimir();
      confirmBox(`${faltam} campo(s) em branco. Eles sairão como linhas para preencher à mão. Imprimir assim?`, 'Imprimir', imprimir, false); };
  };
  return `<div class="bar no-print"><div><h1>Termo de Ciência</h1><p class="muted">Informa o empregado sobre o tratamento e o compartilhamento dos dados da folha de pagamento e do eSocial com o escritório de contabilidade.</p></div>
    <div class="actions" style="margin:0"><button id="tedit">Editar texto do termo</button><button id="tclr">Limpar campos</button><button class="primary" id="tprn">Imprimir</button></div></div>
    <div class="card no-print"><h2>Preencha antes de imprimir</h2>
    <p class="small"><b>Nada do que você digita aqui é salvo no sistema.</b> Os dados do empregado ficam só nesta tela e somem quando você sai ou recarrega a página. Imprima e colha a assinatura em papel. Se guardar o termo assinado, guarde na pasta do cliente, não aqui.</p>
    <div class="row">${TERMO_CAMPOS.map(([k, l]) => `<div><label for="tf_${k}">${esc(l)}</label><input id="tf_${k}" data-tf="${k}" autocomplete="off" maxlength="300" value="${esc(vals[k] || '')}">${k === 'cnpje' || k === 'cnpjc' ? `<div class="muted small" id="tfs_${k}" aria-live="polite"></div>` : ''}</div>`).join('')}</div>
    <p class="muted small">Os dados do escritório vêm do cadastro em Contabilidades (administrador). Dados do empregador e do empregado não são guardados.</p>
    <p class="muted small" style="margin-bottom:0">Para ajustar frases do termo, use "Editar texto do termo". Documento-modelo: adeque às operações realmente feitas, ao contrato entre empregador e escritório e à legislação, de preferência com revisão de advogado.</p></div>
    <div class="card doc termo" id="termo" spellcheck="false">${firmLogo() ? `<img class="firmlogo t-logo" src="${firmLogo()}" alt="Logo ${esc(contabNome(cid))}">` : ''}${corpo}</div>`;
}

function renderAbout() {
  return `<div class="bar"><div><h1>Sobre</h1><p class="muted">LGPDSAN v${VERSION}</p></div></div>
    <div class="card"><h2>Como a segurança funciona</h2><p>Login pelo Firebase Authentication. Permissões, isolamento entre contabilidades e auditoria são <b>aplicados no servidor</b> pelas Regras do Firestore; esconder um botão na tela não é a proteção.</p>
    <ul><li>Dados no Firestore, região São Paulo.</li><li>Cada contabilidade é isolada: usuários só leem e gravam nas contabilidades a que estão vinculados. Somente o Administrador acessa todas.</li><li>Auditoria somente de criação: nem o administrador altera eventos pelo app.</li><li>Versões de registros são imutáveis; só a exclusão permanente do registro as remove.</li><li>Única consulta externa feita pelo navegador: ao digitar um CNPJ válido (checklist de Contratos e Operadores, cadastro de Contabilidades e Termo de Ciência), o CNPJ (somente ele) é enviado à BrasilAPI ou, se ela falhar, ao CNPJ.ws, que devolvem dados públicos da Receita Federal.</li>
<li>Atualizações ANPD: as publicações de gov.br/anpd são baixadas por um serviço (GitHub Actions), não pelo navegador. Nenhum dado do usuário sai do sistema.</li></ul></div>
    <div class="card"><h2>Como calculamos a pontuação do checklist</h2>
    <ul><li><b>Declarado</b>: soma ponderada das respostas. Conforme vale 1, Parcial vale 0,5, Não conforme e sem avaliação valem 0. N/A sai do cálculo.</li>
    <li><b>Peso</b>: itens críticos valem 2; os demais, 1. Crítico é o item que, marcado como Não conforme, gera um ponto de atenção no guia.</li>
    <li><b>Comprovado</b>: só conta o item "Conforme" que tenha ao menos uma evidência anexada. Nos itens críticos, o estágio também precisa ser Implantado ou Testado: um documento redigido não basta.</li>
    <li>Os percentuais mostram a situação registrada na plataforma. Não são certificação nem garantia de conformidade, e não dispensam validação por advogado e contador.</li></ul></div>
    <div class="card"><h2>Revisão periódica e aprovação</h2>
    <ul><li><b>Próxima revisão</b>: data em cada registro (política, contrato, treinamento, avaliação de fornecedor). O Painel e a lista destacam as revisões vencidas ou nos próximos 30 dias. Ao marcar "Em vigor" sem data, o sistema sugere 12 meses.</li>
    <li><b>Aprovação formal</b>: só o Administrador aprova uma versão; ficam gravados quem aprovou, quando e qual versão. Se o registro for editado depois, ele aparece como "alterado após aprovação" até nova aprovação.</li>
    <li>Não há envio de e-mail de aviso: os alertas aparecem no Painel.</li></ul></div>
    <div class="card"><h2>Limitações conhecidas</h2><ul><li>Evidências ficam no Firebase Storage (até 10 MB por arquivo). Sem e-mails de prazo e sem links temporários: quem tem o link de download consegue abrir o arquivo.</li>
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
    me.tema = temaDe(me); applyTheme(me.tema); lsSet('lgpdsan:tema', me.tema);
    startPresence();
    if (justSignedIn) { justSignedIn = false; try { await auditNow('Login'); } catch (e) { console.error(e); } }
    route();
  } catch (e) { console.error(e); me = null; await signOut(auth); renderLogin('Não foi possível validar o acesso: ' + errMsg(e)); }
});
