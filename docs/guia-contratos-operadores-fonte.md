Contratos e Operadores

**Guia de Conformidade LGPD para Escritório de Contabilidade**

Documento de Referência --- 2026

📋 Sumário Executivo

Este documento estabelece os procedimentos e requisitos para registro, gestão e conformidade de **contratos com operadores de dados** (fornecedores, prestadores de serviço, plataformas em nuvem) que processam dados pessoais em nome do escritório de contabilidade.

A Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) exige que o **controlador de dados** (o escritório) mantenha documentação clara e formal com todos os **operadores** que manipulam dados pessoais. Este guia fornece:

-   Informações obrigatórias a registrar em cada contrato;

-   Estrutura de dados para operadores;

-   Cláusulas essenciais de conformidade;

-   Direitos, obrigações e responsabilidades;

-   Procedimentos de término e exclusão de dados;

-   Templates de checklist para auditoria interna.

1\. Conceitos Fundamentais

1.1 O que é um Operador de Dados?

Um **operador de dados** é qualquer pessoa jurídica ou física que **processa dados pessoais em nome do controlador**, sem ter autonomia de decisão sobre o processamento. Exemplos em um escritório de contabilidade:

-   **Fornecedores de software:** sistemas de contabilidade em nuvem, ERP, gestão de documentos;

-   **Provedores de nuvem:** AWS, Microsoft Azure, Google Cloud (hospedagem de servidores);

-   **Serviços de backup e disaster recovery;**

-   **Consultores e auditores externos;**

-   **Contadores terceirizados ou filiais;**

-   **Prestadores de serviço de limpeza/manutenção** (com acesso físico a dados);

-   **Empresas de segurança** (CFTV, vigilância);

-   **Fornecedores de serviços de assinatura digital;**

-   **Plataformas de e-mail corporativo;**

-   **Agências de marketing/comunicação** (se usarem dados pessoais de clientes).

1.2 Diferença: Controlador vs. Operador

  ---------------------------- ---------------------------------------------------- ----------------------------------------------------
  Característica               Controlador                                          Operador

  **Quem é?**                  O escritório de contabilidade                        Fornecedor, plataforma, terceiro

  **Responsabilidade**         Define QUAIS dados, PARA QUÊ, COMO processar         Processa conforme instruções do controlador

  **Autonomia**                Autônoma para decisões                               Nenhuma autonomia; segue contrato

  **Documentação**             Cria política de privacidade, mapeamento de riscos   Assina contrato de operador (Termo de Contrato)

  **Responsabilidade Legal**   Integral (LGPD Art. 2, inciso I)                     Conjunta, mas subordinada ao controlador (Art. 28)
  ---------------------------- ---------------------------------------------------- ----------------------------------------------------

2\. Seção 1: Informações Obrigatórias em Contratos

2.1 Dados Essenciais do Operador

