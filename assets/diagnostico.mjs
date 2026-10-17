const PORTE_OK = ['Microempresa (ME)', 'Empresa de pequeno porte (EPP)', 'MEI'];

export function resultadoEnq(d = {}) {
  const porte = (d.dgLimite === 'Não' || d.dgGrupo === 'Sim' || d.dgPorte === 'Demais') ? 'fora'
    : (PORTE_OK.includes(d.dgPorte) && d.dgLimite === 'Sim' && d.dgGrupo === 'Não') ? 'ok' : 'indef';
  const geral = d.dgTitulares === 'Acima de 5.000' ? 'sim' : d.dgTitulares === 'De 500 a 5.000' ? 'talvez' : d.dgTitulares === 'Até 500' ? 'nao' : 'indef';
  const esp = ['dgSaude', 'dgSind', 'dgBio', 'dgIA', 'dgMonit', 'dgDecis'].map(k => d[k]);
  const especifico = esp.some(v => v === 'Sim') ? 'sim' : esp.some(v => !v || v === 'Não sei') ? 'indef' : 'nao';
  const risco = geral === 'sim' && especifico === 'sim' ? 'alto' : geral === 'talvez' && especifico === 'sim' ? 'cinza'
    : (geral === 'nao' || especifico === 'nao') ? 'baixo' : 'indef';
  let nivel, titulo;
  if (risco === 'alto') { nivel = 'alto'; titulo = 'Indício de alto risco: a dispensa não vale. Nomear encarregado tende a ser obrigatório.'; }
  else if (risco === 'cinza') { nivel = 'cinza'; titulo = 'Zona cinza: dado sensível com volume intermediário. Nomear é a opção mais segura; decidir com apoio jurídico.'; }
  else if (risco === 'baixo' && porte === 'ok') { nivel = 'dispensa'; titulo = 'Dispensa possível: pequeno porte e sem indício de alto risco. Recomenda-se designar um responsável pelo canal de atendimento.'; }
  else if (risco === 'baixo' && porte === 'fora') { nivel = 'nomear'; titulo = 'Fora do regime de pequeno porte: a dispensa não vale. Nomear encarregado.'; }
  else { nivel = 'incompleto'; titulo = 'Diagnóstico incompleto: responda os itens em branco ou com "Não sei".'; }
  const linhas = [
    'Porte: ' + (porte === 'ok' ? 'pequeno porte confirmado (porte, limite de receita e grupo econômico).' : porte === 'fora' ? 'fora do regime de pequeno porte.' : 'não confirmado.'),
    'Volume (larga escala): ' + (geral === 'sim' ? 'alto.' : geral === 'talvez' ? 'intermediário.' : geral === 'nao' ? 'baixo.' : 'não informado.'),
    'Critério específico (dado sensível, tecnologia nova, vigilância, decisão automatizada): ' + (especifico === 'sim' ? 'presente.' : especifico === 'nao' ? 'ausente.' : 'não confirmado.')
  ];
  if (d.dgExigiu === 'Sim') linhas.push('Cliente já exigiu encarregado em contrato: pode valer mesmo com a dispensa legal.');
  return { nivel, titulo, linhas, aviso: 'Sugestão calculada das respostas, com faixas internas (não são da lei). Se o escritório é operador dos dados dos clientes, a obrigação do art. 41 é do controlador: validar com advogado.' };
}
