# Camada segura (Cloud Functions) — v2.33.0

A partir da v2.33.0, o navegador **só lê** registros, versões, evidências e auditoria. Toda gravação
crítica passa por Cloud Functions v2 (`functions/`, Node.js 22, região `southamerica-east1`), que
confere no servidor: login, perfil ativo, papel, vínculo com a contabilidade, formato e limites dos
dados. Nome, papel, `userId`, versão e horários vêm do token e do perfil no Firestore, nunca do
navegador. As regras (`firestore.rules`, `storage.rules`) bloqueiam a escrita direta.

## Functions

| Function | Quem | O que faz (tudo numa transação, com auditoria) |
|---|---|---|
| `saveRecord` | Edição (vinculado), Admin | Cria registro + versão 1, ou edita: lê a versão atual e cria exatamente a próxima. Aceita `versaoBase` para recusar edição sobre versão desatualizada. |
| `restoreRecordVersion` | Edição, Admin | Restaura o conteúdo de uma versão antiga **como nova versão**; o histórico não muda. |
| `approveRecord` | Admin | Aprova a versão atual (precisa ser a que o admin viu); horário do servidor. |
| `softDeleteRecord` | Admin | Exclusão lógica (`restaurar: true` desfaz). |
| `hardDeleteRecord` | Admin | Exclusão permanente de registro já excluído logicamente; apaga versões; a auditoria fica. |
| `reserveEvidence` | Edição, Admin | Reserva o envio: gera `evidenceId`, caminho, autor, tamanho, tipo, vínculo opcional com registro/item; estado `pending`; validade de 30 min; até 20 reservas abertas por pessoa. |
| `finalizeEvidence` | autor da reserva | Confere no Storage existência, caminho, tamanho, tipo e assinatura do conteúdo; marca `ready`, cria o metadado e audita. Arquivo recusado é apagado. |
| `cancelEvidenceReservation` | autor da reserva | Desiste de uma reserva pendente (o app chama quando o upload falha). |
| `reuseEvidence` | Edição, Admin | Usa um arquivo pronto em outro item do checklist. |
| `deleteEvidence` | Admin | Apaga metadado + (se for o último uso) documento do arquivo e objeto do Storage. |
| `cleanupEvidence` | agendada (1 h) | Remove reservas vencidas e objetos órfãos (mais de 24 h sem documento e sem metadado). |
| `adminCleanupEvidence` | Admin | A mesma limpeza sob demanda (Configurações › Backup). |
| `logEvent` | conforme a ação | Eventos que acontecem no navegador, lista fechada: Login, Logout (um por sessão), Exportação CSV, Backup exportado, Backup completo, Redefinição de senha enviada. O detalhe é montado no servidor. |
| `adminSaveUser`, `adminSetUserActive`, `adminRemoveUser` | Admin / Admin local | Perfis e vínculos; o administrador local só administra usuários comuns vinculados às suas contabilidades. |
| `adminSaveContabilidade`, `adminDeleteContabilidade`, `adminRestoreContabilidade` | Admin | Contabilidades. |
| `adminCategorias` | Admin | Adicionar, remover (confere uso em todas as contabilidades) e completar categorias. |
| `adminMigrateLegacy` | Admin | Migração idempotente dos dados antigos (abaixo). |
| `getDiagnosticConfig`, `saveDiagnosticConfig` | Admin / Admin local | Lê e versiona configuração global ou específica da contabilidade; controles globais obrigatórios não podem ser alterados localmente. |
| `refreshActionPlan`, `getActionPlan`, `completeActionTask` | usuário vinculado | Valida respostas no servidor, gera tarefas condicionais idempotentes, preserva tarefas concluídas e registra histórico. |

### Auditoria
- Lista fechada de ações em `functions/src/audit.js` (`ACOES`), cada uma com seu escopo:
  **sistema** → `auditoria/{id}`; **contabilidade** → `contabilidades/{cid}/auditoria/{id}`.
- Esquema fixo: `ts, userId, user, role, acao, recId, recTitulo, detalhe, escopo, contabId, fonte`
  (tamanhos limitados; `fonte: 'servidor'` distingue os eventos novos dos gravados pelo navegador até a v2.32).
- Ninguém grava, edita ou apaga eventos pelo app.

### Diagnóstico configurável e planos
Configuração global: `config/diagnostico` e `config/diagnostico/versoes/{n}`.
Configuração da contabilidade: `contabilidades/{cid}/configDiagnostico/atual` e a subcoleção
`versoes`. Os planos ficam em `contabilidades/{cid}/planosAcao/{recordId}` e suas versões em
`versoes`. Recomendações que deixam de se aplicar são marcadas como `obsoleta`; tarefas concluídas
não são reabertas automaticamente.

## Modelo de dados — mudanças
- Novo: `contabilidades/{cid}/evidenciasArquivos/{evidenceId}` — o arquivo (`status: pending|ready`, `path`,
  `autorId`, `contentType`, `tamanho`, `expiraEm`…). Só o servidor lê e grava; o `storage.rules` o consulta.
