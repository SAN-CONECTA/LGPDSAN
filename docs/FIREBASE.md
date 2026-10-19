# Configuração do Firebase (projeto `lgpdsan`)

## Modelo de dados (Firestore, região southamerica-east1)
- `users/{uid}`: nome, email, role (`consulta`|`edicao`|`admin`), ativo, contabilidades [ids], criado
- `config/app`: lista (categorias, compartilhada)
- `auditoria/{id}`: log de acessos e eventos do SISTEMA. Em cada login/logout bem-sucedido, grava data/hora, `userId`, nome, e-mail e perfil; também reúne eventos de usuários, contabilidades e categorias. Só admin lê; os eventos são imutáveis.
- `presencas/{uid}`: sinal temporário de presença (nome, e-mail, perfil e `lastSeen`). Cada usuário só renova o próprio sinal; Administrador pode listar os usuários online.
- `anpd/{pubId}`: publicações oficiais da ANPD (url, titulo, descricao, data, fonte, criadoEm, atualizadoEm). Só leitura para usuários; escrita pelo serviço de sincronização (Admin SDK).
  - `users/{uid}/anpdLidas/{pubId}`: status de leitura por usuário (quando). Cada usuário lê e grava apenas o próprio.
- `contabilidades/{cid}`: nome, criado
  - `pessoas/{uid}`: nome (alimenta o campo Responsável)
  - `registros/{id}`: snap{titulo,categoria,descricao,status,prioridade,responsavel,prazo,evidencias}, versao, deleted, criado, criadoPor, atualizado
    - `versoes/{n}`: n, snap, autor, autorId, quando, just (imutável)
  - `auditoria/{id}`: ts, userId, user, userEmail, role, acao, recId, recTitulo, detalhe, escopo=`registro`, contabId (só criação)

Isolamento: o caminho `contabilidades/{cid}/...` + `cid in users/{uid}.contabilidades` nas regras. Administrador acessa todas.

## Checklist de ativação
1. Firestore → Regras → colar o conteúdo de `firestore.rules` → Publicar.
2. Authentication → Modelos (Templates) → Redefinição de senha → idioma Português (Brasil).
3. Restringir a chave de API: console.cloud.google.com → APIs e serviços → Credenciais → "Browser key" →
   Restrições de aplicativo: Sites (referenciadores HTTP) → `https://lgpd.sanconecta.com/*` e `https://san-conecta.github.io/*` (e `http://localhost:*` se testar local).
4. Primeiro administrador: documento `users/{UID do Authentication}` com nome, email, role=`admin`, ativo=true (admin não precisa do campo contabilidades).
4b. No app: Contabilidades → criar (ex.: Contabilidade 01, 02…) → Usuários → vincular cada usuário às suas contabilidades.
5. Testar em Firestore → Regras → Playground (ver casos abaixo).

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
O `firebase.json` configura os emuladores de **Auth** (9099) e **Firestore** (8080). Assim dá para
testar a Central ANPD (e o app todo) sem tocar no projeto de produção nem precisar de credenciais.

Pré-requisitos (uma vez):
```
npm install -g firebase-tools            # ou: npm install --prefix ~/.local firebase-tools
python3 -m venv ~/lgpdsan-venv && ~/lgpdsan-venv/bin/pip install firebase-admin pytest
```

Subir os emuladores (terminal dedicado):
```
firebase emulators:start --project lgpdsan --only firestore,auth
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
`connectFirestoreEmulator`/`connectAuthEmulator`). Sem ele, o app usa o projeto real. O `firestore.rules`
é carregado no emulador, então a permissão de leitura da coleção `anpd` e de `anpdLidas` também é testada.

Importante: o projectId dos emuladores deve bater com `assets/firebase-config.js` (`lgpdsan`) — o
`"singleProjectMode": false` no `firebase.json` evita o conflito caso o emulador seja iniciado com outro projeto.
