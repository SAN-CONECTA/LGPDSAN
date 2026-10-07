// Guia "Retenção e Descarte" — fonte: "Política de Retenção e Descarte de Dados Pessoais" v1.0 (07/10/2026).
// O arquivo recebido traz as tabelas de prazos até a seção 2.5 (funcionários, incompleta). As seções de armazenamento seguro,
// métodos de descarte e rastreabilidade não vieram. Os prazos abaixo são REFERÊNCIAS do documento e não foram validados:
// várias citações legais do original estão erradas (ver Notas de revisão). Itens extra:true foram acrescentados pela equipe técnica.

const G = (id, label, ajuda, extra = false) => ({ id, tipo: 'sn', label, ajuda, extra });
const R = (id, nome, ref) => G(id, `Prazo de retenção definido e fundamento validado: ${nome}`, ref);

export const GUIA_RETENCAO = {
  titulo: 'Retenção e Descarte',
  tituloHint: 'Ex.: Política de retenção e descarte 2026',
  resumo: 'Verifica se o escritório tem prazo de guarda definido por tipo de dado, com base legal validada, e se elimina o que venceu de forma segura e registrada. Os prazos do documento são referência: confirme cada um com assessoria jurídica antes de adotar.',
  secoes: [
    { id: 'r1', titulo: '1. Política e responsabilidades', itens: [
      { id: 'respPol', tipo: 'texto', label: 'Responsável pela política' },
      { id: 'vigPol', tipo: 'texto', label: 'Data de vigência / última revisão' },
      G('c_pol', 'Existe política escrita de retenção e descarte, aprovada e em vigor?'),
      G('c_abrang', 'A política cobre dados de clientes, parceiros, fornecedores, funcionários e terceiros, em qualquer formato (digital, papel, nuvem, servidor local)?'),
      G('c_resp', 'Estão definidos os responsáveis (encarregado, TI/segurança, operações, supervisores) e o dever de todos os colaboradores?'),
      G('c_tabela', 'Existe tabela de retenção por tipo de dado, com prazo, fundamento e justificativa?'),
      G('c_revPol', 'A tabela é revisada ao menos uma vez por ano e quando a legislação muda?', '', true)
    ] },
    { id: 'r2', titulo: '2. Prazos fiscais, contábeis e contratuais', itens: [
      R('c_nf', 'notas fiscais e documentos de entrada', 'Referência do documento: 5 anos após o encerramento do exercício. Base usual: art. 195, parágrafo único do CTN (guarda até a prescrição dos créditos tributários).'),
      R('c_livros', 'livros e registros contábeis (Diário, Razão)', 'Referência: 5 anos. O documento cita a Lei 6.404/1976 (sociedades por ações) e a Res. CFC 1.418/2012; não confirmei se sustentam o prazo. Validar.'),
      R('c_lalur', 'livro de apuração do lucro real (LALUR) e declarações (IRPJ, ECF)', 'O documento chama o LALUR de "Livro de Apuração do ICMS": o LALUR é do lucro real (IRPJ/CSLL).'),
      R('c_retImp', 'comprovantes de retenção de tributos (IR, PIS, COFINS, CSLL) e recibos de serviço', 'Referência: 5 anos.'),
      R('c_fisco', 'correspondência com o fisco (ofícios, intimações) e relatórios de fiscalização', 'Referência: 5 anos após resolução. O documento escreve "SPD"; o sistema é o SPED.'),
      R('c_contratos', 'contratos de prestação de serviços contábeis', 'Referência: vigência + 5 anos. O documento cita "CC art. 205", que é o prazo geral de prescrição de 10 anos; os prazos específicos estão no art. 206. Validar.'),
      R('c_propostas', 'propostas, orçamentos e correspondência comercial', 'Referência: 3 anos. Validar o prazo de prescrição aplicável.'),
      R('c_operCont', 'termos e contratos com operadores e fornecedores', 'Referência: vigência + 5 anos. O documento cita LGPD arts. 28 e 32, que não se aplicam aqui (art. 28 foi vetado; art. 32 trata de órgãos públicos).')
    ] },
    { id: 'r3', titulo: '3. Prazos trabalhistas e previdenciários', itens: [
      R('c_folha', 'folha de pagamento, recibos e contratos de trabalho', 'Referência: durante o vínculo + 5 anos após a rescisão. As citações do documento (CLT arts. 226, 227 e 192) não tratam de guarda. Validar com contador trabalhista (prescrição e obrigações previdenciárias).'),
      R('c_ponto', 'cartão de ponto e registros de jornada', 'Referência: 5 anos. Validar fundamento (o art. 74 da CLT trata do registro, não fixa o prazo).'),
      R('c_admissao', 'documentos de admissão, rescisão e homologações', 'Referência: 5 anos após a rescisão.'),
      R('c_fgts', 'comprovantes do FGTS', 'Referência: vínculo + 5 anos. Validar com a legislação do FGTS.'),
      R('c_saude', 'documentação de saúde ocupacional e CAT', 'Referência do documento: 20 anos após o acidente. A regra de saúde ocupacional costuma contar 20 anos a partir do desligamento do empregado (NR-7). O documento cita "NR-5 (ABNT NBR ISO/IEC 27001)", combinação sem sentido. Validar com médico do trabalho.'),
      R('c_esocial', 'registros do eSocial', 'Referência do documento sem fundamento confirmado (cita Lei 12.997/2014). Validar.')
    ] },
    { id: 'r4', titulo: '4. Dados pessoais de clientes, funcionários e terceiros', itens: [
      R('c_ident', 'identificação do cliente (CPF, RG, nascimento)', 'Referência: contrato + 5 anos. O documento cita "LGPD art. 17 (direito de exclusão)"; a eliminação está nos arts. 15, 16 e 18, VI.'),
      R('c_contato', 'contato do cliente (email, telefone, endereço)', 'Referência: contrato + 1 ano. O documento cita LGPD art. 14 (crianças) e a Lei 10.871/2004, que não tratam disso.'),
      R('c_banc', 'dados bancários e de pagamento de clientes', 'Referência: contrato + 2 anos após o último pagamento. O Marco Civil (Lei 12.965/2014) tratado como base não se aplica a dados bancários.'),
      R('c_terc', 'dados de terceiros não clientes (cônjuges, sócios, representantes) citados em documentos', 'Referência: acompanha a documentação original.'),
      R('c_func', 'dados pessoais e de contato de funcionários', 'Referência: vínculo + 5 anos (dados de admissão) e + 2 anos (email, telefone, endereço). O documento cita "LGPD art. 7º, II" para contrato de trabalho; o inciso II é obrigação legal e o de contrato é o V.'),
      G('c_credito', 'O escritório confirmou que não trata histórico de crédito e score de clientes (o documento diz que não se aplica a contabilidade)?', '', true)
    ] },
    { id: 'r5', titulo: '5. Eliminação, armazenamento seguro e rastreabilidade', itens: [
      G('c_elimina', 'Dados que cumpriram o prazo são eliminados, salvo hipótese de conservação do art. 16 (obrigação legal, estudo, transferência a terceiro, uso exclusivo anonimizado)?', 'Arts. 15 e 16 da LGPD.', true),
      G('c_metodo', 'Há método de destruição irreversível definido para digital (apagamento seguro) e papel (trituração)?', 'Seção de métodos não veio.', true),
      G('c_regDesc', 'Cada descarte é registrado (o quê, quando, quem, método) e arquivado?', 'O objetivo do documento menciona "rastreabilidade completa"; a seção não veio.', true),
      G('c_bkp', 'Backups seguem o mesmo prazo dos dados originais?', '', true),
      G('c_operDev', 'Ao fim do contrato, operadores devolvem ou eliminam os dados e emitem comprovante?', '', true),
      G('c_hold', 'A eliminação é suspensa quando há litígio, fiscalização ou pedido de autoridade sobre aqueles dados?', '', true),
      G('c_rotina', 'Há rotina periódica (ao menos anual) de varredura de dados vencidos em servidores, nuvem, email e papel?', '', true),
      G('c_titEl', 'Pedidos de eliminação de titulares são analisados considerando os prazos legais de guarda?', 'Ver "Direitos dos Titulares".', true)
    ] }
  ],
  alertas: d => {
    const a = [];
    if (d.c_pol === 'Não conforme') a.push('Sem política escrita de retenção e descarte.');
    if (d.c_tabela === 'Não conforme') a.push('Sem tabela de retenção por tipo de dado.');
    if (d.c_elimina === 'Não conforme') a.push('Dados vencidos não são eliminados.');
    if (d.c_regDesc === 'Não conforme') a.push('Descartes sem registro: não há como provar a eliminação.');
    if (d.c_bkp === 'Não conforme') a.push('Backups guardados além do prazo dos dados originais.');
    if (d.c_saude === 'Não conforme') a.push('Prazo de guarda de saúde ocupacional não definido.');
    return a;
  },
  referencia: `
    <h3>Para que serve</h3>
    <p>Garante que cada tipo de dado tenha prazo de guarda com fundamento e que o que venceu seja eliminado de forma segura e comprovada. Reter além do necessário e eliminar o que a lei manda guardar são riscos.</p>
    <h3>O que a LGPD diz (resumo)</h3>
    <ul><li>Art. 15: o tratamento termina quando a finalidade é cumprida, o dado deixa de ser necessário, o titular revoga o consentimento ou a ANPD determina.</li>
    <li>Art. 16: após o término, os dados são eliminados, salvo conservação para obrigação legal, estudo, transferência a terceiro ou uso exclusivo anonimizado.</li></ul>
    <h3>Notas de revisão do documento original</h3>
    <p><b>Os prazos ficaram como referência e precisam de validação jurídica.</b> Itens que não foram copiados como estão:</p>
    <ul>
      <li><b>"Livro de Apuração do ICMS (LALUR)"</b>: LALUR é o Livro de Apuração do Lucro Real. "SPD" é SPED.</li>
      <li><b>CLT arts. 226, 227 e 192</b>, e <b>"Lei 12.997/2014"</b> para eSocial: não tratam de guarda de documentos trabalhistas.</li>
      <li><b>"NR-5 (ABNT NBR ISO/IEC 27001)"</b>: NR-5 é CIPA; ISO 27001 é segurança da informação. A regra de 20 anos para saúde ocupacional costuma ser contada do desligamento (NR-7), não do acidente.</li>
      <li><b>"CC art. 205"</b> com prazo de 3 anos: o art. 205 é o prazo geral de 10 anos; os prazos específicos estão no art. 206.</li>
      <li><b>LGPD arts. 14, 17, 28 e 32</b> como fundamento de retenção: art. 14 trata de crianças; art. 17 afirma os direitos fundamentais (a eliminação está nos arts. 15, 16 e 18, VI); art. 28 foi vetado; art. 32 trata de órgãos públicos.</li>
      <li><b>"LGPD art. 7º, II (contrato de trabalho)"</b>: o inciso II é obrigação legal; o de contrato é o V.</li>
      <li><b>Marco Civil (Lei 12.965/2014)</b> e <b>"Lei do Telemarketing (Lei 10.871/2004)"</b> como base de retenção de dados bancários e de contato: não se aplicam.</li>
      <li><b>Prazo fiscal de 5 anos</b>: coerente com o CTN (art. 195, parágrafo único), mas a contagem exata (a partir de quando) deve ser validada.</li>
      <li><b>Texto incompleto</b>: o arquivo termina na seção 2.5. Armazenamento seguro, métodos de descarte, rastreabilidade e papéis não vieram.</li>
    </ul>`
};
