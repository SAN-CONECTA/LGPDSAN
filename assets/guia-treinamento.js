// Guia "Treinamento e Cultura" — fonte: "Treinamento e Cultura — LGPD para Escritório de Contabilidade" (07/10/2026).
// O arquivo recebido vai até a seção 2.4 (tabela de responsabilidades, cortada). Itens extra:true foram acrescentados pela equipe técnica.

const G = (id, label, ajuda, extra = false) => ({ id, tipo: 'sn', label, ajuda, extra });

export const GUIA_TREINAMENTO = {
  titulo: 'Treinamento e Cultura',
  tituloHint: 'Ex.: Programa de treinamento LGPD 2026',
  resumo: 'Verifica se a equipe é treinada de forma contínua e documentada e se existe cultura de proteção de dados (políticas internas, canal de reporte sem punição, campanhas). Um registro por contabilidade; atualize a cada ciclo de treinamento.',
  secoes: [
    { id: 't1', titulo: '1. Programa e conteúdo', itens: [
      { id: 'respTrein', tipo: 'texto', label: 'Responsável pelo programa de treinamento' },
      { id: 'ultTrein', tipo: 'texto', label: 'Data do último treinamento realizado' },
      { id: 'pctTrein', tipo: 'texto', label: 'Colaboradores treinados no ciclo atual (ex.: 12 de 15)', extra: true },
      G('c_prog', 'Existe programa de treinamento em LGPD escrito, com objetivos e conteúdo definidos?'),
      G('c_geral', 'O módulo geral (princípios, conceitos, direitos dos titulares, obrigações do escritório, contexto contábil, políticas internas, casos de violação, responsabilidades pessoais) é aplicado a todos?', 'A lista de direitos do documento (acesso, correção, eliminação, portabilidade, revogação) é parcial; o art. 18 prevê mais (confirmação, informação sobre compartilhamento, entre outros).'),
      G('c_gestores', 'Há módulo para gestores e coordenadores (governança, bases legais, avaliação de risco, incidentes, auditorias, contratos com terceiros)?'),
      G('c_operac', 'Há módulo para a equipe operacional (coleta segura, armazenamento e compartilhamento, pedidos de titulares, identificação de incidentes, descarte)?'),
      G('c_ti', 'Há módulo para TI e segurança (criptografia, backup, logs, resposta técnica a incidentes, avaliação de terceiros, testes de segurança)?'),
      G('c_direcao', 'Sócios e direção recebem formação sobre governança e responsabilidades legais?'),
      G('c_encarr', 'O encarregado recebe formação avançada e participa de fóruns ou atualizações sobre LGPD?', 'O documento usa "DPO (Data Protection Officer)"; o termo da LGPD é encarregado.')
    ] },
    { id: 't2', titulo: '2. Frequência e momentos', itens: [
      G('c_inicial', 'Todo colaborador novo é treinado antes de receber acesso a dados pessoais?', 'Referência do documento: 4 horas, antes do início das atividades.'),
      G('c_anual', 'Todos fazem reciclagem anual?', 'Referência do documento: 2 horas por ano.'),
      G('c_emerg', 'Há treinamento emergencial quando a legislação muda ou após um incidente?', 'Referência: 1 a 2 horas.'),
      G('c_espec', 'Gestores, TI e equipe operacional fazem especialização anual por perfil?', 'Referência: 4 a 8 horas.'),
      G('c_cert', 'Há certificação em LGPD para encarregado e gestores (opcional, a cada 2 anos)?', 'Referência: 40 a 80 horas. A LGPD não exige certificação nem fixa carga horária ou periodicidade de treinamento; são critérios internos do guia.')
    ] },
    { id: 't3', titulo: '3. Metodologia e evidências', itens: [
      G('c_metodo', 'O treinamento combina formatos (e-learning, workshops, microlearning, simulações, leitura de políticas)?'),
      G('c_aval', 'Há avaliação periódica de aprendizado (testes, questionários, auditorias internas)?'),
      G('c_evid', 'A participação é documentada (lista de presença, certificado, nota) e arquivada para auditoria?', 'Evidências de treinamento ajudam a demonstrar boas práticas de governança (art. 50 da LGPD).'),
      G('c_phish', 'São feitas simulações de phishing ou de incidente, com resultado analisado?', '', true),
      G('c_metric', 'Há métricas acompanhadas pela direção (taxa de conclusão, notas, incidentes por erro humano)?', 'O documento prevê revisão trimestral de métricas pelos sócios.', true)
    ] },
    { id: 't4', titulo: '4. Políticas internas publicadas', itens: [
      G('c_pPriv', 'Política de Privacidade Interna (direitos dos titulares, obrigações, contatos)?'),
      G('c_pCond', 'Código de Conduta em proteção de dados (comportamentos esperados, proibições, sanções)?'),
      G('c_pAcesso', 'Política de Acesso a Dados (quem acessa o quê, justificativa, revisão)?'),
      G('c_pCompart', 'Procedimento de compartilhamento com terceiros?'),
      G('c_pIncid', 'Procedimento de incidentes (ver "Incidentes")?'),
      G('c_pRet', 'Política de Retenção e Descarte (ver "Retenção e Descarte")?'),
      G('c_pSeg', 'Diretrizes de segurança (senhas, VPN, dispositivos móveis, mesa limpa)?'),
      G('c_pSac', 'Guia de resposta a pedidos de titulares (ver "Direitos dos Titulares")?'),
      G('c_pCiente', 'Os colaboradores confirmam por escrito que leram e entenderam as políticas?', '', true)
    ] },
    { id: 't5', titulo: '5. Cultura e engajamento', itens: [
      G('c_canalSem', 'Colaboradores podem reportar incidentes ou dúvidas sem medo de punição?'),
      G('c_lider', 'Sócios e gestores dão o exemplo e participam dos treinamentos?'),
      G('c_comun', 'Há comunicação regular (newsletter, cartazes, lembretes por email)?'),
      G('c_camp', 'Há campanhas temáticas (senhas, dados em arquivos, phishing) e um evento anual de conscientização?', 'O documento indica agosto como "mês nacional de conscientização", sem citar fonte. O Dia Internacional da Proteção de Dados é 28 de janeiro. Escolha a data que fizer sentido para o escritório.'),
      G('c_emb', 'Existem embaixadores de proteção de dados por departamento?'),
      G('c_recon', 'Quem reporta incidentes ou sugere melhorias é reconhecido formalmente?'),
      G('c_intra', 'Há espaço interno (intranet ou pasta compartilhada) com políticas, FAQ e contato do encarregado?'),
      G('c_resp', 'As responsabilidades por nível (sócios, encarregado, gestores, colaboradores) estão definidas?', 'A tabela de responsabilidades do documento foi cortada na linha dos colaboradores operacionais.')
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_prog === 'Não conforme') a.push('Sem programa de treinamento em LGPD.');
    if (d.c_inicial === 'Não conforme') a.push('Colaboradores novos recebem acesso a dados sem treinamento prévio.');
    if (d.c_anual === 'Não conforme') a.push('Sem reciclagem anual da equipe.');
    if (d.c_evid === 'Não conforme') a.push('Treinamentos sem evidência documentada.');
    if (d.c_canalSem === 'Não conforme') a.push('Equipe teme punição ao reportar incidentes: risco de ocultação.');
    if (d.c_pCiente === 'Não conforme') a.push('Sem ciência formal dos colaboradores sobre as políticas.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Verifica se a equipe sabe o que fazer com dados pessoais, se isso é registrado e se o escritório cultiva a proteção de dados no dia a dia. A maior parte dos incidentes vem de erro humano.</p>
    <h3>O que a LGPD diz</h3>
    <p>A lei não impõe carga horária, periodicidade nem certificação de treinamento. O art. 50 incentiva programa de governança em privacidade, e o treinamento com registro é uma das formas de demonstrar essas boas práticas.</p>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>Cargas horárias e frequências (4 h inicial, 2 h anual, 40 a 80 h de certificação)</b>: são critérios internos do guia, sem exigência legal. Ajustáveis.</li>
      <li><b>"DPO (Data Protection Officer)"</b>: o termo da LGPD é encarregado (art. 41).</li>
      <li><b>Lista de direitos do titular</b>: incompleta (art. 18 tem mais direitos, como confirmação e informação sobre compartilhamento).</li>
      <li><b>"Agosto, mês nacional de conscientização"</b>: sem fonte. A data internacional é 28 de janeiro.</li>
      <li><b>"SACs (Solicitações de Acesso de Titulares)"</b>: SAC costuma significar serviço de atendimento ao consumidor; usar um termo que não confunda.</li>
      <li><b>Texto incompleto</b>: o arquivo termina na seção 2.4 (tabela de responsabilidades cortada).</li>
    </ul>`
};
