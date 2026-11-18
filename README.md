## 1. Project Overview

The objective of the Battery Telemetry system is to acquire battery-related data from the Orion BMS 2, transmit it over the CAN bus, store the received CAN frames on an SD card using an STM32 microcontroller, and analyse the recorded data on a Linux computer.

The system follows a **Raw CAN Logging Architecture**.

Instead of decoding battery parameters directly on the STM32, the microcontroller records the raw CAN frames. Decoding and data analysis are performed later on the computer using Python and a DBC file.

This approach keeps the embedded firmware independent of the BMS message configuration.

### Primary Objectives

- Receive CAN messages transmitted by the Orion BMS 2.
- Capture raw CAN frames without modifying their payloads.
- Record timestamps for every received frame.
- Store the captured data on a MicroSD card.
- Decode the recorded frames on a computer.
- Visualise battery parameters through a telemetry dashboard.
- Preserve raw data for future analysis and debugging.

---

## 2. System Architecture

The system consists of two major sections:

1. Embedded Data Acquisition System
2. PC-side Data Processing System
    

### 2.1 Complete Data Flow

```text
              ORION BMS 2
                   |
                   |
              CAN BUS
             CAN_H / CAN_L
                   |
                   v
           CAN TRANSCEIVER
                   |
                   | RXD
                   v
             STM32F446RE
              (bxCAN)
                   |
                   v
             CAN Reception
                   |
                   v
              RAM BUFFER
             (Ring Buffer)
                   |
                   v
             CSV Formatting
                   |
                   v
              MicroSD Card
              (Raw CAN Logs)
                   |
                   | Transfer log file
                   v
              LINUX COMPUTER
                   |
                   v
              PYTHON DECODER
                + DBC
                   |
                   v
             DECODED DATA
                   |
                   v
             TELEMETRY DASHBOARD
```

### 2.2 Hardware Components

|Component|Responsibility|
|---|---|
|Orion BMS 2|Measures and broadcasts battery parameters|
|CAN Transceiver|Converts differential CAN bus signals into logic-level signals|
|STM32F446RE|Receives and processes CAN frames|
|MicroSD Card|Stores raw CAN logs|
|Linux Computer|Processes and analyses recorded data|

### 2.3 Software Components

|Software|Purpose|
|---|---|
|STM32 HAL|Interface with STM32 peripherals|
|bxCAN|CAN frame reception|
|SPI|Communication with MicroSD card|
|FatFS|File system for SD card operations|
|Python|Data processing and analysis|
|python-can|CAN communication and simulation|
|cantools|DBC-based CAN decoding|
|pandas|Data manipulation|
|Plotly|Data visualisation|

---

## 3. Why Store Raw CAN Frames?

A CAN frame contains an identifier, a data length and a payload.

However, the CAN protocol itself does not define what the payload represents.

For example:

```text
CAN ID: 0x123
DLC:    2
DATA:   00 7B
```

The payload `00 7B` represents the decimal value 123 if interpreted as an unsigned big-endian integer.

But does 123 represent current, voltage or temperature?

We cannot determine that from the frame alone.
The interpretation depends on the BMS configuration, including:

- CAN message ID
- Signal position
- Signal length
- Byte order
- Signed or unsigned representation
- Multiplier
- Divider
- Offset

The Orion BMS allows message configurations to be customised. Therefore, hardcoding the decoding logic into STM32 firmware before obtaining the actual configuration would make the firmware unnecessarily dependent on unknown information.

### Our Design Decision

**STM32 will record raw CAN frames. The computer will decode them using the corresponding DBC file.**

### Advantages

1. **Configuration independence:** Changes in CAN message mapping generally require only a DBC update.
2. **Preservation of original data:** Raw payloads remain available for future analysis.
3. **Simpler firmware:** The STM32 does not need to perform complex signal decoding.
4. **Easier debugging:** Engineers can inspect the exact frames received from the BMS.
5. **Offline analysis:** Recorded data can be decoded and analysed even when the vehicle is not running.

---

## 4. Raw CAN Frame Structure

Each received CAN frame contains the following information:

|Field|Description|
|---|---|
|Timestamp|Time at which the frame was received|
|CAN ID|Identifier of the message|
|Extended Flag|Indicates standard or extended CAN identifier|
|DLC|Number of payload bytes|
|Data|Actual payload bytes|

### Example

Suppose the STM32 receives:

```text
CAN ID: 0x200
DLC:    8
DATA:   0F A0 00 7B 80 E8 A4 10
```

The STM32 does not interpret the payload. It extracts the frame information and prepares it for logging.

---

## 5. SD Card Logging Format

We will use CSV (Comma-Separated Values) as the initial storage format.

CSV is easy to inspect, process and import into Python-based analysis tools.

### 5.1 Proposed CSV Schema

