// Guia "Governança e Políticas" — fonte: "Governança e Políticas LGPD — Guia Completo para Escritório de Contabilidade" v1.0 (06/10/2026).
// O arquivo recebido termina na seção 3.2 (bases legais). Itens extra:true foram acrescentados pela equipe técnica e precisam de validação jurídica.

const G = (id, label, ajuda, extra = false) => ({ id, tipo: 'sn', label, ajuda, extra });


const nom = d => /^Nomeado/.test((d || {}).encSit || '');
const disp = d => /^Dispensado/.test((d || {}).encSit || '');
import { resultadoEnq } from './diagnostico.mjs';
export { resultadoEnq };

export const GUIA_GOVERNANCA = {
  titulo: 'Governança e Políticas',
  tituloHint: 'Ex.: Governança LGPD 2026',
  resumo: 'Checklist de estrutura de governança, princípios e bases legais do escritório. Um registro por contabilidade, revisado a cada trimestre ou quando algo mudar.',
  secoes: [
    { id: 'g0', titulo: '1. Diagnóstico do enquadramento (porte, volume e risco)', itens: [
      { id: 'dgPorte', tipo: 'select', label: 'Porte na Receita Federal', opcoes: ['Microempresa (ME)', 'Empresa de pequeno porte (EPP)', 'MEI', 'Demais', 'Não consultado'], ajuda: 'Vem do cadastro da contabilidade (consulta ao CNPJ). Confira com o cliente: o porte da Receita é declarado e pode estar desatualizado.', cad: 'porteRfb', extra: true },
      { id: 'dgSimples', tipo: 'select', label: 'Optante pelo Simples Nacional?', opcoes: ['Sim', 'Não', 'Não sei'], cad: 'simples', extra: true },
      { id: 'dgNat', tipo: 'texto', label: 'Natureza jurídica', ajuda: 'Ex.: Sociedade Empresária Limitada.', cad: 'natJur', extra: true },
      { id: 'dgLimite', tipo: 'select', label: 'Receita bruta anual dentro do limite de pequeno porte da LC 123/2006?', opcoes: ['Sim', 'Não', 'Não sei'], ajuda: 'Referência: R$ 4,8 milhões por ano (EPP). Confirmar com o contador do cliente e no texto oficial da Res. CD/ANPD 2/2022 (hipóteses de exclusão).', extra: true },
      { id: 'dgGrupo', tipo: 'select', label: 'O escritório integra grupo econômico cuja receita ultrapassa o limite?', opcoes: ['Não', 'Sim', 'Não sei'], ajuda: 'Nenhum cadastro público informa isso: perguntar ao cliente.', extra: true },
      { id: 'dgColab', tipo: 'texto', label: 'Nº de colaboradores do escritório', extra: true },
      { id: 'dgClientes', tipo: 'texto', label: 'Nº de clientes-empresa atendidos', extra: true },
      { id: 'dgPF', tipo: 'texto', label: 'Nº de clientes pessoa física (0 se não atende)', ajuda: 'Ex.: declarações de IRPF.', extra: true },
      { id: 'dgTitulares', tipo: 'select', label: 'Quantas pessoas têm dados tratados pelo escritório (empregados dos clientes e clientes pessoa física, estimativa)?', opcoes: ['Até 500', 'De 500 a 5.000', 'Acima de 5.000', 'Não sei'], ajuda: 'Larga escala conta titulares de dados, não o tamanho do escritório. Some empregados dos clientes (folha, admissão, atestados) e clientes pessoa física. As faixas são convenção interna deste sistema, não da lei: validar com advogado.', extra: true },
      G('c_controlador', 'Os papéis de controlador e operador estão definidos para cada tipo de dado?', 'Para dados dos clientes-empresa, o escritório costuma atuar como operador (e o encarregado é obrigação do controlador, art. 41). Para dados dos próprios colaboradores e de clientes pessoa física, atua como controlador. Validar caso a caso.'),
      { id: 'dgSaude', tipo: 'select', label: 'Trata dados de saúde (atestados, exames admissionais)?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgSind', tipo: 'select', label: 'Trata filiação sindical (contribuição sindical)?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgBio', tipo: 'select', label: 'Trata biometria (ponto biométrico) ou dados de crianças e adolescentes (dependentes, menor aprendiz)?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgIA', tipo: 'select', label: 'Usa inteligência artificial ou outra tecnologia nova sobre dados de clientes?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgMonit', tipo: 'select', label: 'Há monitoramento sistemático (câmeras, rastreamento, e-mail ou tela)?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgDecis', tipo: 'select', label: 'Há decisões automatizadas com efeito relevante sobre pessoas (score, perfil)?', opcoes: ['Sim', 'Não', 'Não sei'], extra: true },
      { id: 'dgExigiu', tipo: 'select', label: 'Algum cliente já exigiu encarregado em contrato?', opcoes: ['Não', 'Sim'], ajuda: 'Mesmo com a dispensa legal, o contrato com o cliente pode exigir a nomeação.', extra: true },
      { id: 'dgResultado', tipo: 'resultado', label: 'Resultado sugerido do diagnóstico', calc: resultadoEnq },
      G('c_enq', 'A avaliação de enquadramento (pequeno porte e alto risco) está registrada, com data e responsável?', 'Res. CD/ANPD 2/2022. Guarde o diagnóstico acima e a decisão tomada com o cliente. Conferir as hipóteses de exclusão no texto oficial.', true),
      { id: 'porteRes', tipo: 'select', label: 'Enquadramento adotado (decisão do escritório, com o cliente)', opcoes: ['Agente de pequeno porte (regime simplificado)', 'Fora do regime de pequeno porte', 'Não avaliado'], ajuda: 'Decisão sua: o resultado acima é só sugestão. Validar com advogado.', extra: true },
    ] },
    { id: 'g1', titulo: '2. Encarregado e estrutura de papéis', itens: [
      { id: 'encSit', tipo: 'select', label: 'Situação do encarregado (DPO)', opcoes: ['Nomeado: colaborador interno', 'Nomeado: pessoa física externa', 'Nomeado: empresa externa (com pessoa física indicada)', 'Dispensado (pequeno porte), com responsável pelo canal', 'Ainda não definido'], ajuda: 'Decida depois do diagnóstico acima. Mesmo dispensado, designe quem atende titulares e ANPD (boa prática e atenuante).', extra: true },
      { id: 'encNome', tipo: 'texto', label: 'Nome do encarregado (ou do responsável pelo canal, se dispensado)', ajuda: 'Art. 41. Quem decide a finalidade e os meios do tratamento (sócio-administrador, diretor, gestor de TI, de RH) tende a ter conflito de interesses. Res. CD/ANPD 18/2024. Validar.' },
      { id: 'encCargo', tipo: 'texto', label: 'Cargo ou função na empresa', extra: true },
      { id: 'encVinculo', tipo: 'select', label: 'Vínculo', opcoes: ['Colaborador interno (CLT)', 'Pessoa física externa', 'Empresa externa'], ajuda: 'Se for empresa externa, ela deve indicar uma pessoa física responsável.', extra: true },
      { id: 'encContato', tipo: 'texto', label: 'E-mail ou canal público de contato', ajuda: 'É o contato divulgado ao titular (site, Política de Privacidade).', extra: true },
      { id: 'controlador', tipo: 'texto', label: 'Controlador (pessoa jurídica) e sócio/diretor responsável', ajuda: 'Pela lei, o controlador é a pessoa jurídica; o sócio decide em nome dela.' },
      { ...G('c_canal', 'Há canal de atendimento ao titular divulgado publicamente (e-mail ou formulário), com responsável definido?', 'Res. CD/ANPD 2/2022, art. 11: o dispensado de nomear encarregado mantém o canal de atendimento. Se o encarregado é nomeado, o contato dele é o canal (próximo item).', true), aplica: d => !nom(d) },
      { ...G('c_encarr', 'O encarregado está nomeado e sua identidade e contato são divulgados publicamente?', 'Art. 41, § 1º.'), aplica: d => !disp(d) },
      { ...G('c_encDesig', 'Há ato formal de designação do encarregado (documento escrito, datado e assinado)?', 'Res. CD/ANPD 18/2024. Mesmo quando a nomeação é dispensada, registre quem atende titulares e ANPD. Conferir os artigos no texto oficial.', true), aplica: d => !disp(d) },
      { ...G('c_encConf', 'O encarregado não acumula função que gere conflito de interesses (ex.: decidir sobre o tratamento que ele mesmo fiscaliza)?', 'A ANPD recomenda evitar o acúmulo de funções que comprometam a independência do encarregado. Sócio que decide e fiscaliza ao mesmo tempo é o caso típico. Validar o fundamento na Res. 18/2024.', true), aplica: d => !disp(d) },
      { ...G('c_encIndep', 'O encarregado tem acesso direto à direção e autonomia para exercer a função, com recursos e tempo para isso?', 'Res. CD/ANPD 18/2024. Validar o fundamento.', true), aplica: d => !disp(d) },
      G('c_gestor', 'Há gestor de dados responsável por catalogar dados, prazos de retenção e eliminação segura?'),
      G('c_ti', 'Há responsável de TI/Segurança pelas medidas técnicas (criptografia, firewall, backup, controle de acesso, logs)?'),
      G('c_rh', 'O RH inclui cláusulas LGPD nos contratos de trabalho e revoga acessos no desligamento?'),
      G('c_jur', 'Há responsável jurídico que analisa bases legais e cláusulas de proteção de dados em contratos?'),
      G('c_oper', 'Analistas e contadores têm acesso restrito ao necessário para a função e foram instruídos a não compartilhar dados sem autorização?'),
      G('c_matriz', 'Os papéis, responsabilidades e níveis de acesso estão formalizados por escrito?', 'Item acrescentado: o guia descreve a tabela de papéis, mas não pergunta se ela existe formalizada.', true)
    ] },
    { id: 'g2', titulo: '3. Comitê de Conformidade LGPD', itens: [
      G('c_comite', 'Existe comitê de conformidade (encarregado, controlador, TI, jurídico, gestor de dados e RH quando cabível)?'),
      { id: 'ultReuniao', tipo: 'texto', label: 'Data da última reunião do comitê' },
      G('c_trim', 'O comitê se reúne no mínimo trimestralmente, com reuniões extraordinárias em caso de incidente ou novo tratamento?'),
      G('c_pauta', 'A pauta cobre conformidade do trimestre, pedidos de titulares, incidentes, novas políticas, riscos de novos projetos, treinamentos e legislação?'),
      G('c_ata', 'Cada reunião gera ata com data, participantes, decisões, responsáveis e prazos?'),
      G('c_ataSeg', 'As atas ficam em local seguro, com acesso restrito aos membros do comitê?')
    ] },
    { id: 'g3', titulo: '4. Princípios (art. 6º da LGPD)', itens: [
      G('p_final', 'Finalidade: dados coletados para um fim não são reutilizados para outro sem nova base legal?'),
      G('p_adeq', 'Adequação: os dados coletados são compatíveis com a finalidade informada?'),
      G('p_nec', 'Necessidade: coleta limitada ao mínimo necessário (ex.: sem telefone residencial se a comunicação é digital)?'),
      G('p_acesso', 'Livre acesso: o titular consulta seus dados de forma facilitada e gratuita?', 'O guia fala em "20 dias" para pedidos de acesso; a lei (art. 19) prevê 15 dias para declaração completa.'),
      G('p_qual', 'Qualidade dos dados: há revisão periódica para manter os dados exatos e atualizados?'),
      G('p_transp', 'Transparência: existe Aviso de Privacidade em linguagem simples?'),
      G('p_seg', 'Segurança: criptografia, firewall, controle de acesso e backup seguro implantados?'),
      G('p_prev', 'Prevenção: há medidas para prevenir danos decorrentes do tratamento?', 'O guia recebido não lista este princípio (art. 6º, VIII).', true),
      G('p_disc', 'Não discriminação: nenhum tratamento é usado para fins discriminatórios ilícitos ou abusivos?', 'O guia recebido não lista este princípio (art. 6º, IX).', true),
      G('p_resp', 'Responsabilização e prestação de contas: registros demonstram a conformidade (inventário, consentimentos, decisões do comitê)?')
    ] },
    { id: 'g4', titulo: '5. Bases legais (art. 7º) e registros', itens: [
      G('c_baseMap', 'Cada tipo de dado e finalidade está vinculado a uma base legal documentada?', 'Bases mais usadas em contabilidade: execução de contrato (art. 7º, V), obrigação legal (II), exercício regular de direitos (VI), legítimo interesse (IX) e consentimento (I).'),
      G('c_consent', 'Quando a base é consentimento, ele é prévio, informado, específico, livre e revogável, e há registro?'),
      G('c_obrigLegal', 'Para obrigação legal, a norma e o prazo de guarda estão citados?'),
      G('c_li', 'Para legítimo interesse, há avaliação documentada de necessidade e equilíbrio com os direitos do titular?', 'O guia recebido não lista o legítimo interesse (art. 7º, IX).', true),
      G('c_liFinal', 'Legítimo interesse, 1ª etapa: a finalidade é legítima e concreta (situação real, não hipotética) e está descrita?', 'Art. 10, I e II da LGPD; Guia de Legítimo Interesse da ANPD. Validar a redação.', true),
      G('c_liNec', 'Legítimo interesse, 2ª etapa: só os dados indispensáveis são usados e não há meio menos invasivo?', 'Necessidade (art. 10, § 1º).', true),
      G('c_liBal', 'Legítimo interesse, 3ª etapa: foram ponderados o impacto sobre os direitos do titular e suas expectativas razoáveis?', 'Balanceamento. Dados sensíveis não podem ter legítimo interesse como base.', true),
      G('c_liSalv', 'Legítimo interesse, 4ª etapa: há salvaguardas (transparência, direito de oposição, minimização) e a avaliação é registrada com data e responsável?', 'A ANPD pode pedir o relatório de impacto quando a base for legítimo interesse (art. 10, § 3º).', true),
      G('c_sens', 'Dados sensíveis (art. 5º, II e art. 11), como saúde ocupacional de colaboradores, foram identificados e têm base legal própria?', 'Item acrescentado: o guia cita "saúde ocupacional" em outro documento. CPF, CNPJ e dados financeiros não são sensíveis pela lei.', true),
      G('c_ropa', 'Existe registro das operações de tratamento atualizado (art. 37)?', 'O guia usa a sigla "RRPD"; o termo da lei é "registro das operações de tratamento".')
    ] },
    { id: 'g5', titulo: '6. Treinamento, documentação e incidentes', itens: [
      G('c_treino', 'Há treinamento periódico em LGPD para a equipe, com registro de participação?', 'O guia cita treinamento como objetivo, mas a seção não veio.', true),
      G('c_ret', 'Há política de retenção e eliminação segura, com prazos por tipo de dado?', 'Idem: seção não recebida.', true),
      G('c_incid', 'Há plano de resposta a incidentes com comunicação à ANPD e aos titulares em até 3 dias úteis?', 'Res. CD/ANPD 15/2024 (6 dias úteis para agentes de pequeno porte). Seção não recebida.', true),
      G('c_direitos', 'Existe procedimento padrão para atender direitos dos titulares (ver categoria "Direitos dos Titulares")?', 'Seção não recebida.', true),
      G('c_oficioResp', 'Há responsável definido por receber e responder ofícios e requisições da ANPD, com contato atualizado junto à autoridade?', 'Res. CD/ANPD 1/2021 (fiscalização). Ofício sem resposta no prazo agrava a situação do agente. Validar.', true),
      G('c_oficioReg', 'Ofícios e requisições da ANPD são registrados (data de recebimento, prazo, resposta enviada) e respondidos no prazo?', 'Guarde o protocolo da resposta. Conferir os prazos no ofício recebido.', true),
      G('c_anpd', 'A documentação está organizada para eventual fiscalização da ANPD?', 'Seção não recebida.', true)
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_encarr === 'Não conforme' && !disp(d)) a.push('Encarregado não nomeado ou sem contato divulgado.');
    if (d.c_canal === 'Não conforme' && !nom(d)) a.push('Sem canal de atendimento ao titular divulgado.');
    if (['alto', 'cinza', 'nomear'].includes(resultadoEnq(d).nivel) && !nom(d)) a.push('Diagnóstico indica alto risco ou fora do pequeno porte, sem encarregado nomeado: validar com advogado.');
    if (d.c_comite === 'Não conforme') a.push('Sem comitê de conformidade.');
    if (d.c_ata === 'Não conforme') a.push('Reuniões sem ata: sem prova de conformidade em auditoria.');
    if (d.c_baseMap === 'Não conforme') a.push('Tratamentos sem base legal documentada.');
    if (d.c_ropa === 'Não conforme') a.push('Sem registro das operações de tratamento.');
    if (d.p_transp === 'Não conforme') a.push('Sem Aviso de Privacidade.');
    if (d.c_enq === 'Não conforme') a.push('Enquadramento (pequeno porte e alto risco) sem avaliação registrada: dispensas e prazos podem não valer.');
    if (d.c_encDesig === 'Não conforme' && !disp(d)) a.push('Encarregado sem ato formal de designação.');
    if (d.c_encConf === 'Não conforme' && !disp(d)) a.push('Encarregado com conflito de interesses.');
    if (d.c_oficioReg === 'Não conforme') a.push('Ofícios da ANPD sem registro ou resposta no prazo.');
    if (d.c_li === 'Não conforme' || d.c_liBal === 'Não conforme') a.push('Legítimo interesse usado sem avaliação documentada.');
    if (d.c_incid === 'Não conforme') a.push('Sem plano de resposta a incidentes.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Verifica se o escritório tem donos claros para a proteção de dados, órgão que decide e registra, princípios aplicados e base legal para cada tratamento. Itens com a etiqueta <b>extra</b> foram acrescentados pela equipe técnica.</p>
    <h3>Os 10 princípios do art. 6º</h3>
    <p>Finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização e prestação de contas. Todos sob o princípio geral da boa-fé.</p>
    <h3>As 10 bases legais do art. 7º</h3>
    <ul><li>I consentimento; II obrigação legal ou regulatória; III execução de políticas públicas;</li>
    <li>IV estudos por órgão de pesquisa; V execução de contrato; VI exercício regular de direitos;</li>
    <li>VII proteção da vida; VIII tutela da saúde; IX legítimo interesse; X proteção do crédito.</li></ul>
    <h3>Notas de revisão do documento original</h3>
    <ul>
      <li><b>Bases legais com numeração errada e incompleta</b>: o guia numera Contrato como II e Obrigação Legal como III. Na lei, obrigação legal é II e contrato é V. Faltam legítimo interesse (IX) e proteção do crédito (X), entre outras.</li>
      <li><b>"Princípios" tratados como fundamento do tratamento</b>: o guia diz que todo tratamento deve se fundamentar em ao menos um princípio. Todos os princípios se aplicam sempre; o que legitima o tratamento é a base legal do art. 7º.</li>
      <li><b>"Legalidade" como princípio do art. 6º</b>: não consta do art. 6º. Faltam prevenção e não discriminação.</li>
      <li><b>Prazo de 20 dias</b> para acesso: o art. 19 prevê 15 dias para a declaração completa.</li>
      <li><b>"DPO"</b>: o termo da lei é encarregado (art. 41). Dispensa para agentes de pequeno porte: Res. CD/ANPD 2/2022.</li>
      <li><b>Controlador como "Sócio/Diretor"</b>: o controlador é a pessoa jurídica (art. 5º, VI); o sócio age em nome dela.</li>
      <li><b>Encarregado "notifica a ANPD" em incidentes</b>: a comunicação é dever do controlador (art. 48); o encarregado costuma executá-la.</li>
      <li><b>Sigla "RRPD"</b> e "Cita legal" (erro de digitação no original): o termo da lei é registro das operações de tratamento (art. 37).</li>
      <li><b>Texto incompleto</b>: o arquivo termina na seção 3.2. Procedimentos operacionais, treinamento, documentação e resposta a incidentes aparecem nos objetivos, mas não vieram.</li>
    </ul>`
};
