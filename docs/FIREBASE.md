# Configuração do Firebase (projeto `lgpdsan`)

## Modelo de dados (Firestore, região southamerica-east1)
- `users/{uid}`: nome, email, role (`consulta`|`edicao`|`admin`), ativo, contabilidades [ids], criado
- `config/app`: lista (categorias, compartilhada)
- `auditoria/{id}`: eventos do SISTEMA (login, logout, usuários, contabilidades, categorias). Campos: `ts`, `userId`, `user`, `userEmail`, `role`, `acao`, `recId`, `recTitulo`, `detalhe` (≤500), `escopo=sistema`, `contabId` e, opcionalmente, `mudancas` (mapa `{campo:{de,para}}`, ≤20 campos). Eventos gravados pelo servidor trazem `origem=servidor`, `motivo`, `ip`, `userAgent` e, em `Permissão alterada`, `antes`/`depois` (`{role, ativo, contabilidades}`) e `alvoId`. Só admin lê; ninguém edita ou apaga.
- `rate_limit/{ipHash}`: contador do limite de login falho (SHA-256 do IP, `janela`, `contagem`, `expira`). Nenhum cliente lê ou escreve; TTL opcional em `expira`.
- `presencas/{uid}`: sinal temporário de presença (nome, e-mail, perfil e `lastSeen`). Cada usuário só renova o próprio sinal; Administrador pode listar os usuários online.
- `anpd/{pubId}`: publicações oficiais da ANPD (url, titulo, descricao, data, fonte, criadoEm, atualizadoEm). Só leitura para usuários; escrita pelo serviço de sincronização (Admin SDK).
  - `users/{uid}/anpdLidas/{pubId}`: status de leitura por usuário (quando). Cada usuário lê e grava apenas o próprio.
- `contabilidades/{cid}`: nome, criado
  - `pessoas/{uid}`: nome (alimenta o campo Responsável)
  - `registros/{id}`: snap{titulo,categoria,descricao,status,prioridade,responsavel,prazo,evidencias}, versao, deleted, criado, criadoPor, atualizado
    - `versoes/{n}`: n, snap, autor, autorId, quando, just (imutável)
  - `auditoria/{id}`: `ts`, `userId`, `user`, `userEmail`, `role`, `acao`, `recId`, `recTitulo`, `detalhe` (≤500), `escopo=registro`, `contabId`, `mudancas` opcional (≤20 campos). Só criação; edição/admin criam qualquer ação, Consulta só `Visualização de registro` e `Download de evidência`.

Isolamento: o caminho `contabilidades/{cid}/...` + `cid in users/{uid}.contabilidades` nas regras. Administrador acessa todas.

## Checklist de ativação
1. Firestore → Regras → colar o conteúdo de `firestore.rules` → Publicar.
2. Authentication → Modelos (Templates) → Redefinição de senha → idioma Português (Brasil).
3. Restringir a chave de API: console.cloud.google.com → APIs e serviços → Credenciais → "Browser key" →
   Restrições de aplicativo: Sites (referenciadores HTTP) → `https://lgpd.sanconecta.com/*` e `https://san-conecta.github.io/*` (e `http://localhost:*` se testar local).
4. Primeiro administrador: documento `users/{UID do Authentication}` com nome, email, role=`admin`, ativo=true (admin não precisa do campo contabilidades).
4b. No app: Contabilidades → criar (ex.: Contabilidade 01, 02…) → Usuários → vincular cada usuário às suas contabilidades.
5. Testar em Firestore → Regras → Playground (ver casos abaixo).
6. Publicar as Cloud Functions: `firebase deploy --only functions --project lgpdsan` (plano Blaze, `firebase-tools` ≥ 14).
7. Ativar o TTL de `rate_limit.expira` no console (seção "Retenção de dados pessoais na auditoria").

## Publicação automática das regras

O arquivo `firestore.rules` é publicado automaticamente pelo GitHub sempre que for alterado na
branch `main`. Assim, mudanças de regra feitas no código não exigem abrir o Console do Firebase.

Configuração única, feita por quem administra o projeto Firebase:

1. Criar uma **conta de serviço exclusiva** para esta automação no Google Cloud.
2. Dar somente o papel **Firebase Rules Admin** a essa conta.
3. Gerar e baixar uma chave JSON.
4. No GitHub do repositório: **Settings → Secrets and variables → Actions → New repository secret**.
5. Nome do segredo: `FIREBASE_RULES_DEPLOYER`.
6. Valor: o conteúdo completo da chave JSON (sem codificar em Base64).

