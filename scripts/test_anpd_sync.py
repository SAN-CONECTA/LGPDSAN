#!/usr/bin/env python3
"""Testes da sincronização ANPD (scripts/anpd_sync.py).

Rode com:
  python3 -m pytest scripts/test_anpd_sync.py -q
ou
  python3 -m unittest scripts.test_anpd_sync -v
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anpd_sync  # noqa: E402


FIXTURE = """
<html><head></head><body>
<script>window.__data={"reduxAsyncConnect":{"content":{"items_total":60,"items":[
  {"@id":"https://www.gov.br/anpd/pt-br/assuntos/noticias/noticia-a","@type":"News Item","title":"Noticia A","description":"Desc A curta","effective":"2026-07-10T10:00:00+00:00"},
  {"@id":"https://www.gov.br/anpd/pt-br/assuntos/noticias/edital-1.png","@type":"Image","title":"edital-1.png","description":"","effective":"2026-07-09T10:00:00+00:00"},
  {"@id":"https://evil.example.com/anpd/noticia-falsa","@type":"News Item","title":"URL externa","description":"","effective":"2026-07-08T10:00:00+00:00"},
  {"@id":"https://www.gov.br/anpd/pt-br/assuntos/noticias/noticia-a","@type":"News Item","title":"Noticia A","description":"Desc A mais completa","effective":"2026-07-10T10:00:00+00:00"},
  {"@id":"https://www.gov.br/anpd/pt-br/assuntos/noticias/noticia-b","@type":"News Item","title":"Noticia B","description":"Desc B","effective":"2026-07-08T10:00:00+00:00"}
]}}};</script>
</body></html>
"""


class TestExtract(unittest.TestCase):
    def test_extract_window_data(self):
        data = anpd_sync.extract_window_data(FIXTURE)
        self.assertIn("reduxAsyncConnect", data)

    def test_extract_sem_window_data(self):
        with self.assertRaises(RuntimeError):
            anpd_sync.extract_window_data("<html><body>sem dados</body></html>")

    def test_parse_items_filtra_imagens(self):
        data = anpd_sync.extract_window_data(FIXTURE)
        items = anpd_sync.parse_items(data)
        # 5 na fixture, menos 1 imagem = 4 notícias
        self.assertEqual(len(items), 4)
        for it in items:
            self.assertTrue(it["titulo"])
            self.assertFalse(it["url"].endswith(".png"))
        # dataDia = YYYY-MM-DD
        self.assertEqual(items[0]["dataDia"], "2026-07-10")


class TestValidacao(unittest.TestCase):
    def test_urls_oficiais(self):
        ok = [
            "https://www.gov.br/anpd/pt-br/assuntos/noticias/x",
            "https://www.gov.br/anpd/pt-br",
            "https://gov.br/anpd/noticia",
        ]
        for u in ok:
            self.assertTrue(anpd_sync.is_anpd_url(u), u)

    def test_urls_nao_oficiais(self):
        bad = [
            "http://www.gov.br/anpd/x",  # http, não https
            "https://www.gov.br/outro/x",  # fora de /anpd
            "https://evil.example.com/anpd/x",  # host externo
            "https://www.gov.br.attacker.com/anpd/x",  # host falsificado
            "https://www.gov.br/anpd.evil.com/x",
        ]
        for u in bad:
            self.assertFalse(anpd_sync.is_anpd_url(u), u)

    def test_doc_id_deterministico(self):
        u = "https://www.gov.br/anpd/pt-br/assuntos/noticias/x"
        self.assertEqual(anpd_sync.doc_id(u), anpd_sync.doc_id(u))
        self.assertNotEqual(anpd_sync.doc_id(u), anpd_sync.doc_id(u + "2"))


class TestNormalize(unittest.TestCase):
    def test_dedupe_filtro_ordenacao(self):
        data = anpd_sync.extract_window_data(FIXTURE)
        items = anpd_sync.parse_items(data)
        lista, dropped = anpd_sync.normalize(items)
        # evil.example.com descartado; noticia-a duplicada colapsa
        self.assertEqual(dropped, 1)
        self.assertEqual(len(lista), 2)
        # mantém a descrição mais completa da duplicata
        a = next(x for x in lista if x["url"].endswith("noticia-a"))
        self.assertEqual(a["descricao"], "Desc A mais completa")
        # mais recente primeiro
        self.assertEqual(lista[0]["dataDia"], "2026-07-10")


if __name__ == "__main__":
    unittest.main()
