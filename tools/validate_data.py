
import pandas as pd
import glob
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

EXPECTED_RATES = {
    "0x200": 10,
    "0x201": 5,
    "0x202": 2,
}

RANGES = {
    "pack_voltage": (398, 402),
    "pack_current": (-30, 30),
    "low_cell_voltage": (3.30, 3.35),
    "high_cell_voltage": (4.00, 4.05),
    "temperature": (20, 30),
}


def main():
    files = sorted(PROCESSED_DIR.glob("decoded_*.csv"))

    if not files:
        print("No processed CSV found!")
        return

    file = files[-1]
    df = pd.read_csv(file)

    print(f"\nValidating: {file.name}")
    print("=" * 45)

    errors = []

    # 1. Timestamp validation
    for column in ["timestamp_us", "elapsed_us"]:
        if not df[column].is_monotonic_increasing:
            errors.append(f"{column} is not chronological")

    print("Timestamp order:", "PASS" if not errors else "CHECK")

    # 2. CAN ID frequency validation
    duration = (df["elapsed_us"].max() -
                df["elapsed_us"].min()) / 1_000_000

    print("\nCAN ID frequency:")
    for can_id, expected_hz in EXPECTED_RATES.items():
        count = (df["can_id"] == can_id).sum()
        actual_hz = count / duration if duration > 0 else 0

        print(
            f"{can_id}: {actual_hz:.2f} Hz "
            f"(expected approximately {expected_hz} Hz)"
        )

    # 3. Parameter range validation
    print("\nParameter range checks:")

    for column, (low, high) in RANGES.items():
        values = df[column].dropna()

        if values.empty:
            print(f"{column}: NO DATA")
            continue

        valid = values.between(low, high).all()

        print(
            f"{column}: {'PASS' if valid else 'FAIL'} "
            f"(min={values.min():.3f}, max={values.max():.3f})"
        )

        if not valid:
            errors.append(f"{column} outside expected range")

    # 4. CAN ID validation
    unexpected = set(df["can_id"].unique()) - set(EXPECTED_RATES)

    if unexpected:
        errors.append(f"Unexpected CAN IDs: {unexpected}")

    print("\n" + "=" * 45)

    if errors:
        print("VALIDATION FAILED:")
        for error in errors:
            print("-", error)
    else:
        print("ALL VALIDATION CHECKS PASSED!")


if __name__ == "__main__":
    main()
