import can
import time

# Connect to the virtual CAN interface
bus = can.Bus(
    interface="socketcan",
    channel="vcan0"
)

print("Fake BMS started...")
print("Transmitting CAN frames. Press Ctrl+C to stop.")

try:
    while True:

        # Simulated battery parameters
        pack_voltage = 4000   # 400.0 V (0.1 V/bit)
        pack_current = 123    # 12.3 A (0.1 A/bit)
        low_cell = 33000      # 3.3000 V (0.0001 V/bit)
        high_cell = 42000     # 4.2000 V (0.0001 V/bit)

        # Convert values into 2-byte big-endian data
        # pack current is unsigned, so we need to handle negative values for current
        data = (
            pack_voltage.to_bytes(2, "big")
            + pack_current.to_bytes(2, "big", signed=True)
            + low_cell.to_bytes(2, "big")
            + high_cell.to_bytes(2, "big")
        )

        # Create CAN message
        message = can.Message(
            arbitration_id=0x200,
            data=data,
            is_extended_id=False
        )

        # Transmit CAN frame
        bus.send(message)

        print(f"Sent: ID=0x200 DATA={data.hex(' ').upper()}")
        time.sleep(0.1)

except KeyboardInterrupt:
    print("\nFake BMS stopped.")

finally:
    bus.shutdown()
