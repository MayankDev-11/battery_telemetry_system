import can
import csv
import time
from pathlib import Path
from datetime import datetime


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
ALLOWED_CAN_IDS = {
    0x200,  # Pack voltage + current
    0x201,  # Lowest + highest cell voltage
    0x202,  # Temperature
}


def create_log_file():
    """Create a new CSV file for every logging session."""

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    filename = datetime.now().strftime(
        "can_log_%Y%m%d_%H%M%S.csv"
    )

    return RAW_DATA_DIR / filename


def main():

    log_file = create_log_file()

    print(f"Starting CAN Logger...")
    print(f"Interface: vcan0")
    print(f"Saving data to: {log_file}")

    try:
        with can.Bus(
            interface="socketcan",
            channel="vcan0"
        ) as bus:

            start_time = time.monotonic_ns()

            with open(log_file, "w", newline="") as file:

                writer = csv.writer(file)

                writer.writerow([
                    "timestamp_us",
                    "elapsed_us",
                    "can_id",
                    "is_extended",
                    "dlc",
                    "data"
                ])

                print("Listening for CAN frames... Press Ctrl+C to stop.")

                while True:

                    msg = bus.recv(timeout=1.0)

                    if msg is None:
                        continue

                    # Capture timestamps immediately after reception
                    timestamp_us = time.time_ns() // 1000

                    elapsed_us = (
                        time.monotonic_ns() - start_time
                    ) // 1000

                    # Skip error frames
                    if msg.is_error_frame:
                        continue
                    
                    if msg.arbitration_id not in ALLOWED_CAN_IDS:
                        print(f"Filtered out: ID={hex(msg.arbitration_id)}")
                        continue

                    writer.writerow([
                        timestamp_us,
                        elapsed_us,
                        f"0x{msg.arbitration_id:X}",
                        msg.is_extended_id,
                        msg.dlc,
                        msg.data.hex().upper()
                    ])

                    file.flush()

                    print(
                        f"Logged: ID={hex(msg.arbitration_id)} "
                        f"DATA={msg.data.hex(' ').upper()}"
                    )

    except KeyboardInterrupt:
        print("\nCAN Logger stopped.")

    except can.CanError as error:
        print(f"CAN error: {error}")

    finally:
        print(f"Log saved at: {log_file}")


if __name__ == "__main__":
    main()
