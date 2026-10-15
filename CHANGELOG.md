# Changelog
Formato SemVer.

## [2.29.0] - 2026-10-15
### Adicionado
- **Central de Atualizações ANPD** (menu Aprendizado): publicações oficiais de gov.br/anpd, sincronizadas a cada 6 horas por GitHub Actions (`scripts/anpd_sync.py`) para o Firestore, sem duplicatas (id do documento = SHA-256 da URL). Pesquisa, filtro "somente não lidas", marcação de lida/não lida individual por usuário e botão "marcar todas como lidas"
- Contador de não lidas no menu e cartão "Atualizações ANPD" no Painel com as 5 publicações mais recentes
- Status de leitura por usuário em `users/{uid}/anpdLidas`; as publicações oficiais são imutáveis pelo app
- Testes automatizados: `scripts/test_anpd_sync.py` (parsing, whitelist de URL, dedupe) e `scripts/test_anpd_js.mjs` (helpers da tela)
### Alterado
- `firestore.rules`: nova coleção `anpd` (leitura para usuários ativos; escrita só pelo serviço de sincronização, via Admin SDK, que ignora as regras) e subcoleção `anpdLidas` por usuário. **Publique as regras de novo**
### Observações
- O RSS oficial da ANPD (gov.br/anpd/RSS) está em manutenção; a sincronização coleta a página de notícias (frontend Volto com renderização no servidor). Captura as notícias mais recentes a cada execução e acumula o histórico sem apagar nada
- Push via Firebase Cloud Messaging foi avaliado e adiado: exigiria service worker, chave VAPID e consentimento por usuário (ver docs/FIREBASE.md)

## [2.28.1] - 2026-10-14
### Adicionado
- Auditoria e Eventos do sistema: **filtro por coluna** logo abaixo do cabeçalho. Usuário, Contabilidade e Ação têm lista com os valores existentes; Quando, Registro e Detalhe filtram por texto. Os filtros se combinam e valem para os eventos já carregados; a busca geral da Auditoria continua

## [2.28.0] - 2026-10-14
### Alterado
- Auditoria e Eventos do sistema: sem limite de histórico na tela. Carregam 200 eventos (do mais recente para o mais antigo) e o botão **Carregar mais 200** busca os seguintes, até o fim. O contador mostra quantos estão carregados. O filtro de texto vale só para os eventos já carregados
- Nada muda no armazenamento: os eventos sempre ficaram todos no banco (as regras continuam impedindo editar ou apagar). Sem alteração em `firestore.rules`

## [2.27.0] - 2026-10-14
### Adicionado
- Temas de cor: Azul, Lilás, Rosa, Laranja, Verde, Grafite, Escuro azulado e Escuro lilás, além de Automático, Claro e Escuro. Trocam a cor de destaque (botões, item ativo do menu) e dão um leve tom ao fundo
### Atenção
- `firestore.rules` mudou: a regra de preferência de tema agora aceita os novos valores. **Publique as regras de novo**; sem isso a escolha de cor vale só no navegador onde foi feita (o sistema não dá erro)

## [2.26.0] - 2026-10-14
### Alterado
- Menu lateral reorganizado em **grupos recolhíveis** (clique no título abre/fecha; o grupo da tela atual abre sozinho): **Controle** (Auditoria, Usuários, Contabilidades), **Aprendizado** (Biblioteca, Manual) e **Configurações** (Categorias, Backup, Sobre / versão). Painel, Registros, Evidências e Termo de Ciência seguem soltos
- Usuários, Contabilidades, Categorias e Backup continuam só para o Administrador; grupo sem itens permitidos não aparece. Os endereços das telas não mudaram
- Consolida as entradas 2.25.0 e 2.25.1 (não publicadas separadamente)

## [2.25.1] - 2026-10-14
### Alterado
- Configurações: Categorias, Backup e Sobre / versão passam a ficar **abaixo do botão Configurações, no próprio menu lateral** (sempre visíveis, com o item atual destacado). A barra de abas no topo da página foi removida

## [2.25.0] - 2026-10-13
### Alterado
- Menu lateral: novo botão **Configurações**, com três abas: Categorias, Backup e Sobre / versão. Categorias e Backup continuam só para o Administrador; os demais perfis veem apenas Sobre / versão. As rotas antigas (`#/categorias`, `#/backup`, `#/sobre`) continuam funcionando

