import json
import os
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "dorcashop.db"
JSON_BACKUP_PATH = DATA_DIR / "products.json"

DEFAULT_PRODUCTS = [
    {
        "id": "cahiers-simples",
        "name": "Cahiers simples",
        "category": "fournitures",
        "cats": ["fournitures", "etudiants"],
        "img": "images/cahiers-simples.jpg",
        "desc": "Disponibles en 100, 200 et 300 pages. Vendus à l'unité, au paquet ou au carton.",
        "price": "À partir de 1 200 F",
        "priceNote": "le paquet",
        "badge": "GROS",
        "createdAt": 1700000000000,
    },
    {
        "id": "bics-simples",
        "name": "Bics simples",
        "category": "fournitures",
        "cats": ["fournitures", "etudiants", "gros"],
        "img": "images/bics-simples.jpg",
        "desc": "Stylos à bille pour l'école et le bureau, disponibles en gros volume.",
        "price": "À partir de 2 500 F",
        "priceNote": "le paquet",
        "badge": "GROS",
        "createdAt": 1700000100000,
    },
    {
        "id": "lampe-rechargeable",
        "name": "Lampe rechargeable à batterie",
        "category": "maison",
        "cats": ["maison"],
        "img": "images/ampoule-rechargeable.jpg",
        "desc": "Idéale en cas de coupure de courant, longue autonomie.",
        "price": "2 000 F",
        "priceNote": "l'unité",
        "badge": "BON PLAN",
        "createdAt": 1700000200000,
    },
]


def ensure_db():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            cats TEXT NOT NULL,
            img TEXT,
            desc TEXT,
            price TEXT,
            oldPrice TEXT,
            priceNote TEXT,
            priceGros TEXT,
            badge TEXT,
            details TEXT,
            icon TEXT,
            createdAt INTEGER NOT NULL
        )
        """
    )
    count = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]

    if count == 0:
        if JSON_BACKUP_PATH.exists():
            try:
                with JSON_BACKUP_PATH.open("r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, list):
                    for item in data:
                        insert_product(conn, normalize_product(item))
                    conn.commit()
                    conn.close()
                    return
            except Exception:
                pass

        for product in DEFAULT_PRODUCTS:
            insert_product(conn, normalize_product(product))
        conn.commit()

    conn.close()


def open_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def serialize_cats(cats):
    value = cats if isinstance(cats, list) else [cats]
    return json.dumps([str(item).strip() for item in value if str(item).strip()], ensure_ascii=False)


def deserialize_cats(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return [str(value)]
    return parsed if isinstance(parsed, list) else [str(parsed)]


def normalize_product(product):
    item = product or {}
    cats = item.get("cats") or [item.get("category") or "fournitures"]
    category = str(item.get("category") or (cats[0] if isinstance(cats, list) and cats else "fournitures"))
    cleaned = {
        "id": str(item.get("id") or item.get("name") or f"product-{int(item.get('createdAt') or 0)}"),
        "name": str(item.get("name") or "Produit"),
        "category": category,
        "cats": cats if isinstance(cats, list) else [str(cats)],
        "img": item.get("img") or "",
        "desc": item.get("desc") or "",
        "price": item.get("price") or "0 F",
        "oldPrice": item.get("oldPrice") or "",
        "priceNote": item.get("priceNote") or "",
        "priceGros": item.get("priceGros") or "",
        "badge": item.get("badge") or "",
        "details": item.get("details") or None,
        "icon": item.get("icon") or "",
        "createdAt": int(item.get("createdAt") or int(time.time() * 1000)),
    }
    return cleaned


def row_to_product(row):
    if not row:
        return None
    details = row["details"]
    try:
        details_value = json.loads(details) if details else None
    except (TypeError, ValueError):
        details_value = None

    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "cats": deserialize_cats(row["cats"]),
        "img": row["img"] or "",
        "desc": row["desc"] or "",
        "price": row["price"],
        "oldPrice": row["oldPrice"] or "",
        "priceNote": row["priceNote"] or "",
        "priceGros": row["priceGros"] or "",
        "badge": row["badge"] or "",
        "details": details_value,
        "icon": row["icon"] or "",
        "createdAt": int(row["createdAt"] or 0),
    }


def insert_product(conn, product):
    conn.execute(
        """
        INSERT OR REPLACE INTO products (
            id, name, category, cats, img, desc, price, oldPrice, priceNote,
            priceGros, badge, details, icon, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            product["id"],
            product["name"],
            product["category"],
            serialize_cats(product["cats"]),
            product["img"],
            product["desc"],
            product["price"],
            product["oldPrice"],
            product["priceNote"],
            product["priceGros"],
            product["badge"],
            json.dumps(product["details"], ensure_ascii=False) if product.get("details") else None,
            product["icon"],
            int(product["createdAt"]),
        ),
    )


