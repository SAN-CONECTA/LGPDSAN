import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultadoEnq } from '../assets/diagnostico.mjs';

test('diagnóstico guiado identifica pequeno porte sem indício de alto risco', () => {
  const r = resultadoEnq({
    dgPorte: 'Microempresa (ME)', dgLimite: 'Sim', dgGrupo: 'Não',
    dgTitulares: 'Até 500', dgSaude: 'Não', dgSind: 'Não', dgBio: 'Não',
    dgIA: 'Não', dgMonit: 'Não', dgDecis: 'Não'
  });
  assert.equal(r.nivel, 'dispensa');
  assert.match(r.titulo, /Dispensa possível/);
});

test('diagnóstico guiado sinaliza alto risco quando volume e critério específico são altos', () => {
  const r = resultadoEnq({
    dgPorte: 'Empresa de pequeno porte', dgLimite: 'Sim', dgGrupo: 'Não',
    dgTitulares: 'Acima de 5.000', dgSaude: 'Sim', dgSind: 'Não', dgBio: 'Não',
    dgIA: 'Não', dgMonit: 'Não', dgDecis: 'Não', dgExigiu: 'Sim'
  });
  assert.equal(r.nivel, 'alto');
  assert.equal(r.linhas.length, 4);
  assert.match(r.linhas.at(-1), /exigiu encarregado/);
});

test('diagnóstico incompleto não produz dispensa por omissão', () => {
  const r = resultadoEnq({});
  assert.equal(r.nivel, 'incompleto');
  assert.match(r.titulo, /incompleto/i);
});