- `contabilidades/{cid}/evidencias/{id}` ganha `arquivoId`.
- Eventos de auditoria ganham `fonte`.
- `_sistema/limpezaEvidencias`: cursor da limpeza (só servidor).
- Registros e versões **não mudam de formato**.

## Pré-requisitos (uma vez)
1. **Plano Blaze** (o projeto já usa, por causa do Storage). Cloud Functions, Cloud Build, Artifact Registry,
   Cloud Run, Eventarc, Cloud Scheduler e Pub/Sub são ativados pelo próprio `firebase deploy` na primeira vez.
   O uso esperado fica dentro da cota gratuita, mas mantenha o alerta de orçamento.
2. **Quem publica** precisa do papel *Proprietário* ou *Firebase Admin* + *Service Account User*
   no projeto (`npx firebase login`).
3. **Conta de serviço das Functions** (padrão do Compute Engine, `<número>-compute@developer.gserviceaccount.com`):
   costuma ter *Editor*. Se a organização removeu esse papel, conceda: *Cloud Datastore User*,
   *Storage Object Admin* (no bucket das evidências) e *Firebase Authentication Admin*.
4. **Chamada pública das Functions**: o deploy libera `allUsers` como invocador do Cloud Run (a
   autenticação é verificada dentro de cada Function). Se uma política de organização
   (*Domain restricted sharing*) bloquear isso, o deploy avisa e é preciso abrir exceção.
5. **Storage consultando o Firestore**: no primeiro deploy do `storage.rules`, aceite a permissão pedida
   (o mesmo de antes).
6. O bucket das evidências está em `functions/.env.lgpdsan` (`EVIDENCIAS_BUCKET`), igual ao `storageBucket` de
   `assets/firebase-config.js`. Não é segredo.

Nenhuma credencial entra no repositório; os testes usam o projeto `demo-lgpdsan`, que só existe nos emuladores.

## Comandos
Instalar dependências (Node 22 e Java 21+ para os emuladores):
```
npm ci
npm ci --prefix functions
```
Testes (sobem Auth, Firestore, Storage e Functions nos emuladores, rodam e desligam):
```
npm test
```
App local de ponta a ponta (dois terminais):
```
npm run emulators                       # projeto lgpdsan, tudo emulado
python3 -m http.server                  # abra http://localhost:8000/?emulador=1
~/lgpdsan-venv/bin/python scripts/dev_seed.py   # usuário admin de teste
```
Publicar (nesta ordem — ver "Migração"):
```
npx firebase login
npx firebase deploy --project lgpdsan --only functions
npx firebase deploy --project lgpdsan --only firestore:indexes
npx firebase deploy --project lgpdsan --only firestore:rules,storage
```
O deploy de índices pode perguntar se apaga índices que existem no console e não estão em
`firestore.indexes.json`: responda **Não**, a menos que saiba que não são usados.

## Migração (dados existentes)
Os registros, versões e auditoria antigos continuam válidos. A ordem evita janela de quebra:
1. `deploy --only functions` e `firestore:indexes`.
2. Publicar o app (GitHub Pages) com a v2.33.0. Com as regras antigas ainda no ar, o app novo já funciona.
3. Entrar como Administrador › Configurações › **Backup** › **Migrar dados legados**. Isso cria o documento
   `evidenciasArquivos` (pronto) de cada evidência antiga — sem ele, o novo `storage.rules` não serve o arquivo — e
   lista registros cuja versão atual não está em `versoes/` (efeito da falha antiga; nada é alterado neles).
   Pode ser executado de novo sem efeito colateral.
4. `deploy --only firestore:rules,storage`. A partir daqui, a versão antiga do app (cache) não grava mais:
   peça para recarregarem a página.

Para voltar atrás: republicar as regras e o app da v2.32.0 (as Functions podem ficar no ar).

## Decisões de produto pendentes
- **Registros sem a versão atual no histórico** (listados na migração): recriar o snapshot faltante a partir do registro
  ou só sinalizar? Hoje só sinalizamos.
- **Eventos antigos de auditoria** (gravados pelo navegador, sem `fonte`): mantidos como estão. Marcar na tela como
  "não verificados" é uma opção.
- **Redefinição de senha**: o e-mail sai do Firebase Auth pelo navegador, e o servidor só registra o evento (o
  administrador poderia registrar um envio que não fez). Gerar o link no servidor exige um serviço de e-mail próprio.
- **Bloquear usuário** continua só no Firestore (o login funciona, mas o app nega tudo). Desabilitar também no
  Authentication e revogar sessões é uma mudança simples, mas altera o comportamento atual.
- **Links de download** (`getDownloadURL`) continuam sendo links com token: quem tem o link abre o arquivo enquanto
  ele existir. Trocar por leitura autenticada (`getBlob`) exige configurar CORS no bucket.
- O `.docx` original de Contratos e Operadores (`biblioteca/contratos-e-operadores.docx`) ainda traz o texto antigo
  sobre transferência internacional; só o `.html` e a fonte `.md` foram corrigidos.
