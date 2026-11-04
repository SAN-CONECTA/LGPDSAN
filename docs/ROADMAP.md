# Roadmap e backlog (para o Projeto GitHub "LGPDSAN")

> A especificação recebida (.docx) termina na seção 3.5. As seções 4–12 (versionamento, auditoria, telas,
> arquitetura, segurança, fluxos, MVP, roadmap, custos) não vieram no arquivo. O backlog abaixo é uma proposta
> a ser reconciliada quando o texto completo existir.

## v1.0 (entregue) — protótipo estático, ver CHANGELOG
## v1.1 — ajustes de uso
- [ ] Revisar textos/campos com o escritório (feedback de uso real)
- [ ] Modelos de registro por categoria (ROPA, resposta a titular, incidente)
## v2.0 — backend real (ENTREGUE em 2026-10-06; itens abaixo = o que ficou de fora)
- [ ] Escolher stack (ex.: Supabase/Postgres com RLS, ou API própria) e região de hospedagem no Brasil
- [ ] Autenticação real (e-mail+senha com MFA), sessões, recuperação de senha
- [ ] Permissões aplicadas no servidor (RLS) conforme matriz da seção 3.5
- [x] Auditoria imutável no servidor — **parcial (2026-11-04)**: login falho e alteração de permissões gravados por Cloud Functions (Admin SDK), eventos imutáveis por regra, diff estruturado e origem técnica na tela. Ainda falta:
  - [ ] Exportação contínua para Cloud Logging/BigQuery (retenção fora do Firestore)
  - [ ] Alertas (rajada de login falho, mudança de permissão, leitura em massa)
  - [ ] Encadeamento de hash (tamper-evidence) entre eventos
  - [ ] Registrar a sincronização `anpd-sync` no log do sistema
  - [ ] Retenção automática/anonimização do IP (hoje é procedimento manual; ver `docs/FIREBASE.md`)
- [ ] Upload seguro de anexos com classificação de acesso
- [ ] Retenção e backup automáticos
## v2.1+
- [ ] Notificações por e-mail (prazos, atribuições)
- [ ] Links de compartilhamento temporários
- [ ] Exportação PDF/XLSX nativa e relatórios executivos
## Pontos da especificação a decidir
- Consulta "exporta relatórios" (3.2) vs. matriz/tabela 2.2 (exportar só Edição/Admin). v1.0: Consulta só imprime.
- Edição "visualiza logs completos" (3.3) vs. matriz ("✅" sem restrição). v1.0: completo.
