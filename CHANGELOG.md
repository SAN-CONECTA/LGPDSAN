# Changelog
Formato SemVer.

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
