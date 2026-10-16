# Mapeamento Redesign → Código Atual (Issue #13)

> Fonte: PDFs exportados do Figma (`LGPDSAN — Redesign.pdf` = mockup visual; `(1)` = design system; `(2)` = mapa de telas atual).
> Estado atual levantado de `assets/app.js`, `assets/style.css` e `firestore.rules` (v2.31.0).

## Escopo da Fase 1

Telas destacadas no mapa (PDF 3): **Login, Painel, Registros, Registro (detalhe)**.

---

## 1. Estrutura de navegação (menu lateral)

| Grupo | Redesign (PDF 2) | Atual (`GRUPOS` em app.js) | Divergência |
|---|---|---|---|
| CONTABILIDADE | Seletor da contabilidade + Painel, Registros, Evidências, Termo de Ciência | *Não existe* — as 4 telas ficam soltas no topo, acima dos grupos | **Criar grupo** e mover as 4 telas para dentro, com o seletor no topo |
| CONTROLE | Auditoria, Usuários, Contabilidades | Igual | Nenhuma |
| APRENDIZADO | Atualizações ANPD (contador), Biblioteca, Manual, Manual da LGPD | Igual | Nenhuma (contador já existe) |
| CONFIGURAÇÕES | Categorias, Backup, Sobre / versão | Igual | Nenhuma |

**Ação:** adicionar o grupo `['contabilidade', 'Contabilidade', ...]` e mover Painel/Registros/Evidências/Termo para ele. O seletor de contabilidade (`contabSelector()`) passa a viver dentro desse grupo.

---

## 2. Barra superior (top bar) — NOVA

O redesign introduz uma barra superior que **não existe** hoje:

| Elemento | Redesign | Atual | Ação |
|---|---|---|---|
| Breadcrumb | "Contabilidade Exemplo Ltda / Painel" | Sem breadcrumb global | Criar |
| Busca global | "Buscar registros, evidências e eventos…" | Busca só por tela (Registros, Auditoria, ANPD) | Criar busca global |
| Sino da ANPD | Ícone com contador de não lidas | Contador só no item do menu | Criar sino (link p/ `#/anpd`) |

**Ação:** implementar top bar com esses 3 elementos (fase 1: painel/registros/detalhe).

---

## 3. Design system (componentes — PDF 2)

| Componente | Especificação do redesign | Atual (style.css) | Divergência |
|---|---|---|---|
| **Ícones** | Lucide, 20 px, traço 1,75; via slot "Ícone" nos componentes | Emoji/símbolos ou sem ícone | **Adotar Lucide** (dependência nova) |
| **Botão** | Primário (ação principal), Perigo (excluir), Fantasma (discreto em tabelas) | `.btn` único + variantes pontuais | Criar variantes `.btn.primary` / `.btn.danger` / `.btn.ghost` |
| **Tag** | Mapeia `.tag / .tag.ok / .warn / .bad / .brand` | **Já existe** (linhas 62–66) | Refino visual apenas |
| **Campo** | Rótulo acima, caixa de 40 px; Texto, Seleção, Busca | `input`/`select` padrão | Padronizar altura 40 px + estilos |
| **Item de menu** | Ativo = rota atual; contador p/ ANPD | Existe, sem estado "ativo" claro | Reforçar estado ativo |
| **Card de métrica** | Cor do número sinaliza: Atenção (revisões/sem aprovação) e Crítico (prazos vencidos) | Cards existem; cor parcial | Aplicar cor semântica ao número |
| **Aviso** | Faixa `.notice` ("versão alterada depois da aprovação") | **Já existe** (linhas 67–68) | Refino visual |
| **Avatar** | Iniciais do usuário (menu, auditoria, responsável) | Existe em alguns pontos | Padronizar |
| **Item do checklist** | Respostas: Conforme / Parcial / Não conforme / N/A / Não avaliado | Existe | Confirmar 5 estados |

---

## 4. Matriz tela a tela (Fase 1)

### Login (`renderLogin`)
| Redesign | Atual | Divergência |
|---|---|---|
| Duas colunas: hero à esquerda (logo, tagline "Conformidade LGPD do escritório, registrada e auditável", 4 bullets de confiança, aviso "Acesso restrito…") + formulário à direita | Card centralizado (`max-width:420px`) | **Layout 2 colunas** |
| Rodapé "v2.31.0 · www.sanconecta.com" + "Dados no Firestore, região São Paulo" | Rodapé simples | Adicionar linha de região |

### Painel (`renderDash`)
| Redesign | Atual | Divergência |
|---|---|---|
| 6 cards de métrica: Registros ativos, Em vigor, Em revisão, Prazos vencidos, Revisões em 30 dias, Em vigor sem aprovação | Métricas semelhantes | Cor semântica no número + reorganizar |
| Seção "Atualizações ANPD · 3 novas" com 4–5 itens + "Ver todas" | Existe | Refino visual |
| Tabela "Registros" (Status / Prazo / Responsável) | Existe | Refino visual |
| "Atividade recente" (feed) | Existe | Refino visual |
| "Trilha de adequação" (9 categorias com barra de progresso e % ) | Existe | Refino visual (barras + %) |

### Registros (`renderList`)
| Redesign | Atual | Divergência |
|---|---|---|
| Busca + filtros; colunas status/prioridade/responsável/prazo/checklist/versão; criar/exportar CSV | **Já implementado** | Fase 1: aplicar componentes (botão fantasma, campo 40 px, tags) |

### Registro — detalhe (`renderReg` / `#/registro/:cid/:id`)
| Redesign | Atual | Divergência |
|---|---|---|
| Checklist do guia (5 estados), versões (comparar/restaurar), auditoria do registro; aprovar/excluir/restaurar = Admin | **Já implementado** | Fase 1: aplicar componentes + aviso `.notice` de versão alterada |

---

## 5. Resumo das ações (ordem sugerida)

1. **Tokens/design system (#14)**: definir tokens (cores, raio, tipografia, espaçamento) e aplicar às classes existentes (`.btn`, `.tag`, `.notice`, `.card`, inputs 40 px) + Lucide.
2. **Menu + top bar (#15)**: grupo CONTABILIDADE + breadcrumb + busca global + sino ANPD.
3. **Painel (#16)**: métricas com cor semântica, seções refinadas.
4. **Login + Registros/detalhe (#15/#17)**: layout 2 colunas + componentes.
5. **Responsividade/acessibilidade (#19)** e **paridade + publicar (#20)** por último.

> Observação: o PDF 2 já dá o mapeamento componente→classe CSS, o que reduz a #13 a uma lista de divergências acionáveis. A extração dos **valores exatos de cor/espaçamento/raio** (hex, px) é o insumo da #14 — requer leitura visual das imagens (ou preenchimento manual no Figma).
