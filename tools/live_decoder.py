import can
from decoder import decode_frame
bus = can.Bus(interface="socketcan", channel="vcan0")

print("Listening for CAN messages...")

try:
    while True:
        message = bus.recv()

        if message.arbitration_id == 0x200:
            result = decode_frame(message.data)

            print("\nDecoded Battery Parameters:")

            for parameter, value in result.items():
                print(f"{parameter}: {value}")

except KeyboardInterrupt:
    print("\nStopped.")

finally:
    bus.shutdown()