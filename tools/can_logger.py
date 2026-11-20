"""Record raw CAN frames from a python-can interface into the project CSV format.

The logger deliberately does not decode payloads. It stores the received frame
metadata and bytes so that a later DBC-based tool can interpret the capture.
"""

from __future__ import annotations

import argparse
import csv
import time
from datetime import datetime
from pathlib import Path
from typing import TextIO

CSV_HEADER = (
    "timestamp_us",
    "ext",
    "id",
    "dlc",
    "d0",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
)
MAX_CLASSIC_CAN_DATA_BYTES = 8


def message_to_csv_row(message: object) -> list[int | str]:
    """Convert a python-can Message-like object into one CSV row.

    ``python-can`` timestamps are seconds; the CSV stores integer
    microseconds. CAN IDs and payload bytes are uppercase hexadecimal without
    a ``0x`` prefix, matching the project's documented examples.

    The schema is intentionally classic-CAN (eight data-byte columns). Frames
    with more than eight payload bytes are rejected rather than truncated.
    """
    data = bytes(message.data)
    dlc = int(message.dlc)
    if not 0 <= dlc <= MAX_CLASSIC_CAN_DATA_BYTES:
        raise ValueError(f"DLC {dlc} is outside the supported classic CAN range 0..8")
    if len(data) > MAX_CLASSIC_CAN_DATA_BYTES:
        raise ValueError(
            f"Payload contains {len(data)} bytes; CSV schema supports at most 8"
        )
    if len(data) != dlc:
        raise ValueError(
            f"DLC is {dlc}, but the message contains {len(data)} data bytes"
        )

    timestamp = getattr(message, "timestamp", None)
    timestamp_us = (
        time.time_ns() // 1_000
        if timestamp is None
        else int(round(float(timestamp) * 1_000_000))
    )
    arbitration_id = int(message.arbitration_id)
    is_extended = bool(message.is_extended_id)

    # A CAN identifier is represented as hexadecimal, not decimal. The
    # extended flag disambiguates the identifier format.
    row: list[int | str] = [
        timestamp_us,
        int(is_extended),
        f"{arbitration_id:X}",
        dlc,
    ]
    row.extend(f"{byte:02X}" for byte in data)
    row.extend([""] * (MAX_CLASSIC_CAN_DATA_BYTES - len(data)))
    return row


def create_log_path(output_dir: str | Path) -> Path:
    """Create a unique, timestamped CSV path inside ``output_dir``."""
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = directory / f"LOG_{stamp}.csv"
    suffix = 1
    while candidate.exists():
        candidate = directory / f"LOG_{stamp}_{suffix:02d}.csv"
        suffix += 1
    return candidate


class RawCanCSVLogger:
    """Write raw CAN messages to a CSV file, closing it deterministically."""

    def __init__(self, output_file: str | Path):
        self.output_path = Path(output_file)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents accidental overwriting of an earlier log.
        self._file: TextIO = self.output_path.open(
            "x", newline="", encoding="ascii", buffering=1
        )
        self._writer = csv.writer(self._file, lineterminator="\n")
        self._writer.writerow(CSV_HEADER)
        self._closed = False

    def log_message(self, message: object) -> None:
        """Append one received CAN message to the CSV."""
        if self._closed:
            raise ValueError("Cannot write to a closed CAN log")
        self._writer.writerow(message_to_csv_row(message))

    def close(self) -> None:
        """Flush and close the CSV file; safe to call more than once."""
        if not self._closed:
            self._file.flush()
            self._file.close()
            self._closed = True

    def __enter__(self) -> "RawCanCSVLogger":
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()


def run_logger(
    channel: str = "vcan0",
    output_file: str | Path | None = None,
    interface: str = "socketcan",
) -> Path:
    """Listen until Ctrl+C, then safely close both the CSV and CAN bus."""
    try:
        import can
    except ImportError as exc:  # pragma: no cover - depends on runtime install
        raise RuntimeError(
            "python-can is required; install project dependencies"
        ) from exc

    path = Path(output_file) if output_file else create_log_path("data/raw")
    bus = can.Bus(interface=interface, channel=channel)
    try:
        with RawCanCSVLogger(path) as logger:
            print(f"Raw CAN logging on {channel} ({interface})")
            print(f"Writing CSV to: {path}")
            print("Press Ctrl+C to stop.")
            while True:
                message = bus.recv(timeout=1.0)
                if message is not None:
                    logger.log_message(message)
    except KeyboardInterrupt:
        print("\nStopping CAN logger...")
    finally:
        bus.shutdown()
    print(f"Log saved: {path}")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Log raw CAN frames to CSV")
    parser.add_argument(
        "--channel", default="vcan0", help="CAN channel (default: vcan0)"
    )
    parser.add_argument(
        "--interface",
        default="socketcan",
        help="python-can interface (default: socketcan)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="CSV output path (default: unique file under data/raw/)",
    )
    args = parser.parse_args()
    run_logger(channel=args.channel, output_file=args.output, interface=args.interface)


if __name__ == "__main__":
    main()