## [2.24.0] - 2026-10-13
### Adicionado
- **Governança e Políticas: seção "1. Diagnóstico do enquadramento"** antes do encarregado: porte, Simples, natureza jurídica, limite de receita, grupo econômico, volume de titulares, dados sensíveis, tecnologia nova, monitoramento, decisões automatizadas e exigência contratual do cliente, com **resultado sugerido** calculado na tela
- **Situação do encarregado** (nomeado interno/externo/empresa, dispensado com responsável pelo canal, ainda não definido), com nome, cargo, vínculo e contato público
- Cadastro da contabilidade: **porte, Simples e natureza jurídica** preenchidos pela consulta ao CNPJ (editáveis, com data da consulta); alimentam o diagnóstico
- Itens com regra de aplicação (`aplica`): quando o encarregado é dispensado, designação, conflito de interesses e independência contam como N/A (saem da nota e dos alertas) e entra o item do canal de atendimento ao titular
### Alterado
- `c_porte` e `c_altoRisco` unificados em `c_enq` ("avaliação de enquadramento registrada"); o resultado de alto risco deixa de gerar alerta de "não verificado"
- Seções de Governança renumeradas (1 a 6). Registros antigos de Governança perdem apenas o campo livre "Encarregado: nome e contato" (agora são campos separados)
- Sem mudança nas regras do Firestore

## [2.23.0] - 2026-10-13
### Adicionado
- **Trilha de adequação** no Painel: as categorias na ordem sugerida por dependência (Governança, Mapeamento, Segurança, Incidentes, Contratos, Retenção, Direitos dos Titulares, Email, Treinamento), com situação (Não iniciada / Em andamento / Em vigor), nº de registros, % declarado médio e destaque do **próximo passo**
### Alterado
- Listas de categorias (Registros, Evidências, filtros) seguem a mesma ordem, em vez de alfabética; categorias criadas pelo administrador ficam ao final. A ordem é uma sugestão, não exigência da LGPD

## [2.22.6] - 2026-10-13
### Alterado
- Contabilidades: a coluna "Usuários vinculados" agora lista o **nome** e o perfil de cada usuário ativo vinculado (administradores não aparecem, pois acessam todas)

## [2.22.5] - 2026-10-13
### Adicionado
- Auditoria: coluna **Contabilidade** (eventos do sistema aparecem como "Sistema") e busca também por contabilidade. A auditoria dentro de um registro não ganha a coluna

## [2.22.4] - 2026-10-13
### Alterado
- Checklist: **barra fixa** no topo (não sai da tela ao rolar) com o resumo das respostas e o ⓘ da legenda completa
- Opções do dropdown agora trazem texto curto (ex.: "Conforme — faço e consigo mostrar"); o valor gravado não muda. Textos editáveis em `RESP_DICA` (app.js)

## [2.22.3] - 2026-10-13
### Adicionado
- **Legenda geral das respostas** (ⓘ no título do checklist, no formulário e na visão do registro): significado de Não avaliado, Conforme, Parcial, Não conforme e N/A e como cada uma entra na nota (Declarado e Comprovado). As perguntas com legenda própria continuam com a delas

## [2.22.2] - 2026-10-13
### Corrigido
- Legendas "Como responder" das perguntas do inventário de dados e da atualização do anexo (Contratos e Operadores, item 2) não traziam a regra do N/A. Acrescentadas, no mesmo estilo da pergunta de dados sensíveis

## [2.22.1] - 2026-10-13
### Corrigido
- Legenda "Como responder" (ⓘ): dentro da janela de edição do registro o quadro abria atrás da janela e ficava ilegível. Agora abre na frente, e a tecla Esc fecha só o quadro (não a janela de edição)

## [2.22.0] - 2026-10-13
### Adicionado
- **Legenda "Como responder"** nas perguntas do checklist: ícone ⓘ ao lado do título que abre um quadro com o significado de cada resposta para aquela pergunta. Abre ao passar o mouse (computador), ao clicar/tocar (celular) e pelo teclado; fecha com clique fora ou Esc. Aparece no formulário e na visão do registro; não sai na impressão
- Legendas escritas para as três perguntas do item "2. Dados pessoais processados" de Contratos e Operadores (inventário de dados, atualização do anexo, dados sensíveis). Outras perguntas e categorias ganham legenda adicionando o campo `legenda` ao item do guia
- Manual: parágrafo sobre o ícone ⓘ no capítulo do checklist

