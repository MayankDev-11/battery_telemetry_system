
# Battery Telemetry Logger - Simulation Protocol

## 1. Purpose

This document defines the simulated CAN message format used
to develop and test the battery telemetry pipeline.

IMPORTANT: These CAN IDs, payload layouts, scaling factors
and transmission rates are simulated. They are NOT confirmed
Orion BMS 2 message definitions.

## 2. CAN Message Definitions

| CAN ID | Parameter | Byte Position | Format | Scaling | Rate |
|---|---|---|---|---|---|
| 0x200 | Pack Voltage | 0-1 | uint16 BE | 0.1 V/bit | 10 Hz |
| 0x200 | Pack Current | 2-3 | int16 BE | 0.1 A/bit | 10 Hz |
| 0x201 | Lowest Cell Voltage | 0-1 | uint16 BE | 0.0001 V/bit | 5 Hz |
| 0x201 | Highest Cell Voltage | 2-3 | uint16 BE | 0.0001 V/bit | 5 Hz |
| 0x202 | Temperature | 0-1 | int16 BE | 0.1 °C/bit | 2 Hz |
| 0x203 | SOC | 0-1 | uint16 BE | 0.1 %/bit | 1 Hz |

BE = Big Endian. All messages use an 8-byte payload.

## 3. Raw CSV Format

Fields:
- timestamp_us: Unix epoch timestamp in microseconds
- elapsed_us: Monotonic elapsed time since logger start
- can_id: CAN arbitration ID
- is_extended: Standard or extended frame flag
- dlc: Data length code
- data: Raw payload in hexadecimal

## 4. Filtering

Current simulation allowlist:
- 0x200: Accepted
- 0x201: Accepted
- 0x202: Accepted
- 0x203: Rejected

## 5. Processed CSV

Decoded parameters:
- pack_voltage
- pack_current
- low_cell_voltage
- high_cell_voltage
- temperature
- soc

Blank values mean that the corresponding parameter was
not present in that CAN message.

## 6. Timestamping

The current Python logger records software receive time.
The future STM32 implementation should capture a timer
timestamp when the CAN frame is received, before SD writing.

## 7. Hardware Integration

Before connecting to Orion BMS 2, verify its actual:
- CAN IDs
- Standard/extended frame format
- Message transmission intervals
- Payload byte positions
- Byte order
- Signed/unsigned data types
- Scaling and offsets
