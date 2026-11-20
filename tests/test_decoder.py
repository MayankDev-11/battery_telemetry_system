
import unittest

from tools.decoder import decode_frame
from simulation.fake_bms import (
    generate_pack_data,
    generate_cell_data,
    generate_temperature_data,
    generate_soc_data,
)


class TestDecoder(unittest.TestCase):

    def test_pack_data(self):
        result = decode_frame(0x200, generate_pack_data(0))
        self.assertAlmostEqual(result["pack_voltage"], 400.0)
        self.assertAlmostEqual(result["pack_current"], 0.0)

    def test_cell_data(self):
        result = decode_frame(0x201, generate_cell_data(0))
        self.assertAlmostEqual(result["low_cell_voltage"], 3.325)
        self.assertAlmostEqual(result["high_cell_voltage"], 4.025)

    def test_temperature_data(self):
        result = decode_frame(0x202, generate_temperature_data(0))
        self.assertAlmostEqual(result["temperature"], 25.0)

    def test_soc_data(self):
        result = decode_frame(0x203, generate_soc_data(0))
        self.assertAlmostEqual(result["soc"], 90.0)

    def test_invalid_payload_length(self):
        with self.assertRaises(ValueError):
            decode_frame(0x200, bytes([0x00, 0x01]))

    def test_unknown_can_id(self):
        with self.assertRaises(ValueError):
            decode_frame(0x999, bytes(8))


if __name__ == "__main__":
    unittest.main()
