#!/usr/bin/env python3
"""Sincroniza as publicações oficiais da ANPD (gov.br) para o Firestore.

Fonte: https://www.gov.br/anpd/pt-br/assuntos/noticias

O RSS oficial (https://www.gov.br/anpd/RSS) está fora do ar ("Estamos em
manutenção"). Este script coleta a própria página de notícias, que é um
frontend Volto (React) com renderização no servidor: os itens vêm embutidos em
`window.__data` dentro do HTML. A paginação do site é feita no navegador via
uma API `@search` que também está em manutenção, então o script captura a
primeira página (as ~25 notícias mais recentes). A cada execução, novidades
que entram no topo são gravadas; itens já gravados nunca são apagados, então o
histórico acumula no Firestore.

Garantias de segurança:
- Só grava URLs oficiais (host www.gov.br e caminho /anpd/). Qualquer outra
  URL é descartada.
- Nunca apaga registros: a sincronização só cria/atualiza. Uma falha de rede
  ou de parsing encerra com código != 0 ANTES de qualquer escrita.
- Sem duplicatas: o id do documento é o hash SHA-256 da URL canônica.
- Credenciais não ficam no repositório: o serviço de conta do Firebase chega
  por variável de ambiente (GOOGLE_APPLICATION_CREDENTIALS), injetada pelo
  GitHub Actions a partir de um secret.

Uso:
  python3 scripts/anpd_sync.py --dry-run          # busca, parseia e imprime (sem Firestore)
  python3 scripts/anpd_sync.py                    # grava no Firestore (precisa das credenciais)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime
from urllib.parse import urlparse

ANPD_NEWS_URL = "https://www.gov.br/anpd/pt-br/assuntos/noticias"
USER_AGENT = "LGPDSAN-sync/2.29.0 (+https://github.com/SAN-CONECTA/LGPDSAN)"
HTTP_TIMEOUT = 30
# A paginação (b_start) é ignorada pelo servidor hoje; manter o laço pronto para
# quando a API voltar. Com 1 página, capturamos as notícias mais recentes.
MAX_PAGES = 1

_JS_LITERALS = [
    (re.compile(r"\bundefined\b"), "null"),
    (re.compile(r"\bNaN\b"), "null"),
    (re.compile(r"\b-?Infinity\b"), "null"),
]


def fetch(url: str, timeout: int = HTTP_TIMEOUT) -> str:
    """Baixa a página e devolve o HTML. Lança exceção em qualquer falha."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status} em {url}")
        return resp.read().decode("utf-8", "replace")


