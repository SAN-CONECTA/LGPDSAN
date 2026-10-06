# Configuração do Firebase (projeto `lgpdsan`)

## Modelo de dados (Firestore, região southamerica-east1)
- `users/{uid}`: nome, email, role (`consulta`|`edicao`|`admin`), ativo, criado
- `config/app`: lista (categorias)
- `registros/{id}`: snap{titulo,categoria,descricao,status,prioridade,responsavel,prazo,evidencias}, versao, deleted, criado, criadoPor, atualizado
- `registros/{id}/versoes/{n}`: n, snap, autor, autorId, quando, just (imutável)
- `auditoria/{id}`: ts, userId, user, role, acao, recId, recTitulo, detalhe, escopo (`registro`|`sistema`) (só criação)

## Checklist de ativação
1. Firestore → Regras → colar o conteúdo de `firestore.rules` → Publicar.
2. Authentication → Modelos (Templates) → Redefinição de senha → idioma Português (Brasil).
3. Restringir a chave de API: console.cloud.google.com → APIs e serviços → Credenciais → "Browser key" →
   Restrições de aplicativo: Sites (referenciadores HTTP) → `https://san-conecta.github.io/*` (e `http://localhost:*` se testar local).
4. Primeiro administrador: documento `users/{UID do Authentication}` com nome, email, role=`admin`, ativo=true.
5. Testar em Firestore → Regras → Playground (ver casos abaixo).

## Casos para o Playground de regras
| Quem | Operação | Esperado |
|---|---|---|
| sem login | get registros/x | negado |
| consulta | create registros/x | negado |
| consulta | list auditoria sem filtro escopo | negado |
| edicao | update registro com versao != atual+1 | negado |
| edicao | update registro Arquivado | negado |
| edicao | delete registros/x | negado |
| qualquer | update/delete auditoria/x | negado |
| admin | delete registros/x | permitido |

## Observações
- A chave `apiKey` do app web é pública por desenho; a proteção é feita pelas regras e pela restrição de domínio.
- Remover acesso de um usuário apaga só `users/{uid}`; a conta de login continua no Authentication.
- Plano Spark: sem Cloud Functions e sem Storage; anexos continuam como links.