Não reutilize a conta de serviço da sincronização ANPD: ela precisa apenas gravar publicações,
enquanto a conta das rules tem acesso administrativo às regras. As chaves nunca devem ser
enviadas por chat ou commitadas no repositório.

## Casos de teste das regras
Os casos de auditoria são cobertos automaticamente por `tests/rules/` (`npm test` dentro de `tests/rules`). Os demais podem ser conferidos no Playground do console.

### Registros e perfis
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
| admin | delete registros/x | permitido |

### Auditoria
| Quem | Operação | Esperado |
|---|---|---|
| edicao | create evento válido em `contabilidades/c1/auditoria` | permitido |
| edicao | create com `userId` de outro usuário | negado |
| edicao | create com `ts` do cliente (sem `serverTimestamp`) | negado |
| edicao / consulta / admin | update ou delete de evento | negado |
| consulta | create `Visualização de registro` | permitido |
| consulta | create `Download de evidência` | permitido |
| consulta | create `Edição` | negado |
| edição de c2 | create em `c1/auditoria` | negado |
| usuário inativo | create em `c1/auditoria` | negado |
| edicao | create com `origem`, `ip`, `userAgent`, `motivo`, `antes`, `depois` ou `alvoId` | negado |
| edicao | `detalhe` com 501 caracteres | negado |
| edicao | `detalhe` com 500 caracteres | permitido |
| edicao | `mudancas` com 21 chaves | negado |
| edicao | `mudancas` com 20 chaves | permitido |
| edicao | `mudancas` como texto | negado |
| admin | create `Login` em `auditoria` (sistema) | permitido |
| edicao | get `auditoria` (sistema) | negado |
| admin | get `auditoria` (sistema) | permitido |
| qualquer | read ou write em `rate_limit/*` | negado |

## Auditoria no servidor — Cloud Functions
A pasta `functions/` (Node 22, `firebase-functions` v2 / 7.4.0, `firebase-admin`) grava os eventos que o cliente não pode ou não deve gravar. As funções rodam em `southamerica-east1`, a mesma região do Firestore, e o app usa `getFunctions(app, 'southamerica-east1')`.

| Função | Tipo | O que faz |
|---|---|---|
| `registrarTentativaLogin` | `onCall` pública (sem login) | recebe `{ email, motivo }` (`senha-invalida`, `conta-inativa`, `usuario-inexistente`, `bloqueado`), limita e-mail a 254 e user-agent a 300 caracteres e grava `Login falhou` em `auditoria` com `escopo=sistema`, `origem=servidor`, `ip`, `userAgent` e `motivo`. Resposta sempre neutra (`{ok:true}`) e limite de 20 gravações por IP por hora, com contador em `rate_limit/{sha256(ip)}`. |
| `onUserWrite` | trigger `onDocumentWritten('users/{uid}')` | grava `Permissão alterada` com `antes`/`depois` (`role`, `ativo`, `contabilidades`) e `alvoId` quando esses campos mudam. O autor sai de `atualizadoPor`. Eventos criados/excluídos também geram o evento, com um dos lados nulo. |
| `atualizarUsuario` | `onCall` (exige admin ativo) | recebe `{ uid, nome, role, contabilidades, ativo }`, valida perfil (3 opções), até 200 contabilidades de texto e nome até 100 caracteres, e grava `atualizadoPor` com o uid do administrador autenticado. Impede o admin de se rebaixar ou se bloquear. |

Pré-requisitos e publicação:
- Plano **Blaze** (Cloud Functions de 2ª geração e Storage).
- `firebase-tools` **≥ 14** (a versão 13 quebra com `firebase-functions` v7; testado com 15.34.2). Node 22 no deploy (o Node 20 foi descontinuado em 2026-10-30).
- Publicar as funções **antes** do front-end que as usa:
  ```
  firebase deploy --only functions --project lgpdsan
  ```
- As regras do Firestore continuam valendo para o cliente; a Admin SDK usada pelas funções ignora as regras (por isso `origem=servidor`).

## Testes das regras (emulador)
`tests/rules/` tem um projeto Node próprio (não entra no build do site) com `@firebase/rules-unit-testing` e `firebase` 11.10.0:
```
cd tests/rules
npm install
npm test
```
O script sobe o emulador com `firebase emulators:exec --only firestore --project lgpdsan-test` e roda `node --test`. O CI (`.github/workflows/rules-test.yml`) executa o mesmo comando em Node 20 a cada mudança em `firestore.rules` ou `tests/rules/**`.

