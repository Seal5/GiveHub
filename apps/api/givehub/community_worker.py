"""Durable reminder worker. Run alongside the API, or use --once from a scheduler."""
import argparse
import logging
import time

from givehub.community import process_deliveries
from givehub.config import get_settings
from givehub.database import SessionLocal


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    while True:
        try:
            with SessionLocal() as db:
                count = process_deliveries(db, get_settings())
                print(f"Processed {count} due community deliveries", flush=True)
        except Exception:
            if args.once:
                raise
            logging.exception("Community delivery pass failed; queued work will be checked again")
        if args.once:
            return
        time.sleep(30)


if __name__ == "__main__":
    main()
