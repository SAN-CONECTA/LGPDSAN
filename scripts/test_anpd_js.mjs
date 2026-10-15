// Testes dos helpers puros de assets/anpd.js.
// Rode com: node scripts/test_anpd_js.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../assets/anpd.js', import.meta.url), 'utf8');
// anpd.js é um módulo ES; aqui carregamos as funções num escopo simples.
const factory = new Function(
  src.replace(/\bexport\s+/g, '') +
    '\n; return { ANPD_FONTE, ANPD_URL, anpdData, anpdResumo, anpdOrdena, anpdFiltra, anpdLidasSet };'
);
const m = factory();

const pubs = [
  { id: 'a', titulo: 'Alfa', descricao: 'Consulta pública', fonte: 'ANPD', data: '2026-06-01' },
  { id: 'b', titulo: 'Beta', descricao: 'Incidente de segurança', fonte: 'ANPD', data: '2026-07-10' },
  { id: 'c', titulo: 'Gama', descricao: 'Regulamento', fonte: 'ANPD', data: '2026-05-20' },
];

// ordenação: mais recente primeiro
const ord = m.anpdOrdena(pubs);
assert.equal(ord[0].id, 'b');
assert.equal(ord[2].id, 'c');

// filtro por palavra-chave (título + descrição + fonte)
assert.equal(m.anpdFiltra(pubs, 'consulta')[0].id, 'a');
assert.equal(m.anpdFiltra(pubs, 'incidente')[0].id, 'b');
assert.equal(m.anpdFiltra(pubs, 'ANPD').length, 3);
assert.equal(m.anpdFiltra(pubs, '   ').length, 3); // vazio não filtra
assert.equal(m.anpdFiltra(pubs, 'inexistente').length, 0);

// resumo cobre título + descrição + fonte
assert.ok(m.anpdResumo(pubs[0]).includes('consulta pública'));

// conjunto de lidas a partir dos docs
const lidas = m.anpdLidasSet([{ id: 'a' }, { id: 'b' }]);
assert.ok(lidas.has('a') && lidas.has('b') && !lidas.has('c'));

// data
assert.equal(m.anpdData(pubs[1]), '2026-07-10');
assert.equal(m.anpdData({}), '');

console.log('OK — test_anpd_js.mjs: todos os asserts passaram.');
