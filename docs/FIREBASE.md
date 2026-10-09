# Configuração do Firebase (projeto `lgpdsan`)

## Modelo de dados (Firestore, região southamerica-east1)
- `users/{uid}`: nome, email, role (`consulta`|`edicao`|`admin`), ativo, contabilidades [ids], criado
- `config/app`: lista (categorias, compartilhada)
- `auditoria/{id}`: eventos do SISTEMA (login, usuários, contabilidades, categorias). Só admin lê.
- `contabilidades/{cid}`: nome, criado
  - `pessoas/{uid}`: nome (alimenta o campo Responsável)
  - `registros/{id}`: snap{titulo,categoria,descricao,status,prioridade,responsavel,prazo,evidencias}, versao, deleted, criado, criadoPor, atualizado
    - `versoes/{n}`: n, snap, autor, autorId, quando, just (imutável)
  - `auditoria/{id}`: ts, userId, user, role, acao, recId, recTitulo, detalhe, escopo=`registro`, contabId (só criação)

Isolamento: o caminho `contabilidades/{cid}/...` + `cid in users/{uid}.contabilidades` nas regras. Administrador acessa todas.

## Checklist de ativação
1. Firestore → Regras → colar o conteúdo de `firestore.rules` → Publicar.
2. Authentication → Modelos (Templates) → Redefinição de senha → idioma Português (Brasil).
3. Restringir a chave de API: console.cloud.google.com → APIs e serviços → Credenciais → "Browser key" →
   Restrições de aplicativo: Sites (referenciadores HTTP) → `https://lgpd.sanconecta.com/*` e `https://san-conecta.github.io/*` (e `http://localhost:*` se testar local).
4. Primeiro administrador: documento `users/{UID do Authentication}` com nome, email, role=`admin`, ativo=true (admin não precisa do campo contabilidades).
4b. No app: Contabilidades → criar (ex.: Contabilidade 01, 02…) → Usuários → vincular cada usuário às suas contabilidades.
5. Testar em Firestore → Regras → Playground (ver casos abaixo).

## Casos para o Playground de regras
| Quem | Operação | Esperado |
|---|---|---|
| sem login | get registros/x | negado |
| consulta | create registros/x | negado |
| usuário da Contabilidade 01 | get contabilidades/<id da 02>/registros/x | negado |
| usuário da Contabilidade 01 | create em contabilidades/<id da 02>/registros/x | negado |
| edicao | list users | negado |
| edicao | update registro com versao != atual+1 | negado |
| edicao | update registro Arquivado | negado |
| edicao | delete registros/x | negado |
| qualquer | update/delete em qualquer auditoria | negado |
| admin | delete registros/x | permitido |

## Observações
- A chave `apiKey` do app web é pública por desenho; a proteção é feita pelas regras e pela restrição de domínio.
- Remover acesso de um usuário apaga só `users/{uid}`; a conta de login continua no Authentication.
- Sem Cloud Functions. O menu Evidências usa o Firebase Storage (seção abaixo), que exige o plano Blaze.

## Domínio próprio (lgpd.sanconecta.com)
1. DNS de `sanconecta.com`: registro **CNAME**, nome `lgpd`, valor `san-conecta.github.io`.
2. GitHub → repositório LGPDSAN → Settings → Pages → Custom domain `lgpd.sanconecta.com` (o arquivo `CNAME` do repositório já traz o domínio) → após o certificado, marcar **Enforce HTTPS**.
3. Firebase Console → Authentication → Settings → **Authorized domains** → adicionar `lgpd.sanconecta.com`.
4. Google Cloud → Credenciais → chave de API → referenciadores HTTP: adicionar `https://lgpd.sanconecta.com/*`.

## Evidências (Firebase Storage) — v2.15.0
O menu **Evidências** guarda os arquivos no Storage e os dados (categoria, descrição, autor, data) no Firestore.
1. Firebase Console → **Upgrade** para o plano **Blaze** (exige cartão; há cota gratuita mensal). Em seguida, em Orçamentos e alertas (Google Cloud → Faturamento), crie um alerta de valor baixo (ex.: R$ 20) para ser avisado se algo sair do esperado.
2. Build → **Storage** → Começar. Escolha o local `southamerica-east1` (São Paulo) e o modo de produção. O bucket deve ser o de `storageBucket` em `assets/firebase-config.js`.
3. Storage → aba **Regras** → colar o conteúdo de `storage.rules` → **Publicar**. Se pedir permissão para o Storage consultar o Firestore, aceite: as regras usam o perfil do usuário.
4. Firestore → **Regras** → colar o `firestore.rules` atualizado (nova seção `evidencias`) → Publicar.
5. Teste: Administrador envia um PDF, abre e exclui; Edição envia; Consulta só abre; usuário de outra contabilidade não vê.

Tipos aceitos: PDF, TXT, DOCX, JPG, PNG, WEBP, até 10 MB (fotos acima de 2 MB são reduzidas). O backup exportado traz só os dados das evidências; os arquivos continuam no Storage.
