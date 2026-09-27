# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.2"]
# ///
"""Stream Amazon Reviews 2023 jsonl.gz files into Postgres with constant memory."""

import gzip
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path

import psycopg

DSN = os.environ.get("DATABASE_URL", "dbname=reviews")
DB_DIR = Path(__file__).resolve().parent
RAW = DB_DIR.parent / "data" / "raw"
CATEGORIES = ["All_Beauty", "Amazon_Fashion"]
PRICE_RE = re.compile(r"\d+(?:\.\d+)?")


def clean(s):
    if s is None:
        return None
    s = str(s).replace("\x00", "").strip()
    return s or None


def price(v):
    if isinstance(v, (int, float)):
        return v if v < 1e7 else None
    m = PRICE_RE.search(str(v or ""))
    return float(m.group()) if m and float(m.group()) < 1e7 else None


def lines(path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)


def main():
    with psycopg.connect(DSN) as conn:
        conn.execute((DB_DIR / "schema.sql").read_text())
        brands: dict[str, tuple[int, str]] = {}
        products: set[str] = set()

        for cat in CATEGORIES:
            print(f"[{cat}] products…", flush=True)
            with conn.cursor().copy(
                "COPY products(parent_asin,title,category,main_category,brand_id,price_usd,"
                "average_rating,rating_count,sub_categories,details) FROM STDIN"
            ) as cp:
                for p in lines(RAW / f"meta_{cat}.jsonl.gz"):
                    asin = p["parent_asin"]
                    if asin in products:
                        continue
                    products.add(asin)
                    details = p.get("details") or {}
                    brand = clean(details.get("Brand") or details.get("Brand Name") or p.get("store"))
                    bid = None
                    if brand:
                        bid = brands.setdefault(brand.lower(), (len(brands) + 1, brand))[0]
                    cp.write_row(
                        (
                            asin,
                            clean(p.get("title")),
                            cat,
                            clean(p.get("main_category")),
                            bid,
                            price(p.get("price")),
                            p.get("average_rating"),
                            p.get("rating_number"),
                            [c for c in (p.get("categories") or []) if c],
                            json.dumps(details).replace("\\u0000", ""),
                        )
                    )

            print(f"[{cat}] reviews…", flush=True)
            n = 0
            with conn.cursor().copy(
                "COPY reviews(parent_asin,asin,user_id,rating,title,body,helpful_votes,"
                "verified_purchase,reviewed_at) FROM STDIN"
            ) as cp:
                for r in lines(RAW / f"{cat}.jsonl.gz"):
                    if r["parent_asin"] not in products:
                        continue
                    cp.write_row(
                        (
                            r["parent_asin"],
                            r.get("asin"),
                            r.get("user_id"),
                            int(r["rating"]),
                            clean(r.get("title")),
                            clean(r.get("text")),
                            r.get("helpful_vote") or 0,
                            r.get("verified_purchase"),
                            datetime.fromtimestamp(r["timestamp"] / 1000, tz=UTC),
                        )
                    )
                    n += 1
                    if n % 500_000 == 0:
                        print(f"  {n:,}", flush=True)
            print(f"  {n:,} reviews", flush=True)
            conn.commit()

        print(f"{len(brands):,} brands…", flush=True)
        with conn.cursor().copy("COPY brands(brand_id,name) FROM STDIN") as cp:
            for bid, name in brands.values():
                cp.write_row((bid, name))
        conn.commit()

        print("foreign keys + indexes…", flush=True)
        conn.execute("SET maintenance_work_mem = '512MB'")
        conn.execute((DB_DIR / "indexes.sql").read_text())
        conn.commit()

        print("vacuum analyze…", flush=True)
        conn.autocommit = True
        conn.execute("VACUUM ANALYZE")
        print("done.")


if __name__ == "__main__":
    main()