## Retenção de dados pessoais na auditoria
`ip` e `userAgent` são dados pessoais. Política adotada:
- Eventos com `ip` (tentativas de login falhas) são mantidos por **12 meses**. Depois disso, o IP deve ser anonimizado (`ip: null`), mantendo data, e-mail digitado e motivo para a trilha.
- A anonimização é uma operação administrativa (Admin SDK/console), porque a regra impede `update` no cliente; registre quem executou e quando.
- Backups exportados (`out.auditoria`, `out.auditoria_sistema`) contêm os mesmos campos e seguem a mesma retenção; trate-os como dado sensível.
- `rate_limit` é descartável: o campo `expira` é gravado uma hora após a janela. Passo a passo do TTL no console:
  1. Firebase Console → **Firestore Database** → aba **TTL** → **Criar política**.
  2. Coleção `rate_limit`, campo `expira` → **Criar**. A exclusão é feita em segundo plano (pode levar até 24 h).
  3. Opcional por linha de comando: `gcloud firestore fields ttls update expira --collection-group=rate_limit --enable-ttl`.
- Sem TTL, os documentos de `rate_limit` continuam válidos para o limite (a janela reinicia na próxima tentativa), mas ocupam espaço; o TTL é só limpeza.

## Observações
- A chave `apiKey` do app web é pública por desenho; a proteção é feita pelas regras e pela restrição de domínio.
- Remover acesso de um usuário apaga só `users/{uid}`; a conta de login continua no Authentication.
- As Cloud Functions (seção acima) gravam login falho e alterações de permissão e exigem o plano Blaze. O menu Evidências usa o Firebase Storage (seção abaixo), que também exige Blaze.
- Limitações conhecidas:
  - O autor (`atualizadoPor`) só é confiável quando a alteração passa por `atualizarUsuario`. Um administrador ainda consegue escrever direto em `users/{uid}` pelo SDK/console e as regras não mudaram nesta versão; nesse caminho o evento do trigger fica sem autoria verificável.
  - O cabeçalho `x-forwarded-for` pode ser forjado; o limite de 20 gravações por IP/hora é mitigação, não bloqueio absoluto.
  - `registrarTentativaLogin` é pública por desenho (é o caso de uso) e aceita e-mails arbitrários até 254 caracteres; o limite por IP contém o abuso.
  - Editar/excluir usuário no app agora depende da função publicada; sem ela a tela mostra erro de chamada.

## Domínio próprio (lgpd.sanconecta.com)
1. DNS de `sanconecta.com`: registro **CNAME**, nome `lgpd`, valor `san-conecta.github.io`.
2. GitHub → repositório LGPDSAN → Settings → Pages → Custom domain `lgpd.sanconecta.com` (o arquivo `CNAME` do repositório já traz o domínio) → após o certificado, marcar **Enforce HTTPS**.
3. Firebase Console → Authentication → Settings → **Authorized domains** → adicionar `lgpd.sanconecta.com`.
4. Google Cloud → Credenciais → chave de API → referenciadores HTTP: adicionar `https://lgpd.sanconecta.com/*`.

## Evidências (Firebase Storage) — v2.17.0
O menu **Evidências** guarda os arquivos no Storage e os dados (categoria, descrição, autor, data) no Firestore.
1. Firebase Console → **Upgrade** para o plano **Blaze** (exige cartão; há cota gratuita mensal). Em seguida, em Orçamentos e alertas (Google Cloud → Faturamento), crie um alerta de valor baixo (ex.: R$ 20) para ser avisado se algo sair do esperado.
2. Build → **Storage** → Começar. Escolha o local `southamerica-east1` (São Paulo) e o modo de produção. O bucket deve ser o de `storageBucket` em `assets/firebase-config.js`.
3. Storage → aba **Regras** → colar o conteúdo de `storage.rules` → **Publicar**. Se pedir permissão para o Storage consultar o Firestore, aceite: as regras usam o perfil do usuário.
4. Firestore → **Regras** → colar o `firestore.rules` atualizado (nova seção `evidencias`) → Publicar.
5. Teste: Administrador envia um PDF, abre e exclui; Edição envia; Consulta só abre; usuário de outra contabilidade não vê.