def extract_window_data(html: str) -> dict:
    """Extrai e decodifica o objeto `window.__data` (estado SSR do Volto)."""
    m = re.search(r"window\.__data\s*=\s*(\{.*?\})\s*;?\s*</script>", html, re.S)
    if not m:
        raise RuntimeError("window.__data não encontrado na página (estrutura do site mudou?)")
    raw = m.group(1)
    for pattern, repl in _JS_LITERALS:
        raw = pattern.sub(repl, raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON de window.__data inválido: {exc}") from exc


def parse_items(data: dict) -> list[dict]:
    """Extrai os itens de notícia do estado SSR.

    Devolve uma lista de dicionários com url, titulo, descricao e dataDia.
    """
    try:
        content = data["reduxAsyncConnect"]["content"]
    except (KeyError, TypeError) as exc:
        raise RuntimeError("Estrutura reduxAsyncConnect.content ausente") from exc
    items = content.get("items") or []
    out = []
    for it in items:
        # A listagem mistura notícias com anexos (imagens de editais). Só interessam as notícias.
        if it.get("@type") != "News Item":
            continue
        url = (it.get("@id") or "").strip()
        titulo = (it.get("title") or "").strip()
        descricao = (it.get("description") or "").strip()
        effective = (it.get("effective") or "").strip()
        if not url or not titulo:
            continue
        out.append({
            "url": url,
            "titulo": titulo,
            "descricao": descricao,
            "dataDia": effective[:10] if effective else "",
        })
    return out


def is_anpd_url(url: str) -> bool:
    """Aceita apenas URLs oficiais da ANPD em www.gov.br."""
    try:
        p = urlparse(url)
    except ValueError:
        return False
    if p.scheme != "https":
        return False
    if p.hostname not in ("www.gov.br", "gov.br"):
        return False
    return p.path == "/anpd" or p.path.startswith("/anpd/")


def doc_id(url: str) -> str:
    """Id determinístico do documento = SHA-256 da URL (sem duplicatas)."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def normalize(items: list[dict]) -> tuple[list[dict], int]:
    """Deduplica por URL, descarta URLs não oficiais e ordena por data (desc).

    Devolve (lista_normalizada, quantidade_descartadas).
    """
    seen: dict[str, dict] = {}
    dropped = 0
    for it in items:
        url = it["url"]
        if not is_anpd_url(url):
            dropped += 1
            continue
        # em caso de duplicata, mantém a versão com mais texto
        if url not in seen or len(it["descricao"]) > len(seen[url]["descricao"]):
            seen[url] = it
    lista = list(seen.values())
    lista.sort(key=lambda x: (x["dataDia"], x["titulo"].lower()), reverse=True)
    return lista, dropped


def _init_firestore(project_id: str | None):
    try:
        import firebase_admin  # type: ignore
        from firebase_admin import credentials, firestore
    except ImportError as exc:
        raise RuntimeError(
            "Pacote firebase-admin não instalado. Rode: pip install firebase-admin"
        ) from exc
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.ApplicationDefault()
        options = {"projectId": project_id} if project_id else {}
        firebase_admin.initialize_app(cred, options)
    return firestore.client()


def upsert(db, items: list[dict]) -> dict:
    """Grava/atualiza os itens no Firestore. Nunca apaga.

    Preserva `criadoEm` (primeira vez vista) e atualiza `atualizadoEm`.
    Devolve um resumo {criados, atualizados}.
    """
    from firebase_admin import firestore as fsmod  # type: ignore

    summary = {"criados": 0, "atualizados": 0}
    for it in items:
        ref = db.collection("anpd").document(doc_id(it["url"]))
        payload = {
            "url": it["url"],
            "titulo": it["titulo"],
            "descricao": it["descricao"],
            "data": it["dataDia"],
            "fonte": "ANPD",
            "atualizadoEm": fsmod.SERVER_TIMESTAMP,
        }
        snap = ref.get()
        if not snap.exists:
            payload["criadoEm"] = fsmod.SERVER_TIMESTAMP
            summary["criados"] += 1
        else:
            summary["atualizados"] += 1
        ref.set(payload, merge=True)
    return summary


def run(args: argparse.Namespace) -> int:
    url = args.url
    items: list[dict] = []
    for page in range(args.max_pages):
        page_url = url if page == 0 else f"{url}?b_start={page * 25}"
        html = fetch(page_url)
        data = extract_window_data(html)
        page_items = parse_items(data)
        if not page_items:
            break
        items.extend(page_items)
        # Se a página seguinte repetir a primeira, a paginação não funciona: para.
        if page > 0 and page_items and page_items[0].get("url") == items[0].get("url"):
            break

    if not items:
        print("ERRO: nenhuma publicação da ANPD encontrada. Estrutura do site pode ter mudado.", file=sys.stderr)
        return 1

    lista, dropped = normalize(items)
    print(f"Coletadas: {len(items)} | após dedupe/filtro: {len(lista)} | descartadas (URL não oficial): {dropped}")

    if args.dry_run:
        for it in lista[:20]:
            print(f"- {it['dataDia']}  {it['titulo'][:70]}\n  {it['url']}")
        if len(lista) > 20:
            print(f"... e mais {len(lista) - 20}")
        print(f"\n[DRY-RUN] Nada foi gravado no Firestore. {len(lista)} publicação(ões) prontas para gravar.")
        return 0

    db = _init_firestore(args.project)
    summary = upsert(db, lista)
    print(f"Firestore atualizado: {summary['criados']} criado(s), {summary['atualizados']} atualizado(s). Nada foi apagado.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza publicações da ANPD para o Firestore.")
    parser.add_argument("--url", default=ANPD_NEWS_URL, help="URL da página de notícias da ANPD.")
    parser.add_argument("--dry-run", action="store_true", help="Busca e parseia sem gravar no Firestore.")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES, help="Número de páginas a percorrer (padrão: 1).")
    parser.add_argument("--project", default=None, help="projectId do Firebase (opcional; lido das credenciais se omitido).")
    args = parser.parse_args()
    try:
        return run(args)
    except Exception as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
