// Guia "Incidentes" — fonte: "Incidentes — LGPD para Escritório de Contabilidade" (06/10/2026).
// O arquivo recebido termina na seção 3.4 (tabela de contatos vazia). Seções 4 em diante (inclusive a 6, notificação a titulares) não vieram.
// Itens extra:true foram acrescentados pela equipe técnica e precisam de validação jurídica.

const G = (id, label, ajuda, extra = false) => ({ id, tipo: 'sn', label, ajuda, extra });

export const GUIA_INCIDENTES = {
  titulo: 'Incidentes',
  tituloHint: 'Ex.: Preparo para incidentes 2026 (ou: Incidente de 12/10 — laptop roubado)',
  resumo: 'Dois usos: (1) um registro de preparo, que mede se o escritório está pronto para detectar e responder a incidentes; (2) um registro por incidente real, preenchendo a seção de ocorrência. Responda com o que existe hoje.',
  secoes: [
    { id: 'i1', titulo: '1. Definição e classificação', itens: [
      G('c_def', 'O escritório definiu o que é incidente (acesso não autorizado, perda, vazamento, violação de sigilo, indisponibilidade, alteração indevida)?'),
      G('c_tipos', 'Os tipos de incidente mais prováveis (vazamento por email errado, credencial vazada, ransomware, laptop roubado, acesso indevido de analista) estão catalogados?'),
      G('c_sev', 'Existe escala de severidade (Crítico, Alto, Médio, Baixo) com tempo máximo de resposta e escalação definidos?', 'Referência do guia: Crítico até 1h; Alto até 4h; Médio até 8h; Baixo até 24h. São prazos internos, não da lei.'),
      G('c_criterio', 'O critério para decidir se o incidente deve ser comunicado à ANPD e aos titulares está definido por risco ou dano relevante, e não só pela severidade interna?', 'A comunicação depende de risco ou dano relevante aos titulares (art. 48 da LGPD). Pela Res. CD/ANPD 15/2024 (art. 5º), há risco relevante quando o incidente afeta significativamente direitos fundamentais e envolve dado sensível, dado de criança, adolescente ou idoso, dado financeiro, dado de autenticação, dado sob sigilo ou larga escala. O guia atrela a notificação ao nível Crítico; isso não confere com a lei.', true)
    ] },
    { id: 'i2', titulo: '2. Detecção e monitoramento', itens: [
      G('c_logsDia', 'Os logs de acesso (quem, quando, o quê, resultado) são analisados diariamente?'),
      G('c_alertas', 'Há alertas automáticos para atividade anômala (falhas de login repetidas, acesso fora de horário, transferência em massa)?'),
      G('c_rede', 'O tráfego de rede é monitorado (conexões suspeitas, exfiltração)?'),
      G('c_integr', 'Há verificação periódica de integridade (hash/checksum) de dados críticos?'),
      G('c_av', 'Antivírus e antimalware atualizados, com varredura diária?'),
      G('c_bkpMon', 'O resultado dos backups é conferido diariamente?'),
      G('c_fisico', 'Há controle de acesso físico (registro de entrada em servidores, câmeras, chaves)?'),
      G('c_iocs', 'A equipe conhece os sinais de comprometimento (ex.: arquivos .locked/.enc, contas novas não autorizadas, clientes recebendo emails que o escritório não enviou)?'),
      G('c_logCampos', 'Os logs registram data/hora, usuário, ação, recurso, resultado, IP de origem e dispositivo?'),
      { id: 'retLogs', tipo: 'texto', label: 'Prazo de retenção de logs adotado', ajuda: 'Referência do guia: 12 meses (24 para acesso administrativo). É prática interna sugerida; o guia não cita lei, e a obrigação de 6 meses do Marco Civil vale para provedores de aplicação, não para o escritório. Definir com a assessoria jurídica.' }
    ] },
    { id: 'i3', titulo: '3. Canais de reporte', itens: [
      G('c_canalDpo', 'Existe email do encarregado para reportar incidentes, com disponibilidade 24/7 e confidencialidade?'),
      G('c_canalTi', 'Existe telefone de emergência de TI (horário comercial + plantão)?'),
      G('c_canalAnon', 'Existe canal anônimo para denúncia, com proteção da identidade do denunciante?'),
      G('c_canalPess', 'Colaboradores sabem que podem reportar pessoalmente ao encarregado ou à direção?'),
      G('c_ciente', 'Colaboradores e terceiros foram informados dos canais e do dever de reportar suspeitas imediatamente?', '', true)
    ] },
    { id: 'i4', titulo: '4. Plano de resposta (30 min, 4 h, 24 h)', itens: [
      G('c_plano', 'Existe plano de resposta a incidentes escrito, com responsáveis nomeados?', '', true),
      G('c_conf', 'O recebimento da denúncia e a confirmação (não é falso alarme) por encarregado ou TI estão definidos?'),
      G('c_isola', 'Há instrução de contenção: desconectar a máquina da rede sem desligá-la, não abrir arquivos suspeitos?', 'Preservar a máquina ligada é prática comum de perícia, mas ransomware ativo pode exigir decisão caso a caso. Validar com TI/perícia.'),
      G('c_conta', 'Há procedimento de congelamento de conta (reset de senha, revogar sessões e tokens, bloquear até investigar)?'),
      G('c_docIni', 'O registro inicial (hora, descrição, sistemas afetados, ações, quem reportou e respondeu) é obrigatório?'),
      G('c_equipe', 'A equipe de resposta está definida (encarregado, TI, responsável da área, jurídico, diretor)?'),
      G('c_invest', 'A investigação preliminar responde origem, início, dados e titulares afetados, e se ainda está em andamento?'),
      G('c_evid', 'Há procedimento de coleta de evidências (cópia de logs, imagem de disco, cadeia de custódia)?'),
      G('c_causa', 'A investigação completa busca causa raiz, vetores, acessos residuais e risco de reinfecção?'),
      { id: 'contatos', tipo: 'area', label: 'Contatos de emergência (função, nome, telefone 24/7, email)', ajuda: 'A tabela de contatos veio vazia no documento original.', extra: true }
    ] },
    { id: 'i5', titulo: '5. Comunicação à ANPD, titulares e terceiros', itens: [
      G('c_anpd', 'Há procedimento para comunicar a ANPD e os titulares quando o incidente puder acarretar risco ou dano relevante?', 'Art. 48 da LGPD. O guia diz "72 horas, Art. 33"; o art. 33 trata de transferência internacional. Res. CD/ANPD 15/2024: 3 dias úteis a partir do conhecimento de que o incidente afetou dados pessoais (art. 6º), em dobro para agentes de pequeno porte, ressalvado prazo previsto em legislação específica. Titulares: 3 dias úteis (art. 9º). Conferido em fonte (cópia do Ministério da Justiça); validar enquadramento.', true),
      G('c_conteudo', 'A comunicação inclui natureza do incidente, dados e titulares afetados, medidas técnicas, riscos, medidas de mitigação, data do conhecimento e contato do encarregado?', 'O guia lista seis itens; a Res. CD/ANPD 15/2024 (art. 6º, § 2º) pede cerca de doze informações (ex.: titulares afetados, riscos, motivo de eventual atraso, controlador e operador) e exige o formulário eletrônico da ANPD.', true),
      G('c_titulares', 'Os titulares afetados são informados em linguagem clara, com descrição dos dados, riscos e medidas recomendadas?', 'A seção 6 do guia, que trataria disso, não veio.', true),
      G('c_receita', 'Para incidentes com dados fiscais, o escritório verificou se há obrigação de avisar a Receita Federal, conselho de classe ou o cliente (controlador)?', 'O guia cita notificar "conforme legislação" sem indicar a norma. Quando o escritório é operador, deve avisar o cliente-controlador. Validar.', true),
      G('c_oper', 'Os contratos com operadores exigem aviso ao escritório em caso de incidente (ver "Contratos e Operadores")?', '', true)
    ] },
    { id: 'i6', titulo: '6. Registro e aprendizado', itens: [
      G('c_registro', 'Todo incidente, mesmo sem comunicação à ANPD, é registrado com avaliação do risco?', 'Res. CD/ANPD 15/2024, art. 10: manter o registro do incidente, inclusive o não comunicado, por no mínimo 5 anos, salvo obrigação que exija prazo maior.', true),
      G('c_pos', 'Após cada incidente há análise pós-ocorrência e ajuste do plano?', '', true),
      G('c_teste', 'O plano é testado (simulação) ao menos uma vez por ano?', '', true)
    ] },
    { id: 'i7', titulo: '7. Ocorrência (preencha só em registro de incidente real)', itens: [
      { id: 'oc_data', tipo: 'texto', label: 'Data e hora da primeira detecção', extra: true },
      { id: 'oc_tipo', tipo: 'select', label: 'Tipo de incidente', opcoes: ['Vazamento de dados', 'Acesso não autorizado', 'Perda de integridade', 'Violação de sigilo profissional', 'Indisponibilidade de dados', 'Exposição de senha/credencial', 'Acesso de privilégio elevado anômalo', 'Dispositivo perdido ou roubado', 'Outro'], extra: true },
      { id: 'oc_sev', tipo: 'select', label: 'Severidade', opcoes: ['Crítico', 'Alto', 'Médio', 'Baixo'], extra: true },
      { id: 'oc_desc', tipo: 'area', label: 'O que aconteceu, dados e quantidade de titulares afetados', extra: true },
      { id: 'oc_risco', tipo: 'select', label: 'Há risco ou dano relevante aos titulares?', opcoes: ['Sim', 'Não', 'Em avaliação'], ajuda: 'Se "Sim": comunicar ANPD e titulares no prazo da Res. CD/ANPD 15/2024 (3 dias úteis; 6 para pequeno porte).', extra: true },
      { id: 'oc_anpd', tipo: 'texto', label: 'Data da comunicação à ANPD (ou justificativa)', extra: true },
      { id: 'oc_tit', tipo: 'texto', label: 'Data da comunicação aos titulares (ou justificativa)', extra: true },
      { id: 'oc_acoes', tipo: 'area', label: 'Ações tomadas e causa raiz', extra: true }
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_plano === 'Não conforme') a.push('Sem plano de resposta a incidentes escrito.');
    if (d.c_anpd === 'Não conforme') a.push('Sem procedimento de comunicação à ANPD e aos titulares.');
    if (d.c_canalDpo === 'Não conforme') a.push('Sem canal para reportar incidentes ao encarregado.');
    if (d.c_registro === 'Não conforme') a.push('Incidentes não são registrados.');
    if (d.c_bkpMon === 'Não conforme') a.push('Backups não são conferidos: risco de descobrir a falha só no incidente.');
    if (d.oc_risco === 'Sim' && !d.oc_anpd) a.push('Incidente com risco relevante sem data de comunicação à ANPD.');
    if (d.oc_risco === 'Sim' && !d.oc_tit) a.push('Incidente com risco relevante sem data de comunicação aos titulares.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Mede se o escritório consegue detectar, conter, comunicar e aprender com incidentes de segurança com dados pessoais. A seção 7 serve para registrar um incidente real. Itens com a etiqueta <b>extra</b> foram acrescentados pela equipe técnica.</p>
    <h3>O que a lei exige (resumo)</h3>
    <ul><li>Art. 48 da LGPD: o controlador comunica à ANPD e ao titular incidente que possa acarretar risco ou dano relevante.</li>
    <li>Resolução CD/ANPD 15/2024: prazo de 3 dias úteis (6 para agentes de pequeno porte) e conteúdo da comunicação. Conferir o texto vigente.</li>
    <li>Arts. 46 a 49: medidas de segurança e boas práticas.</li></ul>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>"72 horas, Art. 33 LGPD"</b>: o art. 33 trata de transferência internacional. A comunicação de incidente é o art. 48 e o prazo regulamentado pela ANPD é de 3 dias úteis (6 para pequeno porte), não 72 horas corridas.</li>
      <li><b>Notificação atrelada ao nível "Crítico"</b>: a obrigação decorre de risco ou dano relevante aos titulares, não do rótulo interno de severidade. Um incidente "Médio" pode exigir comunicação.</li>
      <li><b>"Dados sensíveis (CPF, dados bancários)"</b>: CPF e dados bancários são dados de alto risco, mas não são sensíveis pelo art. 5º, II da LGPD.</li>
      <li><b>Prazos de resposta (1h, 4h, 8h, 24h) e limites ("até 3 clientes")</b>: são critérios internos do guia, sem base legal. Úteis, mas ajustáveis.</li>
      <li><b>Retenção de logs (12 e 24 meses)</b>: sem fundamento legal citado; tratada como recomendação interna.</li>
      <li><b>Notificação à Receita Federal e órgãos de classe</b>: o guia diz "conforme legislação" sem citar norma. Mantida como pergunta para validação.</li>
      <li><b>Comunicação aos titulares</b>: o guia remete à "seção 6", que não veio.</li>
      <li><b>Texto incompleto</b>: o arquivo termina na seção 3.4 (tabela de contatos em branco).</li>
    </ul>`
};
