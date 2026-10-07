// Guia "Segurança da Informação" — fonte: "Segurança da Informação para Escritório de Contabilidade — Conformidade LGPD" (07/10/2026).
// ATENÇÃO: o arquivo recebido tem só a introdução e o título da seção 2.1 (classificação de dados); não traz nenhuma medida técnica.
// Quase todos os itens abaixo são extra:true: foram montados pela equipe técnica a partir do art. 46 da LGPD e de boas práticas
// usuais, e precisam de validação por quem responde pela TI do escritório.

const G = (id, label, ajuda, extra = true) => ({ id, tipo: 'sn', label, ajuda, extra });

export const GUIA_SEGURANCA = {
  titulo: 'Segurança da Informação',
  tituloHint: 'Ex.: Segurança da informação 2026',
  resumo: 'Checklist de medidas técnicas e administrativas de segurança (art. 46 da LGPD). Atenção: o documento recebido veio praticamente vazio, então os itens são boas práticas montadas pela equipe técnica, não o conteúdo do seu guia. Substitua pelo texto completo quando o tiver.',
  secoes: [
    { id: 'x1', titulo: '1. Governança e classificação de dados', itens: [
      { id: 'respSeg', tipo: 'texto', label: 'Responsável pela segurança da informação', extra: true },
      G('c_pol', 'Existe política de segurança da informação escrita, aprovada pela direção e comunicada à equipe?'),
      G('c_classif', 'Os dados são classificados por sensibilidade (ex.: público, interno, confidencial) com regras de proteção para cada nível?', 'A seção 2.1 do documento trata de classificação de dados, mas o conteúdo não veio.', false),
      G('c_inv', 'Há inventário de ativos (computadores, servidores, sistemas, celulares) e de onde ficam os dados?'),
      G('c_risco', 'Os riscos de segurança são avaliados ao menos uma vez por ano?')
    ] },
    { id: 'x2', titulo: '2. Controle de acesso e autenticação', itens: [
      G('c_perfil', 'O acesso é concedido por função, com o mínimo necessário (privilégio mínimo)?', 'O título da seção 2 do documento cita controle de acesso e autenticação, sem o conteúdo.', false),
      G('c_revAcesso', 'As permissões são revisadas periodicamente e revogadas no desligamento ou troca de função?'),
      G('c_senha', 'Há regra de senhas fortes, únicas, sem compartilhamento de login?', '', false),
      G('c_mfa', 'A autenticação em dois fatores (MFA) está ativa em email, sistemas contábeis, nuvem e acesso remoto?'),
      G('c_admin', 'Contas administrativas são separadas das de uso diário e têm monitoramento reforçado?'),
      G('c_remoto', 'O acesso remoto usa VPN ou equivalente seguro?')
    ] },
    { id: 'x3', titulo: '3. Proteção técnica', itens: [
      G('c_cripTr', 'Os dados trafegam criptografados (HTTPS/TLS, VPN)?'),
      G('c_cripRep', 'Dados em notebooks, celulares, servidores e nuvem ficam criptografados em repouso?'),
      G('c_fw', 'Firewall e proteção de rede estão ativos e configurados?'),
      G('c_av', 'Antivírus/antimalware ativo e atualizado em todos os equipamentos?'),
      G('c_patch', 'Sistemas e equipamentos recebem atualizações de segurança com regularidade?'),
      G('c_logs', 'Acessos e ações são registrados em logs com retenção definida?'),
      G('c_vuln', 'Há análise de vulnerabilidades ou teste de intrusão periódico?')
    ] },
    { id: 'x4', titulo: '4. Backup e continuidade', itens: [
      G('c_bkp', 'Há backup regular dos dados críticos, criptografado e guardado fora do ambiente principal?'),
      G('c_bkpTeste', 'A restauração do backup é testada periodicamente?'),
      G('c_dr', 'Existe plano de continuidade e recuperação de desastres?')
    ] },
    { id: 'x5', titulo: '5. Segurança física e dispositivos', itens: [
      G('c_fisico', 'O acesso físico a servidores, arquivos e áreas com dados é controlado e registrado?'),
      G('c_mesa', 'Há regra de mesa limpa e tela bloqueada?'),
      G('c_disp', 'Notebooks, celulares e mídias removíveis têm regras de uso, criptografia e procedimento para perda ou roubo?'),
      G('c_byod', 'O uso de dispositivos pessoais para trabalho é regulado?')
    ] },
    { id: 'x6', titulo: '6. Pessoas e terceiros', itens: [
      G('c_conf', 'Colaboradores assinam termo de confidencialidade e ciência das políticas?'),
      G('c_treino', 'A equipe recebe treinamento periódico de segurança, incluindo phishing (ver "Treinamento e Cultura")?'),
      G('c_terc', 'Fornecedores com acesso a dados passam por avaliação de segurança e têm contrato com cláusulas adequadas (ver "Contratos e Operadores")?'),
      G('c_incid', 'Há plano de resposta a incidentes (ver "Incidentes")?')
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_pol === 'Não conforme') a.push('Sem política de segurança da informação.');
    if (d.c_mfa === 'Não conforme') a.push('Sem autenticação em dois fatores.');
    if (d.c_cripRep === 'Não conforme') a.push('Dados sem criptografia em repouso.');
    if (d.c_bkp === 'Não conforme') a.push('Sem backup confiável dos dados críticos.');
    if (d.c_bkpTeste === 'Não conforme') a.push('Backup nunca testado: o risco é descobrir a falha só na hora de restaurar.');
    if (d.c_revAcesso === 'Não conforme') a.push('Permissões não revisadas nem revogadas no desligamento.');
    if (d.c_incid === 'Não conforme') a.push('Sem plano de resposta a incidentes.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Verifica se o escritório adota medidas técnicas e administrativas aptas a proteger os dados pessoais contra acesso não autorizado, perda, alteração e vazamento (art. 46 da LGPD).</p>
    <h3>Aviso importante</h3>
    <p>O documento recebido contém só a introdução e o título da seção 2.1. <b>Praticamente todos os itens foram montados pela equipe técnica</b> a partir do art. 46 e de boas práticas usuais. Nenhum deles vem do seu guia. Envie o texto completo para substituí-los.</p>
    <h3>O que a LGPD exige</h3>
    <p>Medidas de segurança, técnicas e administrativas, aptas a proteger os dados (art. 46), observadas desde a concepção do serviço (art. 46, § 2º), e boas práticas de governança (art. 50). A lei <b>não fixa</b> tecnologias específicas (TLS, AES-256, MFA); esses itens são recomendações.</p>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>"Informações altamente sensíveis"</b> (dados financeiros, fiscais, patrimoniais): são dados de alto risco, mas não são "sensíveis" no sentido técnico do art. 5º, II.</li>
      <li><b>"Boas práticas internacionais de cibersegurança"</b>: o documento não cita qual norma ou framework (ex.: ISO/IEC 27001, NIST). Convém escolher e referenciar.</li>
      <li><b>Texto incompleto</b>: tudo após a seção 2.1 (políticas de classificação, acesso, autenticação, medidas técnicas, físicas e operacionais) não veio.</li>
    </ul>`
};
