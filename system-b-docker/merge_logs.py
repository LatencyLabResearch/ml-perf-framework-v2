"""
Merge per-instance CSVs into one file, sorted by timestamp.

Run this AFTER the experiment (containers stopped), from the folder that
contains request-instance-*.csv (normally ./experiment_logs).

    python merge_logs.py                      # -> request.csv
    python merge_logs.py --dir experiment_logs --out request_merged.csv
"""
import argparse
import glob
import os
import sys

import pandas as pd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=".", help="folder with request-instance-*.csv")
    ap.add_argument("--out", default="request.csv", help="merged output file name")
    args = ap.parse_args()

    pattern = os.path.join(args.dir, "request-instance-*.csv")
    files = sorted(glob.glob(pattern))
    if not files:
        sys.exit(f"No files match {pattern}")

    frames = []
    for f in files:
        df = pd.read_csv(f)
        print(f"{os.path.basename(f):32s} {len(df):>8,} rows")
        frames.append(df)

    merged = pd.concat(frames, ignore_index=True)
    before = len(merged)
    merged = merged.drop_duplicates(subset="request_id")
    merged["_ts"] = pd.to_datetime(merged["timestamp"], utc=True)
    merged = merged.sort_values("_ts").drop(columns="_ts").reset_index(drop=True)

    out = os.path.join(args.dir, args.out)
    merged.to_csv(out, index=False)
    print(f"\nMerged {len(merged):,} rows ({before - len(merged)} duplicates removed) -> {out}")


if __name__ == "__main__":
    main()