def fetch_products():
    conn = open_db()
    rows = conn.execute(
        "SELECT * FROM products ORDER BY createdAt DESC, id DESC"
    ).fetchall()
    conn.close()
    return [row_to_product(row) for row in rows]


def save_product(product):
    conn = open_db()
    insert_product(conn, normalize_product(product))
    conn.commit()
    conn.close()


def delete_product_by_id(product_id):
    conn = open_db()
    conn.execute("DELETE FROM products WHERE id = ?", (str(product_id),))
    conn.commit()
    conn.close()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/products":
            self.send_json({"products": fetch_products()})
            return

        if path == "/api/health":
            self.send_json({"status": "ok"})
            return

        if path.startswith("/api/"):
            self.send_json({"success": False, "message": "Endpoint inconnu"}, 404)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""

        if path == "/api/login":
            try:
                data = json.loads(raw.decode("utf-8")) if raw else {}
            except Exception:
                data = {}

            username = str(data.get("username") or "").strip()
            password = str(data.get("password") or "")

            if username == "admin" and password == "admin0":
                self.send_json({"success": True, "message": "Connexion réussie."})
                return

            self.send_json({"success": False, "message": "Identifiants incorrects."}, 401)
            return

        if path == "/api/products":
            try:
                payload = json.loads(raw.decode("utf-8")) if raw else {}
            except Exception:
                payload = {}

            name = str(payload.get("name") or "").strip()
            if not name:
                self.send_json({"success": False, "message": "Le nom du produit est requis."}, 400)
                return

            product = normalize_product({
                **payload,
                "id": payload.get("id") or f"custom-{int(time.time() * 1000)}",
                "category": payload.get("category") or (payload.get("cats") or ["fournitures"])[0],
                "cats": payload.get("cats") or [payload.get("category") or "fournitures"],
                "createdAt": int(time.time() * 1000),
            })
            save_product(product)
            self.send_json({"success": True, "product": product}, 201)
            return

        if path.startswith("/api/"):
            self.send_json({"success": False, "message": "Endpoint inconnu"}, 404)
            return

        self.send_json({"success": False, "message": "Cette route n'est pas autorisée."}, 405)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/products/"):
            self.send_json({"success": False, "message": "Route inconnue"}, 404)
            return

        product_id = path.split("/api/products/")[-1]
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            payload = {}

        existing = fetch_products()
        current = next((item for item in existing if str(item["id"]) == str(product_id)), None)
        if current is None:
            self.send_json({"success": False, "message": "Produit introuvable."}, 404)
            return

        updated = normalize_product({**current, **payload, "id": product_id})
        save_product(updated)
        self.send_json({"success": True, "product": updated})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/products/"):
            self.send_json({"success": False, "message": "Route inconnue"}, 404)
            return

        product_id = path.split("/api/products/")[-1]
        delete_product_by_id(product_id)
        self.send_json({"success": True, "removedId": product_id})


if __name__ == "__main__":
    ensure_db()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serveur DORCASHOP démarré sur http://localhost:{port}")
    server.serve_forever()
