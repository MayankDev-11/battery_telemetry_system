def decode_frame(data):

    # Extract individual signals (2 bytes each)
    voltage_raw = int.from_bytes(data[0:2], "big")
    current_raw = int.from_bytes(data[2:4], "big", signed=True)
    low_cell_raw = int.from_bytes(data[4:6], "big")
    high_cell_raw = int.from_bytes(data[6:8], "big")

    # Apply scaling
    voltage = voltage_raw * 0.1
    current = current_raw * 0.1
    low_cell = low_cell_raw * 0.0001
    high_cell = high_cell_raw * 0.0001

    return {
        "pack_voltage": voltage,
        "pack_current": current,
        "low_cell_voltage": low_cell,
        "high_cell_voltage": high_cell
    }


# Test with a sample CAN payload
sample_data = bytes.fromhex("0F A0 00 7B 80 E8 A4 10")

result = decode_frame(sample_data)

print("Decoded Battery Parameters:")

for parameter, value in result.items():
    print(f"{parameter}: {value}")
