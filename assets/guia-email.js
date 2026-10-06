// Guia "Tratamento de Email" — fonte: "Política de Tratamento de Email da Contabilidade — Abordagem LGPD" (06/10/2026).
// Itens com extra:true foram acrescentados pela equipe técnica (não estão no texto recebido) e precisam de validação jurídica.
// O texto recebido termina na seção 3.5; as demais seções do sumário (responsabilidades, direitos, incidentes) não vieram.

const RET = (nome, ref) => ({ tipo: 'sn', label: `Retenção definida e fundamento documentado: ${nome}`, ajuda: ref });

export const GUIA_EMAIL = {
  titulo: 'Tratamento de Email',
  tituloHint: 'Política de Tratamento de Email',
  resumo: 'Checklist da política de email do escritório. Normalmente um registro por contabilidade. Responda com base no que está implantado hoje, não no que está planejado.',
  secoes: [
    { id: 'e1', titulo: '1. Política, escopo e responsáveis', itens: [
      { id: 'provedor', tipo: 'texto', label: 'Provedor / sistema de email (ex.: Microsoft 365, Google Workspace, servidor próprio)', ajuda: 'Se for terceiro, ele é um operador: cadastre-o também em "Contratos e Operadores".' },
      { id: 'respPol', tipo: 'texto', label: 'Responsável pela política' },
      { id: 'vigencia', tipo: 'texto', label: 'Data de vigência da política atual' },
      { id: 'c_politica', tipo: 'sn', label: 'Existe política escrita de tratamento de email, aprovada e em vigor?' },
      { id: 'c_escopo', tipo: 'sn', label: 'A política se aplica a colaboradores, operadores terceirizados e sistemas que processam emails com dados pessoais?' }
    ] },
    { id: 'e2', titulo: '2. Classificação e retenção por tipo de email', itens: [
      RET('recibos e notas fiscais (risco alto)', 'Referência do guia: 5 anos. O fundamento citado (LC 128/2008) não sustenta o prazo; a base usual é o Código Tributário Nacional. Validar com assessoria jurídica.'),
      RET('comunicações com cliente / orientações fiscais (risco médio)', 'Referência do guia: 2 anos ou conforme o contrato. Base provável: execução de contrato (art. 7º, V da LGPD), não "Art. 7º" genérico.'),
      RET('comunicação interna, RH e administração (risco alto)', 'Referência do guia: 2 anos. O "CLT Art. 844" citado trata de ausência em audiência, não de retenção. Validar prazos trabalhistas e previdenciários.'),
      RET('backups e arquivos consolidados (risco crítico)', 'Referência do guia: conforme LGPD + legislação fiscal (5 anos). "LGPD Art. 14" (crianças) e Lei de Acesso à Informação (órgãos públicos) não se aplicam aqui.'),
      RET('emails de terceiros: bancos, fisco, órgãos públicos (risco alto)', 'Referência do guia: 5 anos. O sigilo bancário é regido pela LC 105/2001; a Lei 4.595/1964 é a do sistema financeiro. Validar.'),
      RET('comunicação com fornecedores (risco médio)', 'Referência do guia: 2 a 3 anos. A base de "interesse legítimo" é o art. 7º, IX (o guia cita o inciso IV, que trata de pesquisa).'),
      RET('comunicação com órgãos reguladores (risco alto)', 'Referência do guia: conforme a exigência do órgão, geralmente 5 anos.'),
      { id: 'c_elimina', tipo: 'sn', label: 'Dados pessoais de emails são eliminados quando deixam de ser necessários, documentando o fundamento de cada retenção (arts. 15 e 16 da LGPD)?' }
    ] },
    { id: 'e3', titulo: '3. Necessidade e propósito legítimo', itens: [
      { id: 'c_uso', tipo: 'sn', label: 'É proibido usar o email corporativo para assuntos pessoais sem relação com o trabalho?' },
      { id: 'c_manual', tipo: 'sn', label: 'O propósito legítimo do email está descrito no manual do colaborador?' },
      { id: 'c_rev', tipo: 'sn', label: 'As pastas de email são revisadas trimestralmente para remover mensagens fora do escopo?' },
      { id: 'c_filtros', tipo: 'sn', label: 'Há filtros automáticos para detectar e alertar sobre possíveis violações?' },
      { id: 'c_monit', tipo: 'sn', extra: true, label: 'Os colaboradores foram informados de que o email corporativo pode ser revisado/monitorado e em que condições?', ajuda: 'Item acrescentado: revisar caixas de email envolve dados dos próprios colaboradores. Validar com assessoria jurídica.' }
    ] },
    { id: 'e4', titulo: '4. Base legal e consentimento', itens: [
      { id: 'c_base', tipo: 'sn', label: 'A base legal está documentada para cada tipo de email armazenado?', ajuda: 'Bases usuais num escritório: execução de contrato (art. 7º, V), obrigação legal (II), legítimo interesse (IX) e, quando cabível, consentimento (I).' },
      { id: 'c_contrato', tipo: 'sn', label: 'O contrato de prestação de serviços contém cláusula sobre o tratamento de dados e comunicações por email?' },
      { id: 'c_consent', tipo: 'sn', label: 'Quando o consentimento é a base, existe registro (data, forma, termo)?', ajuda: 'O guia manda colher consentimento de todo cliente novo. Atenção: o consentimento deve ser livre e revogável, e não é a base adequada para o que o contrato ou a lei já exigem. Avaliar caso a caso.' },
      { id: 'c_obrig', tipo: 'sn', label: 'Para emails do fisco, Receita e auditorias (obrigação legal), a obrigação está documentada e o titular é informado?' },
      { id: 'c_rev_termos', tipo: 'sn', label: 'Os termos e cláusulas são revisados e atualizados anualmente?' }
    ] },
    { id: 'e5', titulo: '5. Transparência (art. 9º da LGPD)', itens: [
      { id: 'c_aviso', tipo: 'sn', label: 'Existe Aviso de Privacidade claro e acessível (no contrato ou enviado por email)?' },
      { id: 'c_info', tipo: 'sn', label: 'O aviso informa finalidades, forma e duração do armazenamento, direitos do titular, compartilhamento com terceiros e contato do responsável?' },
      { id: 'c_polpriv', tipo: 'sn', label: 'A Política de Privacidade está atualizada e disponível (site/documentos)?' },
      { id: 'c_canal', tipo: 'sn', label: 'Há canal de contato para dúvidas e exercício de direitos (encarregado ou equivalente)?', ajuda: 'O guia usa "Data Protection Officer"; o termo da LGPD é "encarregado" (art. 41).' },
      { id: 'c_confirma', tipo: 'sn', label: 'O recebimento do Aviso é confirmado junto ao cliente?' }
    ] },
    { id: 'e6', titulo: '6. Segurança e criptografia', itens: [
      { id: 'c_tls', tipo: 'sn', label: 'Criptografia em trânsito: TLS 1.2 ou superior (recomendado 1.3) em SMTP, IMAP e POP3?', ajuda: 'O guia trata as medidas desta seção como "obrigatórias conforme LGPD". A lei exige medidas técnicas adequadas (arts. 46 e 47) sem fixar protocolos; estas são boas práticas recomendadas.' },
      { id: 'c_aes', tipo: 'sn', label: 'Criptografia em repouso (ex.: AES-256) para emails armazenados em servidor ou nuvem?' },
      { id: 'c_spf', tipo: 'sn', label: 'SPF, DKIM e DMARC configurados contra falsificação (spoofing)?' },
      { id: 'c_bkpc', tipo: 'sn', label: 'Backups de email criptografados e em local geograficamente seguro?' },
      { id: 'c_mfa', tipo: 'sn', label: 'Acesso restrito a autorizados, com login e autenticação de dois fatores (MFA)?' },
      { id: 'c_timeout', tipo: 'sn', label: 'Logout automático após 15 minutos de inatividade?' },
      { id: 'c_auditsrv', tipo: 'sn', label: 'As configurações do servidor de email (próprio ou do fornecedor) foram auditadas, incluindo TLS?' },
      { id: 'c_plano', tipo: 'sn', label: 'As configurações de segurança estão documentadas em plano de ação?' },
      { id: 'c_pentest', tipo: 'sn', label: 'Testes de intrusão são realizados anualmente?' }
    ] },
    { id: 'e7', titulo: '7. Exclusão, direitos e incidentes', itens: [
      { id: 'c_exclusao', tipo: 'sn', extra: true, label: 'Existe procedimento de exclusão efetiva de emails (lixeira, arquivo e backups), e não apenas mover mensagens de pasta?', ajuda: 'Item inferido: o texto recebido termina em "simplesmente mover emails para…". Validar com o texto completo.' },
      { id: 'c_titulares', tipo: 'sn', extra: true, label: 'Há procedimento para atender pedidos de titulares (acesso, correção, eliminação, art. 18) que envolvam emails?', ajuda: 'O guia cita o art. 17 e "direito ao esquecimento"; os direitos do titular estão no art. 18 (eliminação: inciso VI).' },
      { id: 'c_incid', tipo: 'sn', extra: true, label: 'Há procedimento de incidente de segurança com comunicação à ANPD e aos titulares em até 3 dias úteis?', ajuda: 'Resolução CD/ANPD 15/2024: 3 dias úteis (6 para agentes de pequeno porte). O sumário do guia prevê o tema, mas o texto não veio.' }
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_politica !== 'Conforme') a.push('Sem política escrita de tratamento de email em vigor.');
    if (d.c_tls === 'Não conforme') a.push('Sem criptografia em trânsito (TLS) nos emails.');
    if (d.c_mfa === 'Não conforme') a.push('Acesso ao email sem autenticação de dois fatores.');
    if (d.c_spf === 'Não conforme') a.push('SPF, DKIM e DMARC ausentes: risco de falsificação de emails do escritório.');
    if (d.c_aviso === 'Não conforme') a.push('Sem Aviso de Privacidade para os clientes.');
    if (d.c_base === 'Não conforme') a.push('Base legal não documentada para os emails armazenados.');
    if (d.c_elimina === 'Não conforme') a.push('Sem eliminação de dados pessoais de emails quando deixam de ser necessários.');
    if (d.c_incid === 'Não conforme') a.push('Sem procedimento de resposta a incidente com prazo de comunicação à ANPD.');
    return a;
  },
  referencia: `
    <h3>Para que serve este checklist</h3>
    <p>Mostra se o escritório trata os emails com dados pessoais de clientes, funcionários e terceiros de forma documentada, segura e com prazos de retenção definidos. Itens com a etiqueta <b>extra</b> foram acrescentados pela equipe técnica.</p>
    <h3>Bases legais (art. 7º da LGPD) mais comuns em email contábil</h3>
    <ul><li><b>Execução de contrato</b> (inciso V): comunicação com o cliente para prestar o serviço contratado.</li>
    <li><b>Obrigação legal ou regulatória</b> (inciso II): emails do fisco, Receita, auditorias.</li>
    <li><b>Legítimo interesse</b> (inciso IX): fornecedores e operação interna, com avaliação de balanceamento.</li>
    <li><b>Consentimento</b> (inciso I): quando nenhuma outra base cabe; deve ser livre, informado e revogável.</li></ul>
    <h3>Notas de revisão do documento original</h3>
    <p>Pontos do texto recebido que divergem da lei e que <b>não foram copiados</b>:</p>
    <ul>
      <li><b>Consentimento como regra para todo cliente novo</b>: para o que o contrato e a lei já exigem, a base é execução de contrato ou obrigação legal. O consentimento é revogável e seria frágil como base única.</li>
      <li><b>"Interesse legítimo (Art. 7º, IV)"</b>: o inciso correto é o IX. O inciso IV trata de estudos por órgão de pesquisa.</li>
      <li><b>"LGPD Art. 17" como direito à exclusão</b>: os direitos estão no art. 18 (eliminação, inciso VI). "Direito ao esquecimento" não é o termo da lei.</li>
      <li><b>"LGPD Art. 32 e Art. 46" para segurança</b>: o art. 32 trata de órgãos públicos. A segurança está nos arts. 46 e 47. A lei não fixa TLS, AES-256 ou MFA; são boas práticas.</li>
      <li><b>Fundamentos de retenção</b>: "LC 128/08", "CLT Art. 844", "LGPD Art. 14", "Lei 12.527/11 (Lei de Acesso à Informação)" e "Lei 4.595/64 (sigilo bancário)" não sustentam os prazos indicados. A base fiscal usual é o Código Tributário Nacional; o sigilo bancário é a LC 105/2001. Os prazos ficaram como referência do guia, para validação jurídica.</li>
      <li><b>"Data Protection Officer"</b>: o termo da LGPD é "encarregado" (art. 41).</li>
      <li><b>Texto incompleto</b>: o documento termina na seção 3.5, no meio de uma frase. Responsabilidades de operadores, direitos dos titulares e procedimentos de incidente aparecem no sumário, mas não vieram.</li>
    </ul>`
};