```csv
timestamp_us,ext,id,dlc,d0,d1,d2,d3,d4,d5,d6,d7
```

|Column|Description|
|---|---|
|timestamp_us|Frame reception timestamp in microseconds|
|ext|0 = Standard ID, 1 = Extended ID|
|id|CAN identifier in hexadecimal|
|dlc|Number of valid data bytes|
|d0–d7|Raw CAN payload bytes in hexadecimal|

### 5.2 Sample SD Card Log

File: `LOG_0001.CSV`

```csv
timestamp_us,ext,id,dlc,d0,d1,d2,d3,d4,d5,d6,d7
1000000,0,200,8,0F,A0,00,7B,80,E8,A4,10
1100000,0,200,8,0F,9F,00,80,80,E9,A4,11
1200000,0,200,8,0F,9E,FF,F6,80,E8,A4,12
1300000,0,201,4,00,FA,01,2C,,,,
```

The values above are illustrative examples, not confirmed Orion BMS message definitions.

### 5.3 Understanding One CSV Record

```text
1000000,0,200,8,0F,A0,00,7B,80,E8,A4,10
```

This represents:

- Timestamp: 1,000,000 microseconds
- Standard CAN ID: 0x200
- DLC: 8 bytes
- Payload: `0F A0 00 7B 80 E8 A4 10`

The payload is preserved in hexadecimal form.

For frames with a DLC smaller than 8, unused columns remain empty. Only the number of bytes specified by DLC is valid.

---

## 6. Example: Raw Data to Decoded Battery Parameters

Consider the following illustrative CAN payload:

```text
CAN ID: 0x200
DLC:    8
DATA:   0F A0 00 7B 80 E8 A4 10
```

Assume the following signal configuration:

|Bytes|Signal|Byte Order|Multiplier|
|---|---|---|---|
|D0–D1|Pack Voltage|Big Endian|0.1 V|
|D2–D3|Pack Current|Big Endian, Signed|0.1 A|
|D4–D5|Low Cell Voltage|Big Endian|0.0001 V|
|D6–D7|High Cell Voltage|Big Endian|0.0001 V|

### Step 1: Extract Raw Values

```text
Pack Voltage:      0F A0 = 4000
Pack Current:      00 7B = 123
Low Cell Voltage:  80 E8 = 33000
High Cell Voltage: A4 10 = 42000
```

### Step 2: Apply Scaling

General formula:

```text
Physical Value = Raw Value × Multiplier + Offset
```

Calculations:

```text
Pack Voltage = 4000 × 0.1
             = 400 V

Pack Current = 123 × 0.1
             = 12.3 A

Low Cell Voltage = 33000 × 0.0001
                 = 3.3 V

High Cell Voltage = 42000 × 0.0001
                  = 4.2 V
```

### Decoded Output

|Parameter|Decoded Value|
|---|---|
|Pack Voltage|400 V|
|Pack Current|12.3 A|
|Low Cell Voltage|3.3 V|
|High Cell Voltage|4.2 V|

These are demonstration values. Actual decoding must use the saved Orion BMS CAN configuration.

---

## 7. Data Processing on the Computer

After recording, the SD card log files will be transferred to a Linux computer.

The Python processing pipeline will be:

```text
             CSV LOG FILE
                   |
                   v
             PYTHON LOGGER
                   |
                   v
              CSV PARSER
                   |
                   v
              RAW CAN DATA
                   |
                   v
              DBC DECODER
                   |
                   v
           DECODED PARAMETERS
                   |
                   v
            DATA ANALYSIS
                   |
                   v
          TELEMETRY DASHBOARD
```

### DBC File

A DBC file defines the relationship between CAN frames and their signals.

It describes:

- CAN message identifiers
    
- Signal names
    
- Signal positions and lengths
    
- Byte order
    
- Signedness
    
- Scaling and offsets
    

We will use the `cantools` Python library to load the DBC file and decode the recorded CAN frames.

### Dashboard Parameters

The dashboard may display:

- Pack voltage
    
- Pack current
    
- Battery power
    
- Low and high cell voltage
    
- Cell voltage variation
    
- Battery temperatures
    
- Historical parameter graphs
    

The dashboard will initially support offline playback of recorded CSV files.

---

## 8. STM32 Firmware Architecture

The STM32 will be responsible for reliable data acquisition and storage.

### 8.1 CAN Reception

The bxCAN peripheral receives incoming frames.

The firmware will:

1. Configure CAN bitrate and filters.
    
2. Start the CAN peripheral.
    
3. Enable CAN receive notifications.
    
4. Retrieve received frames.
    
5. Capture a timestamp.
    
6. Copy the frame into a RAM ring buffer.
    

### 8.2 RAM Ring Buffer

We will use a ring buffer between CAN reception and SD card writing.

