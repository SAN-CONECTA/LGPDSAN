// Auditoria gravada no servidor (Cloud Functions, 2ª geração).
// O cliente grava os eventos que ele mesmo origina; aqui ficam os que ele não
// consegue gravar sem autenticação (login falho) e os que precisam da garantia
// do servidor (alteração de permissões). Eventos do Admin SDK ignoram as regras
// do Firestore; por isso recebem o campo origem: 'servidor'.
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

admin.initializeApp();
const db = getFirestore();

// Mesma região do Firestore (São Paulo): menos latência e dados tratados no Brasil.
// O cliente precisa usar getFunctions(app, 'southamerica-east1') em assets/app.js.
setGlobalOptions({ region: 'southamerica-east1' });

const MOTIVOS = ['senha-invalida', 'conta-inativa', 'usuario-inexistente', 'bloqueado'];
const MAX_EMAIL = 254;   // limite de endereço de e-mail (RFC 5321)
const MAX_UA = 300;
const LIMITE_POR_HORA = 20;
const UMA_HORA = 60 * 60 * 1000;

const texto = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const lista = v => v.length ? v.join(', ') : 'nenhuma';
const hash = v => crypto.createHash('sha256').update(v).digest('hex');

// IP do cliente: primeiro endereço de x-forwarded-for (é o cliente real atrás do
// proxy do Google) ou, na falta dele, request.rawRequest.ip.
const ipDaRequisicao = raw => {
  const cabecalhos = (raw && raw.headers) || {};
  const encaminhado = String(cabecalhos['x-forwarded-for'] || '').split(',')[0];
  return texto(encaminhado, 60) || texto(raw && raw.ip, 60);
};

// Limite de abuso: no máximo 20 gravações por IP a cada hora. O IP fica em hash
// SHA-256 no contador (rate_limit/{ip-hash}); em texto, somente no evento.
async function dentroDoLimite(ip) {
  const ref = db.collection('rate_limit').doc(hash(ip || 'desconhecido'));
  const agora = Date.now();
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : null;
    const inicio = d && d.janela && typeof d.janela.toMillis === 'function' ? d.janela.toMillis() : 0;
    if (!d || agora - inicio >= UMA_HORA) {
      tx.set(ref, {
        ipHash: ref.id,
        janela: new Date(agora),
        contagem: 1,
        expira: new Date(agora + UMA_HORA) // TTL opcional no console
      });
      return true;
    }
    if (Number(d.contagem || 0) >= LIMITE_POR_HORA) return false;
    tx.update(ref, { contagem: FieldValue.increment(1) });
    return true;
  });
}

// Tentativa de login falha, conta inativa ou usuário inexistente.
// Não exige autenticação: é justamente o caso em que o cliente ainda não entrou.
// A resposta é sempre neutra para não revelar se o e-mail existe.
exports.registrarTentativaLogin = onCall({ invoker: 'public' }, async request => {
  const dados = (request && request.data) || {};
  const email = texto(dados.email, MAX_EMAIL).toLowerCase();
  const motivo = String(dados.motivo || '');
  if (!email) throw new HttpsError('invalid-argument', 'Informe o e-mail.');
  if (!MOTIVOS.includes(motivo)) throw new HttpsError('invalid-argument', 'Motivo inválido.');

  const raw = (request && request.rawRequest) || {};
  const ip = ipDaRequisicao(raw);
  const userAgent = texto((raw.headers || {})['user-agent'], MAX_UA);

  if (!(await dentroDoLimite(ip))) {
    // Acima do limite: ignora em silêncio (nem o limite nem o e-mail são revelados).
    console.warn('Tentativas de login acima do limite por IP.');
    return { ok: true };
  }

  await db.collection('auditoria').add({
    ts: FieldValue.serverTimestamp(),
    userId: null,
    user: 'Não autenticado',
    userEmail: email,
    role: '',
    acao: 'Login falhou',
    recId: null,
    recTitulo: '',
    detalhe: 'Tentativa de login: ' + motivo,
    motivo,
    escopo: 'sistema',
    contabId: null,
    ip: ip || null,
    userAgent,
    origem: 'servidor'
  });
  return { ok: true };
});

// Dados de perfil que definem permissão. O diff compara só estes três campos,
// para que tema, sessão e presença não gerem eventos de auditoria.
const retrato = d => ({
  role: texto(d.role, 20),
  ativo: d.ativo === true,
  contabilidades: Array.isArray(d.contabilidades) ? [...new Set(d.contabilidades.map(String))].sort() : []
});
const igual = (a, b) => a.role === b.role && a.ativo === b.ativo
  && a.contabilidades.length === b.contabilidades.length
  && a.contabilidades.every((x, i) => x === b.contabilidades[i]);