## [2.21.2] - 2026-10-09
### Corrigido
- Endereço vindo da consulta de CNPJ: espaços repetidos (comuns no complemento cadastrado na Receita) são reduzidos a um

## [2.21.1] - 2026-10-09
### Corrigido
- Consulta de CNPJ: a mensagem de falha agora diz o motivo (HTTP 429/5xx, bloqueio de rede/extensão/CORS, sem resposta em 8 s) e há uma segunda fonte (CNPJ.ws) quando a BrasilAPI falha. A mensagem de sucesso informa qual fonte respondeu. "Sobre" atualizado

## [2.21.0] - 2026-10-09
### Adicionado
- **Dados do escritório no cadastro de Contabilidades** (Administrador): razão social, CNPJ (validado, com preenchimento de razão social e endereço pela BrasilAPI), endereço e canal de privacidade. Alteração registrada na auditoria
- **Termo de Ciência** puxa sozinho os dados do escritório do cadastro; ganhou linhas de endereço (empregador e escritório) e o CNPJ do empregador preenche razão social e endereço
### Alterado
- firestore.rules: limites de tamanho para os novos campos da contabilidade (`razaoSocial`, `cnpj`, `endereco`, `canalPrivacidade`). Opcional publicar para a v2.21.0 funcionar (as regras anteriores já aceitavam campos extras), mas recomendado

## [2.20.0] - 2026-10-09
### Adicionado
- **Preenchimento por CNPJ** no checklist de Contratos e Operadores: com um CNPJ válido (dígitos verificadores conferidos), consulta a BrasilAPI (dados públicos da Receita Federal) e preenche razão social, endereço e tipo de pessoa. Só preenche campos vazios ou preenchidos antes automaticamente; avisa situação cadastral diferente de Ativa e empresário individual/MEI; falha de rede não bloqueia o preenchimento manual
### Observação de privacidade
- Primeira chamada externa do sistema: apenas o CNPJ digitado é enviado à BrasilAPI. Registrado em "Sobre" e no Manual

## [2.19.0] - 2026-10-09
### Adicionado
- **Termo de Ciência** (menu lateral, todos os perfis): modelo de termo sobre tratamento e compartilhamento de dados pessoais de empregados (folha de pagamento, obrigações trabalhistas e eSocial). Campos que preenchem o texto na hora, texto editável e impressão limpa (campos em branco saem como linhas, com aviso antes)
- Capítulo "Termo de Ciência" no Manual
### Decisão
- O termo preenchido **não é salvo** no sistema (nem no banco, nem no navegador): nome e CPF de empregados de clientes só existem na tela e na impressão. O termo assinado fica em papel/na pasta do cliente

## [2.18.0] - 2026-10-09
### Adicionado
- **Manual do usuário** dentro do sistema (menu "Manual", para todos os perfis): perfis de acesso, primeiros passos, Painel, Registros, checklist Declarado x Comprovado, Evidências, revisão e aprovação, administração, backup e auditoria, rotina sugerida, limites conhecidos e perguntas frequentes. Índice no topo e botão para imprimir. O texto fica em `manual.html`
### Alterado
- Título do menu e da tela de login: apenas "Conformidade LGPD" (sem o prefixo "LGPDSAN ·")

## [2.16.0] - 2026-10-09
### Adicionado
- **Próxima revisão** em cada registro (política, contrato, treinamento, avaliação de fornecedor). Painel e lista destacam revisões vencidas ou nos próximos 30 dias; ao marcar "Em vigor" sem data, sugere 12 meses
- **Aprovação formal**: o Administrador aprova a versão atual (grava quem, quando e qual versão). Registro editado depois aparece como "alterado após aprovação" até nova aprovação. Painel lista os registros "Em vigor sem aprovação atual"
- CSV traz as colunas "Próxima revisão" e "Aprovação"; auditoria registra "Versão aprovada"
### Alterado
- firestore.rules: só o Administrador grava a aprovação (com o próprio nome, a versão em gravação e a hora do servidor); Edição não consegue alterá-la; campo opcional `revisao`
- Decisão: editar um registro aprovado NÃO muda o status sozinho (mudar o status criaria nova versão e novo pedido de aprovação, em ciclo). O sinal é a etiqueta e o alerta no Painel