Tipos aceitos: PDF, TXT, DOCX, JPG, PNG, WEBP, até 10 MB (fotos acima de 2 MB são reduzidas). O backup exportado traz só os dados das evidências; os arquivos continuam no Storage.

## Central de Atualizações ANPD — v2.29.0
A tela **Atualizações ANPD** mostra publicações oficiais de gov.br/anpd. O conteúdo é sincronizado
por um GitHub Action a cada 6 horas (`.github/workflows/anpd-sync.yml`), que roda
`scripts/anpd_sync.py` e grava na coleção `anpd` usando a Admin SDK — que ignora as regras, então
os usuários do app não conseguem alterar o conteúdo oficial.

1. Publicar o `firestore.rules` atualizado (novas regras `anpd` e `anpdLidas`).
2. Criar uma conta de serviço para o Action:
   - console.cloud.google.com → IAM e administração → Contas de serviço → Criar.
   - Papel: **Cloud Datastore User** (acesso ao Firestore). Nada além disso.
   - Criar uma chave JSON e baixar.
3. No GitHub: Settings → Secrets and variables → Actions → New repository secret:
   - Nome recomendado: `FIREBASE_ANPD_SYNC`.
   - Valor: cole o conteúdo completo da chave JSON, puro — deve começar por `{`. Não codifique em base64.
   - Enquanto a conta exclusiva não é criada, o Action usa o secret `FIREBASE_RULES_DEPLOYER` já configurado.
4. O Action roda a cada 6 horas e também manualmente (aba Actions → "Sincronizar publicações da ANPD" → Run workflow).

Testes locais (sem gravar no Firestore):
```
python3 scripts/anpd_sync.py --dry-run
python3 -m pytest scripts/test_anpd_sync.py -q
node scripts/test_anpd_js.mjs
```

Observações:
- O RSS oficial (gov.br/anpd/RSS) está em manutenção; a sincronização coleta a página de notícias
  (frontend Volto com renderização no servidor) e captura as mais recentes a cada execução. Nunca
  apaga: só cria e atualiza. Uma falha de rede encerra com erro antes de qualquer escrita.
- Só URLs oficiais (host www.gov.br, caminho /anpd/) são gravadas; qualquer outra é descartada.
- Credenciais nunca entram no repositório (ficam no secret do GitHub; o `.gitignore` cobre arquivos de credencial).
- Push (Firebase Cloud Messaging) foi avaliado e adiado: exigiria service worker, chave VAPID e
  consentimento por usuário. O contador de não lidas no menu e no Painel cobre a necessidade atual.

## Testar localmente com o Emulator Suite (antes de subir para main)
O `firebase.json` configura os emuladores de **Auth** (9099), **Firestore** (8080) e **Functions** (5001). Assim dá para
testar o app e as funções sem tocar no projeto de produção nem precisar de credenciais.

Pré-requisitos (uma vez):
```
npm install -g firebase-tools@15        # exige >= 14 por causa do firebase-functions v7
python3 -m venv ~/lgpdsan-venv && ~/lgpdsan-venv/bin/pip install firebase-admin pytest
```
Node 20+ e Java 11+ (o emulador do Firestore é Java).

Subir os emuladores (terminal dedicado):
```
firebase emulators:start --project lgpdsan --only firestore,auth,functions
```

Semeia os dados locais (publicações ANPD reais + usuário admin de teste + uma contabilidade):
```
~/lgpdsan-venv/bin/python scripts/anpd_sync.py --emulator
~/lgpdsan-venv/bin/python scripts/dev_seed.py
```

Servir o app e abrir no navegador:
```
python3 -m http.server 8000
# abrir http://localhost:8000/?emulador=1  →  admin@teste.local / senha123
```

O parâmetro `?emulador=1` conecta o app aos emuladores (trecho opcional em `assets/app.js`,
`connectFirestoreEmulator`/`connectAuthEmulator`/`connectFunctionsEmulator`). Sem ele, o app usa o projeto real. O `firestore.rules`
é carregado no emulador, então as permissões da auditoria, da coleção `anpd` e de `anpdLidas` também são testadas.

Para rodar só os testes das regras (sem abrir o app):
```
cd tests/rules && npm test
```

Importante: o projectId dos emuladores deve bater com `assets/firebase-config.js` (`lgpdsan`) — o
`"singleProjectMode": false` no `firebase.json` evita o conflito caso o emulador seja iniciado com outro projeto.