// Autor da alteração: o cliente grava atualizadoPor em users/{uid}.
// (O trigger do Firestore não recebe o contexto de autenticação; o campo é a
// melhor informação disponível e é gravado pelo próprio administrador.)
async function autorDe(uid) {
  if (!uid) return null;
  try {
    const s = await db.collection('users').doc(uid).get();
    return s.exists ? s.data() : null;
  } catch (e) { return null; }
}

// Edição de permissões de usuário com autoria garantida pelo servidor.
// O app chama esta função; as regras de users/{uid} ainda aceitam escrita direta do
// administrador pelo SDK (ficam sem atualizadoPor confiável — pendência em docs/FIREBASE.md).
exports.atualizarUsuario = onCall({ invoker: 'public' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre para alterar usuários.');
  const eu = await autorDe(request.auth.uid);
  if (!eu || eu.role !== 'admin' || eu.ativo !== true) {
    throw new HttpsError('permission-denied', 'Somente administradores ativos alteram usuários.');
  }

  const dados = (request && request.data) || {};
  const uid = typeof dados.uid === 'string' ? dados.uid.trim() : '';
  const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
  const role = String(dados.role || '');
  const ativo = dados.ativo === true;
  if (!uid || uid.length > 128) throw new HttpsError('invalid-argument', 'Usuário inválido.');
  if (!nome || nome.length > 100) throw new HttpsError('invalid-argument', 'Nome inválido (máximo 100 caracteres).');
  if (!['consulta', 'edicao', 'admin'].includes(role)) throw new HttpsError('invalid-argument', 'Perfil inválido.');
  if (!Array.isArray(dados.contabilidades) || dados.contabilidades.length > 200
    || dados.contabilidades.some(c => typeof c !== 'string' || c.length > 128)) {
    throw new HttpsError('invalid-argument', 'Contabilidades inválidas.');
  }
  if (uid === request.auth.uid && (role !== 'admin' || !ativo)) {
    throw new HttpsError('failed-precondition', 'Você não pode remover o próprio perfil de administrador nem se bloquear.');
  }

  const alvo = db.collection('users').doc(uid);
  const atual = await alvo.get();
  if (!atual.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');
  await alvo.update({ nome, role, contabilidades: [...new Set(dados.contabilidades)], ativo, atualizadoPor: request.auth.uid });
  return { ok: true };
});

exports.onUserWrite = onDocumentWritten('users/{uid}', async event => {
  const antesDoc = event.data && event.data.before;
  const depoisDoc = event.data && event.data.after;
  const existeAntes = !!antesDoc && antesDoc.exists;
  const existeDepois = !!depoisDoc && depoisDoc.exists;
  if (!existeAntes && !existeDepois) return;

  const antes = existeAntes ? retrato(antesDoc.data() || {}) : null;
  const depois = existeDepois ? retrato(depoisDoc.data() || {}) : null;
  if (antes && depois && igual(antes, depois)) return; // nenhuma permissão mudou

  const dados = (existeDepois ? depoisDoc.data() : antesDoc.data()) || {};
  const autorId = texto(dados.atualizadoPor, 128) || null;
  const autor = await autorDe(autorId);
  const nome = texto(dados.nome, 100);
  const email = texto(dados.email, MAX_EMAIL);

  // Resumo legível; o diff completo fica em antes/depois.
  let detalhe;
  if (!antes) detalhe = 'Usuário criado · ' + (depois.role || '—') + ' · ' + lista(depois.contabilidades);
  else if (!depois) detalhe = 'Acesso do usuário removido · ' + (antes.role || '—') + ' · ' + lista(antes.contabilidades);
  else {
    const mudou = [];
    if (antes.role !== depois.role) mudou.push('perfil ' + (antes.role || '—') + ' → ' + (depois.role || '—'));
    if (antes.ativo !== depois.ativo) mudou.push('situação ' + (antes.ativo ? 'ativo' : 'bloqueado') + ' → ' + (depois.ativo ? 'ativo' : 'bloqueado'));
    if (lista(antes.contabilidades) !== lista(depois.contabilidades))
      mudou.push('contabilidades ' + lista(antes.contabilidades) + ' → ' + lista(depois.contabilidades));
    detalhe = mudou.join(' · ');
  }

  await db.collection('auditoria').add({
    ts: FieldValue.serverTimestamp(),
    userId: autorId,
    user: (autor && texto(autor.nome, 100)) || 'Servidor',
    userEmail: (autor && texto(autor.email, MAX_EMAIL)) || '',
    role: (autor && texto(autor.role, 20)) || '',
    acao: 'Permissão alterada',
    recId: null,
    recTitulo: nome + (email ? ' (' + email + ')' : ''),
    detalhe: detalhe.slice(0, 500),
    escopo: 'sistema',
    contabId: null,
    alvoId: event.params.uid,
    antes,
    depois,
    origem: 'servidor'
  });
});