## [2.17.0] - 2026-10-09
### Adicionado
- Evidência: "Reaproveitar um arquivo já enviado" no botão + Evidência (um mesmo contrato comprova vários itens sem novo upload). Excluir uma evidência só apaga o arquivo do Storage quando nenhum outro item o usa
### Alterado
- O envio de arquivo agora falha em cerca de 30 s, com mensagem clara (regras não publicadas, Storage desativado, sem permissão), em vez de ficar parado em 0%
- Estágio do controle aparece só quando a resposta é Conforme ou Parcial
- firestore.rules: o caminho do arquivo da evidência pode apontar para qualquer arquivo da mesma contabilidade (necessário ao reaproveitamento)
### Corrigido
- `storage.rules`: removido `firestore.exists()`, que o Storage não aceita (causava `storage/unauthorized`)

## [correção em storage.rules - incorporada na 2.17.0]
- `storage.rules`: removido `firestore.exists()` (o simulador do Storage acusou "Function not found"); o perfil inativo ou inexistente continua negado, pois `firestore.get()` falha nesse caso

## [2.15.0] - 2026-10-09
Resposta ao relatório de análise (seção 6): a plataforma passa a distinguir o que foi declarado do que foi comprovado.
### Adicionado
- Evidência por item do checklist: botão "+ Evidência" na tela do registro (arquivo e descrição); as evidências aparecem no item e na tela Evidências, com o item de origem
- Estágio do controle (Redigido, Implantado, Testado) nos itens críticos
- Pontuação em duas barras: **Declarado** e **Comprovado** (Conforme + evidência; nos críticos, também Implantado ou Testado), com aviso de itens "Conforme" sem prova
- Lista de Registros mostra Decl. e Comp.; página Sobre explica os critérios de cálculo
### Alterado
- O percentual agora é ponderado: itens críticos pesam 2 e Parcial vale 0,5 (antes: só a proporção de Conforme). Os números de registros existentes mudam
- firestore.rules: limite de campos do checklist passou de 80 para 250 (o guia de Governança já podia passar de 80) e campos opcionais de vínculo da evidência
- Texto de "Limitações conhecidas" atualizado (a plataforma agora tem upload)

## [2.14.0] - 2026-10-08
### Adicionado
- Menu **Evidências**: envio de PDF, TXT, DOCX, JPG, PNG e WEBP (até 10 MB) por categoria, com descrição, autor e data; filtro por categoria; abrir pelo navegador; exclusão só pelo administrador
- Fotos acima de 2 MB são reduzidas automaticamente; o conteúdo do arquivo é conferido contra a extensão
- Auditoria registra "Evidência enviada" e "Evidência excluída"; o backup JSON inclui os dados das evidências (os arquivos ficam no Storage)
- `storage.rules` (novo) e seção `evidencias` em `firestore.rules`
### Requisito
- Firebase Storage exige o plano Blaze. Veja docs/FIREBASE.md ("Evidências")

## [2.13.1] - 2026-10-08
### Alterado
- Checklist do registro: as seções abrem minimizadas (clique no título para expandir), deixando a tela mais limpa

## [2.13.0] - 2026-10-07
### Adicionado
- Tema claro, escuro ou automático (do sistema), escolhido por cada usuário em "Tema", na barra lateral. A escolha é aplicada a cada login, guardada no perfil do usuário (campo `tema`) e neste navegador
- Impressão de relatórios sempre em tema claro
### Alterado
- firestore.rules: cada usuário pode alterar somente o próprio campo `tema` do perfil. Opcional: sem republicar as regras, a escolha fica guardada só no navegador usado (por usuário)

## [2.12.1] - 2026-10-07
### Alterado
- Logo do escritório: antes de reduzir para no máximo 480×180 px, a imagem tem as margens vazias (transparentes ou quase brancas) recortadas automaticamente, para a marca não ficar pequena em arquivos quadrados com muito espaço em branco

