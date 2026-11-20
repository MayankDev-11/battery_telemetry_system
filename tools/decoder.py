import argparse
import csv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def decode_frame(can_id, data):
    """Decode an 8-byte payload based on CAN ID."""

    if len(data) != 8:
        raise ValueError("Expected exactly 8 bytes")

    if can_id == 0x200:
        voltage_raw = int.from_bytes(data[0:2], "big")
        current_raw = int.from_bytes(data[2:4], "big", signed=True)

        return {
            "pack_voltage": voltage_raw * 0.1,
            "pack_current": current_raw * 0.1,
        }

    elif can_id == 0x201:
        low_cell_raw = int.from_bytes(data[0:2], "big")
        high_cell_raw = int.from_bytes(data[2:4], "big")

        return {
            "low_cell_voltage": low_cell_raw * 0.0001,
            "high_cell_voltage": high_cell_raw * 0.0001,
        }

    elif can_id == 0x202:
        temperature_raw = int.from_bytes(data[0:2], "big", signed=True)

        return {
            "temperature": temperature_raw * 0.1,
        }

    elif can_id == 0x203:
        soc_raw = int.from_bytes(data[0:2], "big")

        return {
            "soc": soc_raw * 0.1,
        }

    else:
        raise ValueError(f"Unknown CAN ID: {hex(can_id)}")


def decode_csv(input_file, output_file):

    input_file = Path(input_file)
    output_file = Path(output_file)

    output_file.parent.mkdir(parents=True, exist_ok=True)

    processed_count = 0
    skipped_count = 0

    output_columns = [
        "timestamp_us",
        "elapsed_us",
        "can_id",
        "pack_voltage",
        "pack_current",
        "low_cell_voltage",
        "high_cell_voltage",
        "temperature",
        "soc",
    ]

    with open(input_file, "r", newline="") as source:
        reader = csv.DictReader(source)

        required = {"timestamp_us", "elapsed_us", "can_id", "dlc", "data"}

        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Invalid raw CSV columns")

        with open(output_file, "w", newline="") as destination:
            writer = csv.DictWriter(destination, fieldnames=output_columns)

            writer.writeheader()

            for row in reader:
                try:
                    can_id = int(row["can_id"], 0)
                    payload = bytes.fromhex(row["data"])

                    if int(row["dlc"]) != 8 or len(payload) != 8:
                        skipped_count += 1
                        continue

                    decoded = decode_frame(can_id, payload)

                    output_row = {
                        "timestamp_us": row["timestamp_us"],
                        "elapsed_us": row["elapsed_us"],
                        "can_id": hex(can_id),
                    }

                    output_row.update(decoded)

                    writer.writerow(output_row)
                    processed_count += 1

                except ValueError, TypeError, KeyError:
                    skipped_count += 1

    print("\nDecoding completed!")
    print(f"Processed frames: {processed_count}")
    print(f"Skipped frames: {skipped_count}")
    print(f"Output file: {output_file}")


def main():

    parser = argparse.ArgumentParser(description="Decode raw BMS CAN CSV data")

    parser.add_argument("input", help="Path to raw CAN CSV file")

    args = parser.parse_args()

    input_file = Path(args.input)

    output_file = PROJECT_ROOT / "data" / "processed" / f"decoded_{input_file.stem}.csv"

    decode_csv(input_file, output_file)


if __name__ == "__main__":
    main()