Todo contrato com um operador **DEVE conter as seguintes informações**, registradas e mantidas em arquivo (físico ou digital):

  ------------------------------------- ----------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------ --------------------------------------------------
  Campo Obrigatório                     Descrição Detalhada                                                                       Exemplo                                                                              Por quê é crítico?

  **Nome/Razão Social Completa**        Identificação legal completa do operador                                                  Cloudtech Brasil Soluções Ltda.                                                      Base para rastreabilidade e ação legal

  **Tipo de Pessoa**                    Jurídica (empresa) ou Física (PJ/CPF)                                                     Jurídica                                                                             Define responsabilidade e contato legal

  **CNPJ ou CPF**                       Documento fiscal de identificação                                                         12.345.678/0001-90                                                                   Comply com RFB e rastreamento legal

  **Endereço Completo**                 Sede / Filial onde os dados são processados                                               Av. Paulista, 1000, São Paulo, SP                                                    Jurisdição aplicável para auditoria e incidentes

  **Telefone e E-mail de Contato**      Gerente de conta responsável pelo relacionamento                                          +55 11 3000-0000 / gerente@cloudtech.com.br                                          Comunicação rápida em caso de incidente (72h)

  **Responsável Legal/Representante**   Nome completo de quem assina o contrato (CEO, Diretor, etc.)                              João Silva Santos                                                                    Define quem é legalmente responsável

  **Descrição Detalhada do Serviço**    O quê exatamente o operador faz (p.ex., \'hospedagem de servidor com backups diários\')   Plataforma de nuvem para armazenamento de arquivos contábeis com backup automático   Define escopo do processamento

  **Tipo de Operador**                  Classificação (software, nuvem, consultoria, limpeza, segurança, etc.)                    Fornecedor de Plataforma em Nuvem                                                    Facilita categorização de risco
  ------------------------------------- ----------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------ --------------------------------------------------

2.2 Dados Pessoais Processados (Inventário)

O contrato **DEVE especificar EXATAMENTE QUAIS dados pessoais** são processados pelo operador:

  -------------------------- ----------------------------------------------------------- ------------------------------------- -----------------------------
  Categoria de Dado          Exemplos                                                    Sensível?                             Registrar no Contrato?

  **Dados de Cliente**       CPF, nome, endereço, telefone, e-mail, dados bancários      Sim (dados financeiros)               Sim, especificar cada campo

  **Dados de Funcionário**   CPF, CTPS, dados bancários, endereço, histórico funcional   Sim (dados de contrato de trabalho)   Sim, especificar cada campo

  **Dados Fiscais/IRPF**     CPF, renda, deduções, patrimônio                            Sim (dados financeiros e fiscais)     Sim, especificar cada campo

  **Dados de Fornecedor**    CNPJ, nome responsável, dados bancários                     Não (em geral)                        Sim, mas com menor rigor

  **Metadados de Acesso**    IP, timestamps de login, atividades realizadas              Não (rastreamento técnico)            Sim, menção clara
  -------------------------- ----------------------------------------------------------- ------------------------------------- -----------------------------

**⚠️ Boas Práticas:**

Crie um anexo ao contrato chamado

**\'Inventário de Dados Processados\'**

que lista cada campo e sua classificação (público, interno, confidencial, sensível). Atualize este anexo sempre que novos dados forem incluídos.

2.3 Tipo de Processamento

Especifique que tipo de operação o operador realiza com os dados:

-   **Armazenamento:** guarda dados em servidor próprio ou nuvem;

-   **Análise/Processamento:** processa dados para gerar relatórios, cálculos, insights;

-   **Transmissão:** envia dados para outros sistemas (integrações);

-   **Backup:** cria cópias de segurança;

-   **Limpeza/Exclusão:** remove dados conforme instruções;

-   **Compartilhamento:** envia dados a terceiros (ex: fisco, bancos);

-   **Acesso Administrativo:** gerencia infraestrutura mas não vê dados pessoais diretamente;

-   **Auditoria/Conformidade:** revisa dados para fins de compliance.

**Exemplo de registro:**\'O operador realiza armazenamento em nuvem (AWS região São Paulo), backup automático diário e transmissão segura via API para sistema de folha de pagamento.\'

2.4 Localização Geográfica dos Dados

A LGPD exige clareza sobre **onde os dados serão armazenados e processados**:

  ---------------------------------------------- ---------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------
  Localização                                    Conformidade LGPD                                    Ação Requerida

  **Brasil (Servidor Local)**                    ✅ Conforme --- sem restrição                        Apenas registre no contrato

  **Nuvem Brasil (AWS/Azure/GCP - região BR)**   ✅ Conforme --- dados fisicamente no Brasil          Apenas registre no contrato

  **Nuvem Internacional (US, EU, etc.)**         ⚠️ Permitida, mas exige autorização expressa         Mencione no termo de consentimento ao cliente; contrato com operador deve incluir cláusula de transferência internacional

  **Múltiplas Regiões (Replicação Global)**      ⚠️ Risco maior --- dados duplicados fora do Brasil   Documento explícito de autorização; auditoria regular do operador
  ---------------------------------------------- ---------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------

**⚠️ Atenção:**

Se usar operador com servidores no exterior, o contrato DEVE incluir cláusula explicando este fato aos clientes finais (título/clientes da contabilidade) e obter consentimento deles para transferência internacional de dados.

2.5 Prazos de Retenção de Dados

O contrato **DEVE especificar por quanto tempo** cada tipo de dado será retido:

  ------------------------------------------ --------------------------------- ------------------------------------ -----------------------------------------------------
  Tipo de Dado                               Prazo Recomendado                 Embasamento Legal                    Observação

  **Dados Contábeis / Livros Fiscais**       5 anos                            Lei 8.383/1991 (Código Tributário)   Após encerramento do contrato, retenção obrigatória

  **Dados de Folha de Pagamento / RH**       2 anos                            CLT Art. 29                          Mínimo legal; recomenda-se 5 anos

  **Dados de Cliente (após encerramento)**   2 anos                            Prática corporativa / LGPD Art. 14   Pode variar conforme contrato com cliente

  **Backups de Segurança**                   Mesmo prazo dos dados originais   Alinhado com legislação tributária   Destruição certificada após expiração

  **Logs de Auditoria / Acesso**                                                                                    
  ------------------------------------------ --------------------------------- ------------------------------------ -----------------------------------------------------