## [2.12.0] - 2026-10-07
### Adicionado
- Logo do escritório: campo de upload em Contabilidades → Editar (PNG, JPG ou WEBP; reduzida automaticamente para até 480×180 px e guardada no documento da contabilidade, sem Storage), com pré-visualização e botão "Remover logo"
- A logo aparece no cabeçalho de Registros e no relatório impresso (cabeçalho com logo, nome do escritório e data de emissão) e como miniatura na lista de Contabilidades
- Auditoria do sistema: "Logo da contabilidade alterada" e "Logo da contabilidade removida"
### Alterado
- firestore.rules: limite de 300.000 caracteres para o campo `logo` da contabilidade (opcional: sem republicar as regras, tudo funciona; o limite de tamanho passa a valer no servidor quando elas forem publicadas)

## [2.11.1] - 2026-10-07
### Adicionado
- Domínio próprio: arquivo `CNAME` (lgpd.sanconecta.com) e passos de DNS/Firebase/chave de API em docs/FIREBASE.md
### Observações
- Configure o DNS antes de publicar este zip: com o `CNAME` no repositório e sem o DNS, o endereço antigo deixa de funcionar

## [2.11.0] - 2026-10-07
### Adicionado
- Contabilidades: botão "Editar" (nome, antes "Renomear") e botão "Excluir" com confirmação digitando o nome
- Excluir = desativar: a contabilidade some das listas e os usuários vinculados perdem o acesso, mas registros, versões e auditoria ficam guardados (a trilha de auditoria é imutável por regra). Seção "Excluídas" com botão "Restaurar"
- Eventos de auditoria do sistema: "Contabilidade excluída" e "Contabilidade restaurada"
- Backup completo passa a incluir contabilidades excluídas
### Observações
- As regras do Firestore não mudaram (exclusão definitiva continua bloqueada por `allow delete: if false`)

## [2.10.0] - 2026-10-07
### Adicionado
- Governança e Políticas: enquadramento como agente de pequeno porte (Res. CD/ANPD 2/2022) e verificação de alto risco; encarregado (ato formal de designação, conflito de interesses, autonomia; Res. 18/2024); resposta a ofícios da ANPD (responsável e registro); legítimo interesse em 4 etapas
- Mapeamento de Dados: avaliação da necessidade de RIPD, RIPD arquivado, data e revisão (art. 38)
- Etiqueta "boa prática" nos itens que são critério interno e não exigência legal (14 itens)
- Novos alertas nas categorias afetadas
### Observações
- Itens novos marcados como extra: artigos das resoluções precisam ser conferidos no texto oficial e validados por advogado

## [2.9.1] - 2026-10-07
### Alterado
- Removido o aviso fixo da página Biblioteca

## [2.9.0] - 2026-10-07
### Alterado
- Revisão das citações legais dos 9 documentos contra fontes oficiais: notas de ajuda e "Notas de revisão" atualizadas em Incidentes (Res. CD/ANPD 15/2024: arts. 5º, 6º, 9º, 10), Retenção e Descarte (CTN art. 195, Decreto 9.580 art. 278, NR-7 item 7.6.1.1, CC art. 206, Lei 13.787), Direitos (prazo em dobro para pequeno porte), Governança (alto risco afasta o regime de pequeno porte) e Treinamento (Res. 18/2024 não exige certificação)
- Aviso da Biblioteca: validação por advogado e contador continua pendente
### Observações
- Pontos não verificados (ex.: CLT arts. 192/226/478, Lei 8.212, Decreto 3.048 art. 225, LC 123 art. 26, efeito da LC 236/2026) estão listados no relatório de revisão

## [2.8.0] - 2026-10-07
### Adicionado
- Item "Biblioteca": os 9 documentos de referência em modo leitura, com download do .docx original e atalho para as Notas de revisão do checklist correspondente
### Observações
- Os arquivos em /biblioteca são publicados no GitHub Pages: a tela exige login, mas os arquivos em si são acessíveis a quem souber o endereço

## [2.7.0] - 2026-10-07
### Adicionado
- Checklists das categorias "Mapeamento de Dados", "Retenção e Descarte", "Segurança da Informação" e "Treinamento e Cultura"
### Observações
- Todos os documentos recebidos estão incompletos; o de Segurança tem só a introdução (itens quase todos extra). O de Incidentes reenviado é idêntico ao anterior
- Citações legais erradas do material (ex.: LALUR, CLT arts. 192/226, CC art. 205, LGPD arts. 14/17/28/32) listadas nas Notas de revisão; prazos de retenção ficam como referência para validação jurídica

