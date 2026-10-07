# LGPDSAN — Plataforma Web LGPD para Escritório de Contabilidade

Registro, versionamento e auditoria de boas práticas de conformidade com a LGPD.
Publicação: https://san-conecta.github.io/LGPDSAN/

**Versão atual: 2.10.0** (Firebase Auth + Firestore, regras no servidor)

## O que o sistema faz
- Perfis: Consulta, Edição, Administrador (matriz da especificação, seção 3.5)
- Checklist por categoria (hoje: Contratos e Operadores), com % de conformidade e alertas
- Várias contabilidades (escritórios clientes) com isolamento de dados no servidor
- Registros com categoria, status, prioridade, responsável, prazo e evidências (links)
- Versionamento automático com justificativa obrigatória, comparação palavra a palavra e restauração (cria nova versão)
- Exclusão lógica, restauração e exclusão permanente (somente Administrador)
- Auditoria (Consulta vê apenas eventos de registros acessíveis)
- Usuários, categorias, backup/importação JSON, exportação CSV, impressão de relatório

## Segurança
Login pelo Firebase Authentication; permissões e auditoria aplicadas pelas Regras do Firestore (`firestore.rules`). Setup em `docs/FIREBASE.md`.
A v1.0 (localStorage) não deve ser usada com dados reais.

## Executar localmente
`python3 -m http.server` e abra http://localhost:8000 (módulos ES não funcionam via file://).

## Versionamento do sistema
SemVer (`MAIOR.MENOR.CORREÇÃO`). Mudanças em `CHANGELOG.md`; a constante `VERSION` fica em `assets/app.js`.
Cada release = tag `vX.Y.Z` + GitHub Release.

## Documentação
`docs/especificacao-fonte.md` (texto extraído do .docx) · `docs/ROADMAP.md` (backlog e issues sugeridas)


Desenvolvido por SAN Conecta — https://www.sanconecta.com

## Publicar uma nova versão
1. Suba os arquivos (GitHub: Add file → Upload files, arrastando o CONTEÚDO da pasta).
2. Se mudou `firestore.rules`, publique também no console do Firebase.
3. Na próxima versão, troque o número em `?v=` (index.html e imports de `assets/app.js`) e em `VERSION`; assim o navegador não usa arquivos antigos.
4. Confira a versão exibida no rodapé do menu lateral.
