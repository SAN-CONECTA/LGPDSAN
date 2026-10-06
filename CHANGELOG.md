# Changelog
Formato SemVer.

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
