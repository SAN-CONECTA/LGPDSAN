// Guia "Direitos dos Titulares" — fonte: "Direitos dos Titulares — Guia Completo para Plataforma LGPD" (06/10/2026).
// O arquivo recebido termina no início da seção 2.1 (só a introdução e o direito de confirmação começam). Quase todos os
// itens abaixo são extra:true: foram montados pela equipe técnica a partir do art. 18 da LGPD e precisam de validação jurídica.

const D = (id, label, ajuda, extra = true) => ({ id, tipo: 'sn', label, ajuda, extra });

export const GUIA_DIREITOS = {
  titulo: 'Direitos dos Titulares',
  tituloHint: 'Ex.: Procedimento de atendimento aos titulares (2026)',
  resumo: 'Checklist de preparo do escritório para atender pedidos de titulares (clientes, colaboradores e terceiros). Um registro por contabilidade. Para acompanhar um pedido específico, crie outro registro e descreva o caso.',
  secoes: [
    { id: 'd1', titulo: '1. Estrutura de atendimento', itens: [
      { id: 'canal', tipo: 'texto', label: 'Canal oficial para pedidos (e-mail, formulário, telefone)', extra: true },
      { id: 'respAt', tipo: 'texto', label: 'Responsável pelo atendimento (encarregado ou equivalente)', extra: true },
      { id: 'prazoInt', tipo: 'texto', label: 'Prazo interno de resposta adotado', ajuda: 'O art. 19 da LGPD fixa: resposta imediata em formato simplificado, ou declaração completa em até 15 dias. O guia de Governança recebido cita 20 dias, que não confere com a lei.', extra: true },
      D('c_canalPub', 'O canal é divulgado de forma clara aos titulares (contrato, site, aviso de privacidade)?', 'Transparência, art. 9º.'),
      { id: 'c_escopo', tipo: 'sn', label: 'O procedimento vale para clientes, colaboradores e terceiros (fornecedores, sócios, beneficiários)?' },
      D('c_ident', 'Existe verificação de identidade do solicitante antes de entregar dados?', 'Evita entregar dados a quem não é o titular.'),
      { id: 'c_registro', tipo: 'sn', label: 'Cada pedido e a resposta são registrados e documentados (data, solicitante, direito, decisão, prazo)?' },
      D('c_treino', 'Quem recebe pedidos sabe reconhecê-los e encaminhá-los (treinamento)?')
    ] },
    { id: 'd2', titulo: '2. Direitos do art. 18 da LGPD', itens: [
      { id: 'c_confirma', tipo: 'sn', label: 'Confirmação da existência de tratamento (art. 18, I): há procedimento? O pedido pode ser genérico, sem o titular especificar os dados.' },
      D('c_acesso', 'Acesso aos dados (art. 18, II): há procedimento e formato de entrega?', 'Art. 19: formato simplificado imediato ou declaração completa em 15 dias.'),
      D('c_correcao', 'Correção de dados incompletos, inexatos ou desatualizados (art. 18, III)?'),
      D('c_anon', 'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade (art. 18, IV)?', 'O guia fala em "limitação do tratamento"; o termo da lei é bloqueio.'),
      D('c_port', 'Portabilidade a outro fornecedor, conforme regulamentação da ANPD (art. 18, V)?', 'O guia recebido atribui a portabilidade ao art. 20; o correto é o art. 18, V. O art. 20 trata da revisão de decisões automatizadas.'),
      D('c_elim', 'Eliminação dos dados tratados com consentimento (art. 18, VI), respeitadas as hipóteses de conservação do art. 16 (ex.: obrigação legal)?', 'Dados fiscais e trabalhistas com retenção legal não podem ser eliminados a pedido.'),
      D('c_compart', 'Informação sobre entidades com as quais os dados foram compartilhados (art. 18, VII)?'),
      D('c_naoConsent', 'Informação sobre a possibilidade de não consentir e suas consequências (art. 18, VIII)?'),
      D('c_revoga', 'Revogação do consentimento (art. 18, IX): é tão fácil quanto concedê-lo?'),
      D('c_oposicao', 'Oposição a tratamento feito sem consentimento, quando houver descumprimento da lei (art. 18, § 2º)?')
    ] },
    { id: 'd3', titulo: '3. Prazos, comunicação e decisões automatizadas', itens: [
      D('c_prazo19', 'O procedimento respeita os prazos do art. 19 (imediato em formato simplificado, ou 15 dias com declaração completa)?'),
      D('c_neg', 'Quando o pedido é negado, a resposta explica o motivo (ex.: obrigação legal de guarda)?'),
      D('c_agentes', 'Correções, eliminações e bloqueios são comunicados aos agentes com quem os dados foram compartilhados (art. 18, § 6º)?'),
      D('c_gratis', 'O atendimento é gratuito, nos termos da lei (art. 18, § 5º)?'),
      D('c_auto', 'Se houver decisões automatizadas sobre o titular, ele pode solicitar revisão e informações sobre os critérios (art. 20)?', 'Marque N/A se o escritório não toma decisões automatizadas.'),
      D('c_anpd', 'O titular é informado de que pode peticionar à ANPD (art. 18, § 1º)?')
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_registro !== 'Conforme' && d.c_registro) a.push('Pedidos de titulares sem registro documentado.');
    if (d.c_prazo19 === 'Não conforme') a.push('Procedimento não respeita os prazos do art. 19.');
    if (d.c_ident === 'Não conforme') a.push('Sem verificação de identidade antes de entregar dados.');
    if (d.c_canalPub === 'Não conforme') a.push('Canal de atendimento não divulgado aos titulares.');
    if (d.c_elim === 'Não conforme') a.push('Sem procedimento de eliminação (com as exceções de guarda legal).');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Mostra se o escritório está preparado para responder pedidos de titulares dentro do prazo e com registro. Os itens com a etiqueta <b>extra</b> foram acrescentados pela equipe técnica a partir da lei, pois o documento recebido está incompleto.</p>
    <h3>Os direitos do art. 18 (incisos I a IX)</h3>
    <ul><li>I confirmação do tratamento; II acesso; III correção;</li>
    <li>IV anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou ilegais;</li>
    <li>V portabilidade; VI eliminação de dados tratados com consentimento;</li>
    <li>VII informação sobre compartilhamento; VIII informação sobre a possibilidade de não consentir;</li>
    <li>IX revogação do consentimento.</li></ul>
    <p>Além disso: oposição (art. 18, § 2º) e revisão de decisões automatizadas (art. 20).</p>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>Artigo 20 como portabilidade</b>: a portabilidade está no art. 18, V. O art. 20 trata de decisões automatizadas.</li>
      <li><b>"Limitação do tratamento"</b> e <b>"oposição"</b> listados como direitos do art. 18: a lei usa "bloqueio" (inciso IV) e a oposição está no § 2º.</li>
      <li><b>"Nove direitos"</b>: o art. 18 tem nove incisos, mas a lista do trecho recebido (confirmação, acesso, retificação, eliminação, portabilidade, limitação, oposição, informação sobre compartilhamento) não coincide com eles: não menciona a informação sobre a possibilidade de não consentir nem a revogação do consentimento.</li>
      <li><b>Prazo</b>: o guia de Governança recebido fala em 20 dias; o art. 19 prevê 15 dias para declaração completa.</li>
      <li><b>"Direitos irrenunciáveis independentemente de consentimento ou contrato"</b>: correto no sentido de que não podem ser afastados, mas há exceções de guarda legal (art. 16) que limitam a eliminação.</li>
      <li><b>Texto incompleto</b>: o arquivo termina no início da seção 2.1. Procedimentos de cada direito, modelos de resposta e fluxos não vieram.</li>
    </ul>`
};
