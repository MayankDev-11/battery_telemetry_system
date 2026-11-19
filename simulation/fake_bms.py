import can
import time
import math


def create_message(can_id, data):
    return can.Message(
        arbitration_id=can_id,
        data=data,
        is_extended_id=False
    )


def generate_pack_data(t):
    voltage = 400 + 2 * math.sin(t * 0.2)
    current = 30 * math.sin(t * 0.7)

    voltage_raw = round(voltage * 10)
    current_raw = round(current * 10)

    data = (
        voltage_raw.to_bytes(2, "big")
        + current_raw.to_bytes(2, "big", signed=True)
        + bytes(4)
    )

    return data


def generate_cell_data(t):
    low_cell = 3.30 + 0.05 * (0.5 + 0.5 * math.sin(t * 0.3))
    high_cell = 4.00 + 0.05 * (0.5 + 0.5 * math.sin(t * 0.4))

    low_raw = round(low_cell * 10000)
    high_raw = round(high_cell * 10000)

    return (
        low_raw.to_bytes(2, "big")
        + high_raw.to_bytes(2, "big")
        + bytes(4)
    )


def generate_temperature_data(t):
    temperature = 25 + 5 * math.sin(t * 0.1)
    temp_raw = round(temperature * 10)

    return temp_raw.to_bytes(2, "big", signed=True) + bytes(6)


def generate_soc_data(t):
    soc = max(0, 90 - t * 0.01)
    soc_raw = round(soc * 10)

    return soc_raw.to_bytes(2, "big") + bytes(6)


def main():
    bus = can.Bus(interface="socketcan", channel="vcan0")

    print("Multi-ID Fake BMS started!")
    print("Transmitting on vcan0. Press Ctrl+C to stop.")

    start_time = time.monotonic()

    schedules = {
        0x200: (0.1, generate_pack_data),
        0x201: (0.2, generate_cell_data),
        0x202: (0.5, generate_temperature_data),
        0x203: (1.0, generate_soc_data),
    }

    next_send = {can_id: 0 for can_id in schedules}

    try:
        while True:
            elapsed = time.monotonic() - start_time

            for can_id, (interval, generator) in schedules.items():
                if elapsed >= next_send[can_id]:
                    data = generator(elapsed)
                    message = create_message(can_id, data)
                    bus.send(message)

                    print(
                        f"ID=0x{can_id:X} | "
                        f"DATA={data.hex(' ').upper()}"
                    )

                    next_send[can_id] += interval

            time.sleep(0.005)

    except KeyboardInterrupt:
        print("\nFake BMS stopped.")

    finally:
        bus.shutdown()


if __name__ == "__main__":
    main()