```text
           CAN BUS
               |
               v
          CAN RX ISR
               |
               v
         FRAME CAPTURE
               |
               v
          RING BUFFER
               |
               v
         MAIN LOOP
               |
               v
          BATCH WRITE
               |
               v
            FATFS
               |
               v
           MICROSD
```

The interrupt service routine must remain short.

It should not perform SD card writes.

The main loop will retrieve frames from the buffer and write them in batches.

### Why Is a Ring Buffer Required?

SD card write operations can occasionally take significantly longer than expected.

If the microcontroller tries to write every CAN frame immediately, incoming frames may be lost while the card is busy.

A RAM ring buffer temporarily stores incoming frames until the main loop can write them.

We will also maintain counters for:

- Dropped frames
- CAN FIFO overruns
- Buffer overflow events

These counters will help identify logging reliability problems.

---

## 9. SD Card File Management

A new log file will be created for every power-up or logging session.

Proposed directory structure:

```text
BATTERY_LOGS/
│
├── LOG_0001.CSV
├── LOG_0002.CSV
├── LOG_0003.CSV
│
└── INFO.TXT
```

### INFO.TXT

The metadata file will contain information such as:

```text
Project: Battery Telemetry
Firmware Version: 1.0
CAN Bitrate: 500 kbps
Log Format Version: 1
Start Time: Session timestamp
Dropped Frames: 0
FIFO Overruns: 0
```

The bitrate shown here is an example placeholder, not a confirmed Orion BMS setting.

### File Writing Strategy

- Collect multiple frames in RAM.
- Write data in batches.
- Prefer write sizes aligned to 512-byte multiples.
- Synchronise the file periodically, approximately once per second.
- Record dropped-frame and overrun counters.

The objective is to minimise data loss during unexpected power interruptions.

---

## 10. Development and Testing Plan

Development will be divided into two major stages.

### Stage A: Before STM32 Hardware Is Available

We will develop the PC-side software using Linux and Virtual CAN.

| Task                | Technology         | Expected Result                  |
| ------------------- | ------------------ | -------------------------------- |
| Fake BMS Simulator  | Python, python-can | Simulated battery CAN messages   |
| Virtual CAN Testing | vcan0, can-utils   | Frame transmission and reception |
| CAN Decoder         | Python, cantools   | Raw bytes converted into signals |
| DBC Configuration   | DBC                | Signal definitions               |
| CSV Logger          | Python, pandas     | Recorded CAN data                |
| Automated Testing   | pytest             | Decoder and logger validation    |
| Dashboard           | Plotly, Streamlit  | Battery telemetry visualisation  |

### Stage B: After STM32 Hardware Is Available

| Task                 | Technology                        | Expected Result              |
| -------------------- | --------------------------------- | ---------------------------- |
| Firmware Development | C, STM32 HAL                      | STM32 application            |
| CAN Reception        | bxCAN                             | Hardware CAN reception       |
| CAN Interface        | External transceiver              | Physical CAN connectivity    |
| Data Buffering       | C, RAM                            | Reliable frame buffering     |
| SD Card Interface    | SPI, FatFS                        | Raw CAN logging              |
| Hardware Testing     | USB-CAN adapter / second CAN node | Hardware-in-the-loop testing |
| BMS Integration      | Orion Utility                     | Real battery CAN capture     |

### Final Integration

Once the Orion BMS configuration is available, we will update the DBC file with the actual CAN message definitions.

The same raw logging firmware can then capture the real BMS traffic without requiring signal-specific decoding changes.

All real BMS integration and testing must be performed with the BMS configuration owner’s approval.

---

## 11. Important Design Considerations

1. The STM32 will initially operate as a receive-only data acquisition device.
2. It will not transmit commands or modify the BMS configuration.
3. CAN bitrate and message configuration must be verified before connecting to the vehicle network.
4. Physical bus termination and electrical compatibility must be checked.
5. SD card writes must not block CAN reception.
6. The system must track dropped frames and buffer overruns.
7. Raw CAN data must be preserved for future analysis.
8. The DBC file must correspond to the actual BMS configuration used during the recording session.
9. Timestamps must use a consistent time base.
10. Bench testing must be completed before integration into the vehicle.

---

## 12. Final Objective

The final Battery Telemetry system should provide a reliable method of acquiring, recording and analysing battery data from the Orion BMS 2.

The architecture separates hardware-level data acquisition from software-level data interpretation.

**STM32 handles acquisition and storage. Python handles decoding, processing, testing and visualisation.**

This separation makes the system easier to maintain, debug and adapt to future changes in CAN message configuration.

**Core Architecture:**

```text
DATA ACQUISITION
       ↓
RAW CAN LOGGING
       ↓
DATA PRESERVATION
       ↓
DBC-BASED DECODING
       ↓
DATA ANALYSIS
       ↓
BATTERY TELEMETRY
```