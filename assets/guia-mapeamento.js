// Guia "Mapeamento de Dados" — fonte: "Mapeamento de Dados — LGPD para Escritório de Contabilidade" v1.0 (07/10/2026).
// O arquivo recebido traz o inventário (seção 2) e o início do fluxo de dados (3.1, etapa 2). As seções 3.2 a 9
// (inclusive o "Checklist de Conformidade" do próprio documento) não vieram. Itens extra:true foram acrescentados pela equipe técnica.

const G = (id, label, ajuda, extra = false) => ({ id, tipo: 'sn', label, ajuda, extra });

export const GUIA_MAPEAMENTO = {
  titulo: 'Mapeamento de Dados',
  tituloHint: 'Ex.: Mapeamento de dados 2026 (um registro por contabilidade)',
  resumo: 'Verifica se o escritório sabe quais dados pessoais trata, de onde vêm, onde ficam, com quem são compartilhados e quando são eliminados. É a base dos demais checklists. Revise a cada semestre ou quando entrar um novo sistema.',
  secoes: [
    { id: 'm1', titulo: '1. Inventário de dados pessoais', itens: [
      { id: 'respInv', tipo: 'texto', label: 'Responsável pelo inventário' },
      { id: 'dataInv', tipo: 'texto', label: 'Data da última atualização do inventário' },
      G('c_escopo', 'O mapeamento cobre todas as áreas (contábil, fiscal, pessoal, administrativo, financeiro e relacionamento com clientes)?'),
      G('c_invPJ', 'Clientes pessoa jurídica: identificação da empresa, representante legal, histórico financeiro, dados fiscais e sócios estão inventariados?', 'Dados da empresa (CNPJ, razão social) não são dados pessoais; os do representante legal e dos sócios (CPF, endereço, participação, dados bancários) são. O guia trata tudo como dado pessoal; vale separar.'),
      G('c_invPF', 'Clientes pessoa física e autônomos: identificação, contato, renda, dados bancários e dependentes estão inventariados?'),
      G('c_invFunc', 'Funcionários: admissão, dados trabalhistas, contato de emergência, saúde ocupacional e dados de acesso estão inventariados?'),
      G('c_invTerc', 'Terceiros: fornecedores, auditores e consultores, plataformas e operadores estão inventariados?'),
      G('c_invMkt', 'Comunicação e marketing: emails, histórico de comunicação, consentimentos e cookies/rastreamento web estão inventariados?'),
      G('c_campos', 'Para cada categoria constam tipo de informação, origem, finalidade, volume estimado e onde é armazenada?'),
      G('c_atual', 'O inventário é atualizado quando novos dados, sistemas ou fornecedores entram em uso?', '', true)
    ] },
    { id: 'm2', titulo: '2. Fluxo dos dados (coleta, uso, guarda, compartilhamento, eliminação)', itens: [
      G('c_fontes', 'As fontes de coleta estão mapeadas (clientes, titulares, registros públicos como Receita e Junta, sistemas de terceiros) e os pontos de entrada (email, portal, CRM, telefone)?'),
      G('c_consReg', 'Quando a coleta depende de consentimento, ele fica registrado e em cláusula destacada, e não só embutido no contrato?', 'O guia fala em consentimento "no contrato de serviço". O art. 8º, § 1º exige cláusula destacada quando o consentimento é dado por escrito. Para o que o contrato ou a lei já exigem, a base não é consentimento.', true),
      G('c_classif', 'Os dados são classificados por tipo (fiscal, trabalhista, financeiro, pessoal) e por nível de sensibilidade (público, confidencial, secreto)?'),
      G('c_valid', 'Há validação de qualidade na entrada (completude, formato, CPF válido, CNPJ ativo) e atualização periódica?'),
      G('c_compart', 'Os compartilhamentos estão mapeados (fisco, bancos, operadores, clientes), com destinatário e finalidade?', '', true),
      G('c_armaz', 'O local de armazenamento de cada categoria está registrado (ERP, CRM, planilhas, nuvem, papel)?', 'Planilhas soltas e arquivos físicos costumam ficar de fora do mapa; incluí-los.', true),
      G('c_elim', 'O fim do ciclo (eliminação) está mapeado para cada categoria (ver "Retenção e Descarte")?', '', true)
    ] },
    { id: 'm3', titulo: '3. Dados que exigem atenção reforçada', itens: [
      G('c_sens', 'Dados sensíveis (art. 5º, II e art. 11) estão identificados e têm base legal própria?', 'No documento aparecem atestado médico, exame admissional e licença por doença. CPF, dados bancários e financeiros são de alto risco, mas não são sensíveis pela lei.'),
      G('c_menores', 'Dados de dependentes, que podem ser crianças ou adolescentes, são tratados conforme o art. 14 (melhor interesse, consentimento específico de um dos pais quando aplicável)?', 'O inventário cita CPF e data de nascimento de dependentes. Despesas médicas de dependentes no IR podem revelar dado de saúde.', true),
      G('c_acessoRest', 'O acesso a dados de alto risco (folha, saúde, bancários) é restrito por função?', '', true),
      G('c_intl', 'Ferramentas que enviam dados ao exterior (ex.: Google Analytics, nuvem, email marketing) foram identificadas e a hipótese do art. 33 está documentada?', 'O guia lista Google Analytics e backup em nuvem sem tratar de transferência internacional.', true)
    ] },
    { id: 'm4', titulo: '4. Responsáveis, bases legais e retenção', itens: [
      G('c_papeis', 'Para cada categoria está definido quem decide (controlador) e quem trata em nome de quem (operador)?', 'Para dados dos clientes-empresa e de seus funcionários, o escritório costuma ser operador. Validar caso a caso.'),
      G('c_oper', 'Os operadores e plataformas estão cadastrados com contrato (ver "Contratos e Operadores")?'),
      G('c_base', 'Cada categoria tem base legal registrada (art. 7º)?', 'Seção 6 do documento (bases legais por categoria) não veio.'),
      G('c_ret', 'Cada categoria tem prazo de retenção registrado (ver "Retenção e Descarte")?', 'Seção 7 do documento não veio.')
    ] },
    { id: 'm5', titulo: '5. Risco e documentação', itens: [
      G('c_risco', 'Existe mapa de risco por tipo de dado (probabilidade e impacto de vazamento, perda ou alteração)?', 'Seção 4 do documento não veio.'),
      G('c_ripd', 'Para tratamento de alto risco ou quando a ANPD solicitar, o escritório sabe elaborar o relatório de impacto à proteção de dados pessoais (art. 38)?', 'O guia usa a sigla "AIPD"; o termo da LGPD é relatório de impacto (RIPD).', true),
      G('c_ropa', 'O inventário serve como registro das operações de tratamento (art. 37) e fica disponível para auditoria?', '', true),
      G('c_rev', 'O mapeamento é revisado ao menos semestralmente?', '', true)
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_invPJ === 'Não conforme' || d.c_invPF === 'Não conforme' || d.c_invFunc === 'Não conforme') a.push('Inventário incompleto para clientes ou funcionários.');
    if (d.c_base === 'Não conforme') a.push('Categorias de dados sem base legal registrada.');
    if (d.c_sens === 'Não conforme') a.push('Dados sensíveis sem identificação ou base legal própria.');
    if (d.c_intl === 'Não conforme') a.push('Transferência internacional (analytics, nuvem) sem hipótese legal documentada.');
    if (d.c_menores === 'Não conforme') a.push('Dados de dependentes menores sem tratamento conforme o art. 14.');
    if (d.c_ret === 'Não conforme') a.push('Categorias sem prazo de retenção.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>É o levantamento de quais dados pessoais o escritório trata, de onde vêm, onde ficam, com quem são compartilhados e quando saem. Sem ele, os outros checklists não têm base. Itens com a etiqueta <b>extra</b> foram acrescentados pela equipe técnica.</p>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>Dados de pessoa jurídica tratados como dados pessoais</b>: a LGPD protege dados de pessoa natural. CNPJ e razão social não entram; representante legal, sócios, contato e dados bancários de pessoas físicas entram.</li>
      <li><b>"AIPD"</b>: o termo da lei é relatório de impacto à proteção de dados pessoais (art. 5º, XVII e art. 38).</li>
      <li><b>Consentimento "no contrato de serviço"</b>: quando o consentimento é a base, deve ser livre, específico e destacado das demais cláusulas (art. 8º, § 1º). Para o que o contrato ou a lei exigem, use outra base legal.</li>
      <li><b>Transferência internacional</b>: Google Analytics e backup em nuvem aparecem sem análise do art. 33.</li>
      <li><b>Dependentes</b>: podem ser menores (art. 14) e conter dados de saúde; o documento não faz essa ressalva.</li>
      <li><b>Volumes e formatos</b> (ex.: "terabytes/ano"): são estimativas ilustrativas, a substituir pelos números reais do escritório.</li>
      <li><b>Texto incompleto</b>: o arquivo termina na seção 3.1 (etapa 2). Fluxos restantes, mapa de risco, responsáveis, bases legais, retenção, o checklist do próprio documento e a conclusão não vieram.</li>
    </ul>`
};
