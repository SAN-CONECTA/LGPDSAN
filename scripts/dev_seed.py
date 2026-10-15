#!/usr/bin/env python3
"""Semeia o Firebase Emulator local para testar o LGPDSAN sem tocar em produção.

Cria um usuário administrador de teste, as categorias e uma contabilidade,
para que o app (aberto com ?emulador=1) funcione de ponta a ponta.

Uso (com os emuladores rodando — ver firebase.json):
  ~/lgpdsan-venv/bin/python scripts/dev_seed.py
  ~/lgpdsan-venv/bin/python scripts/dev_seed.py --email voce@teste.local --senha abc123 --nome "Seu Nome"

Requer firebase-admin: pip install firebase-admin
"""

import argparse
import os

os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:8080")

import firebase_admin  # noqa: E402
from firebase_admin import auth, credentials, firestore  # noqa: E402
from firebase_admin import firestore as fsmod  # noqa: E402
from google.auth.credentials import AnonymousCredentials  # noqa: E402

# Mesmas categorias padrão de assets/app.js (o admin ganha as de guia automaticamente).
DEFAULT_CATS = ['Governança e Políticas', 'Direitos dos Titulares', 'Contratos e Operadores',
    'Segurança da Informação', 'Incidentes', 'Retenção e Descarte', 'Treinamento e Cultura',
    'Mapeamento de Dados']


def main() -> int:
    ap = argparse.ArgumentParser(description="Semeia o emulador local para testar o LGPDSAN.")
    ap.add_argument("--email", default="admin@teste.local")
    ap.add_argument("--senha", default="senha123")
    ap.add_argument("--nome", default="Admin Teste")
    args = ap.parse_args()

    try:
        firebase_admin.get_app()
    except ValueError:
        # projectId bate com assets/firebase-config.js (lgpdsan), senão o app não vê os dados.
        firebase_admin.initialize_app(AnonymousCredentials(), {"projectId": "lgpdsan"})
    db = firestore.client()

    try:
        u = auth.get_user_by_email(args.email)
        print("Usuário já existe:", u.uid)
    except Exception:
        u = auth.create_user(email=args.email, password=args.senha, display_name=args.nome)
        print("Usuário criado:", u.uid)

    db.collection("users").document(u.uid).set({
        "nome": args.nome, "email": args.email, "role": "admin", "ativo": True,
        "criado": fsmod.SERVER_TIMESTAMP,
    })
    db.collection("config").document("app").set({"lista": DEFAULT_CATS})
    cont = db.collection("contabilidades").document()
    cont.set({"nome": "Contabilidade 01", "criado": fsmod.SERVER_TIMESTAMP})

    print("Seed concluído.")
    print(f"Login: {args.email} / {args.senha}")
    print("Abra http://localhost:8000/?emulador=1 e entre com esses dados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
