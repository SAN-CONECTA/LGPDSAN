// Central de Atualizações ANPD (v2.29.0)
// Helpers puros para exibir, filtrar e ordenar as publicações oficiais da ANPD
// sincronizadas pelo script scripts/anpd_sync.py (coleção `anpd` no Firestore).
// Nada aqui toca no Firebase: o acesso a dados fica em app.js.

export const ANPD_FONTE = 'ANPD';
export const ANPD_URL = 'https://www.gov.br/anpd/pt-br/assuntos/noticias';

// Data de publicação (YYYY-MM-DD) gravada pela sincronização.
export const anpdData = p => (p && p.data) || '';

// Texto usado na pesquisa: título, descrição e fonte.
export const anpdResumo = p => [p.titulo, p.descricao, p.fonte].filter(Boolean).join(' ').toLowerCase();

// Mais recentes primeiro; empate pelo título.
export const anpdOrdena = lista => (lista || []).slice().sort((a, b) =>
  (anpdData(b).localeCompare(anpdData(a))) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));

// Filtra por palavra-chave (busca em título + descrição + fonte).
export const anpdFiltra = (lista, q) => {
  const t = String(q || '').toLowerCase().trim();
  return t ? (lista || []).filter(p => anpdResumo(p).includes(t)) : (lista || []).slice();
};

// Conjunto de ids das publicações já lidas, a partir dos documentos de leitura
// (coleção users/{uid}/anpdLidas, onde o id do documento é o id da publicação).
export const anpdLidasSet = docs => new Set((docs || []).map(d => d.id));
