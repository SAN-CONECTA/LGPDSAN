# LGPDSAN — Plataforma Web LGPD para Escritório de Contabilidade

Registro, versionamento e auditoria de boas práticas de conformidade com a LGPD.
Publicação: https://san-conecta.github.io/LGPDSAN/

**Versão atual: 1.0.0** (protótipo estático — ver limitações)

## O que a v1.0 faz
- Perfis: Consulta, Edição, Administrador (matriz da especificação, seção 3.5)
- Registros com categoria, status, prioridade, responsável, prazo e evidências (links)
- Versionamento automático com justificativa obrigatória, comparação palavra a palavra e restauração (cria nova versão)
- Exclusão lógica, restauração e exclusão permanente (somente Administrador)
- Auditoria (Consulta vê apenas eventos de registros acessíveis)
- Usuários, categorias, backup/importação JSON, exportação CSV, impressão de relatório

## Limitações (leia antes de usar)
Sem servidor, os dados ficam no `localStorage` do navegador e login/permissões são aplicados no cliente:
**não são segurança real. Não cadastre dados pessoais reais.** A v2.0 move isso para backend com autenticação.

## Executar localmente
Abra `index.html` ou `python3 -m http.server`. Contas demo estão na tela de login.

## Versionamento do sistema
SemVer (`MAIOR.MENOR.CORREÇÃO`). Mudanças em `CHANGELOG.md`; a constante `VERSION` fica em `assets/app.js`.
Cada release = tag `vX.Y.Z` + GitHub Release.

## Documentação
`docs/especificacao-fonte.md` (texto extraído do .docx) · `docs/ROADMAP.md` (backlog e issues sugeridas)