## [2.6.0] - 2026-10-06
### Adicionado
- Checklist da categoria "Incidentes": definição e severidade, detecção, canais de reporte, plano de resposta, comunicação à ANPD/titulares, registro e seção de ocorrência para incidente real
### Observações
- Prazo "72h / Art. 33" do documento original corrigido (art. 48; 3 dias úteis, Res. CD/ANPD 15/2024); documento termina na seção 3.4

## [2.5.0] - 2026-10-06
### Adicionado
- Checklists das categorias "Direitos dos Titulares" (art. 18 e 19) e "Governança e Políticas" (papéis, comitê, princípios do art. 6º, bases legais do art. 7º)
### Observações
- Os dois documentos recebidos estão incompletos (Direitos termina na seção 2.1; Governança na 3.2); itens complementares marcados como extra
- Erros legais dos documentos corrigidos e listados nas Notas de revisão

## [2.4.0] - 2026-10-06
### Adicionado
- Categoria e checklist "Tratamento de Email" (política de email: retenção por tipo, bases legais, transparência, segurança, exclusão, incidentes)
- Admin recebe automaticamente categorias com guia que faltarem na lista
### Observações
- Citações legais do documento original corrigidas e registradas em "Notas de revisão"; o documento original termina na seção 3.5 (itens da seção 7 marcados como extra)

## [2.3.1] - 2026-10-06
### Corrigido
- Cache do navegador: arquivos agora carregam com `?v=versão`, então cada publicação aparece sem precisar limpar cache

## [2.3.0] - 2026-10-06
### Adicionado
- Checklist da categoria "Contratos e Operadores" dentro do registro (um registro por operador): identificação, dados processados, tipo de processamento, localização, retenção, incidentes
- Respostas Conforme / Parcial / Não conforme / N/A + observação, % de conformidade, pontos de atenção automáticos e coluna Checklist na lista
- Botão "Guia de referência" (com notas de revisão do guia original) ao filtrar a categoria
- Versionamento, comparação e auditoria também cobrem as respostas do checklist
### Alterado
- `firestore.rules`: campo `dados` do registro validado (**publicar novamente**)
### Notas
- Erros legais do guia original não foram copiados; ver "Notas de revisão" no guia de referência
- Itens marcados "extra" foram acrescentados pela equipe técnica e precisam de validação jurídica

## [2.2.0] - 2026-10-06
### Adicionado
- Multi-contabilidade com isolamento no servidor: registros, versões e auditoria ficam sob `contabilidades/{cid}`
- Cadastro de contabilidades (admin), seletor de contabilidade, vínculo de usuários a uma ou mais contabilidades
- Auditoria do sistema separada (somente administrador)
### Alterado
- Edição e Consulta não listam mais todos os usuários; o campo Responsável usa as pessoas da contabilidade
- Regras do Firestore reescritas (`firestore.rules`): **publicar novamente**
### Atenção
- Registros criados na v2.0/2.1 (coleção `registros` na raiz) ficam inacessíveis. Não havia registros reais.

## [2.1.0] - 2026-10-06
### Adicionado
- Logo da SAN Conecta no login, no menu lateral e como ícone da aba
- Link para www.sanconecta.com no login e na página Sobre
### Corrigido
- README: título "O que a v1.0 faz" -> "O que o sistema faz"

## [2.0.0] - 2026-10-06
### Adicionado
- Firebase Authentication (e-mail/senha) e Firestore (São Paulo) no lugar do localStorage
- `firestore.rules`: matriz de permissões, versões imutáveis e auditoria somente-criação aplicadas no servidor
- Novo usuário recebe e-mail para definir a própria senha; redefinição por e-mail
### Removido
- Contas de demonstração, importação de backup e reset local
### Atenção
- Dados da v1.0 (navegador) não são migrados.

## [1.0.0] - 2026-10-06
### Adicionado
- Login por perfil (Consulta, Edição, Administrador) com bloqueio após 5 falhas
- CRUD de registros com versionamento, diff e restauração
- Exclusão lógica/permanente e restauração (admin)
- Log de auditoria, usuários, categorias, backup JSON, exportação CSV
### Limitações
- Dados somente no navegador; sem upload, e-mail, PDF/Excel nativo
