# JalRakshak: Operator Handbook & Field Demonstration Guide

> **Author / Project Creator**: `devangmittal11@gmail.com`  
> **System**: Low-Cost Multi-Sensor Edge-to-Cloud Water Quality SCADA Station  
> **Standard Compliance**: Bureau of Indian Standards (BIS) IS 10500:2012  
> **Live Web App**: [https://jalrakshak-rosy.vercel.app](https://jalrakshak-rosy.vercel.app)  
> **Alert Bot**: `@jalrakshak_test_bot` on Telegram  

---

## 1. Quick Start & Setup (Before Presenting)

### 1.1 Powering the Hardware
* **Power Source**: Plug the ESP32's USB cable directly into **any laptop USB port** (USB 2.0 or 3.0).
* **No External Battery Needed**: The entire node consumes $\approx 1.6\text{W}$ ($320\text{mA}$ peak), well below the 2.5W–4.5W provided by standard laptop USB ports.
* **Boot Time**: Boots and stabilizes within **1.5 seconds**. All three LEDs (Green, Yellow, Red) will flash once on startup as a self-test.

### 1.2 Wi-Fi & Hotspot Connection (How to Connect to the Net)

The ESP32 communicates directly with the cloud SCADA backend over Wi-Fi. You have **two ways** to connect:

#### Method A: The 10-Second Hotspot Setup (Zero Coding / Recommended)
To run your project immediately without opening any software or touching code:
1. Open **Personal Hotspot** settings on your smartphone.
2. Set the Hotspot Name (SSID) to: **`Aths`**
3. Set the Hotspot Password to: **`s27gb9yu`**
4. ⚠️ **ENABLE 2.4 GHz**:
   - **iPhone**: Switch ON **"Maximize Compatibility"**.
   - **Android**: Set AP Band to **2.4 GHz Band** (not 5 GHz).
5. Turn the hotspot ON, then plug the ESP32 into your laptop USB port.
6. The ESP32 will connect automatically in under 3 seconds!

#### Method B: Changing to Your Own Wi-Fi / Hotspot via Arduino IDE
If you want the ESP32 to connect to your personal home/college Wi-Fi or your own phone hotspot name:
1. Connect the ESP32 to your laptop using the USB cable.
2. Open the project file **`firmware/firmware.ino`** in **Arduino IDE**.
3. Scroll to **Lines 57–58**:
   ```cpp
   // Enter your smartphone mobile hotspot name and password below:
   const char* WIFI_SSID     = "Your_Hotspot_Name"; 
   const char* WIFI_PASSWORD = "Your_Hotspot_Password";
   ```
4. Replace `"Your_Hotspot_Name"` and `"Your_Hotspot_Password"` with your actual Wi-Fi details (remember: must be a 2.4 GHz network).
5. In Arduino IDE:
   - Go to **Tools** $\to$ **Board** $\to$ **esp32** $\to$ select **"DOIT ESP32 DEVKIT V1"** (or "ESP32 Dev Module").
   - Go to **Tools** $\to$ **Port** $\to$ select your ESP32's **COM port** (e.g. `COM3`, `COM4`).
6. Click the **Upload** button (Right-arrow icon).
7. Wait $\approx 25$ seconds until it says *"Done uploading"*.
8. Open the Serial Monitor (magnifying glass icon, set to **115200 baud**). You will see:
   ```text
   === JALRAKSHAK ESP32 DEVKIT V1 INITIALIZING ===
   ....
   [Wi-Fi] Connected! Local IP: 192.168.x.x
   ```
9. Your hardware is now permanently configured for your network!

---

## 2. Sensor Handling & Immersion Golden Rules

Proper handling of the sensor probes makes the difference between flawless data and erratic readings during a live demonstration.

```
       [ TDS PROBE ]               [ TURBIDITY PROBE ]             [ TEMP PROBE ]
       ┌───────────┐                 ┌─────────────┐                │            │
       │   CABLE   │ (Keep Dry)      │    CABLE    │ (Keep Dry)     │   CABLE    │ (Waterproof)
       └─────┬─────┘                 └──────┬──────┘                │            │
             │                              │                       │   METAL    │
      ┌──────┴──────┐                 ┌─────┴──────┐                │   TUBE     │
 ───  │ WHITE BODY  │ ── Water Line ──│ OPTICAL HEAD ── Water Line ──│ (Submerge  │ ───
      │ 2-3 cm ONLY │                 │ U-GAP ONLY │                │  5-10 cm)  │
      └─────┬─┬─────┘                 └─────┬─┬────┘                │            │
            │ │ (Metal Pins)                │ │ (Infrared Gap)      └────────────┘
```

### 2.1 Container Material: NEVER Use Metal!
* 🛑 **Use PLASTIC or GLASS cups ONLY**:
  * The TDS probe works by transmitting a high-frequency alternating electric field ($AC$) between its two pins.
  * If you put the water in a **steel or metal tumbler**, the metal container walls will conduct and ground the electric field! The sensor will read **$0.0\text{ ppm}$** even if the water is full of salt!
  * **Always use clear plastic disposable cups or glass tumblers.**

### 2.2 Immersion Depths (How Deep to Dip):

#### A. TDS Probe (White cylindrical probe with 2 metal prongs):
* **Appearance**: White molded plastic probe body with two exposed gold/titanium electrode pins at the tip.
* **Immersion Depth**: Submerge **only the bottom 2 to 3 cm (about 1 inch)** so that the two metal pins are completely underwater.
* **Keep Dry**: Keep the top cable joint dry. Do NOT submerge the entire cable underwater.
* **Bubble Removal**: If you dip it in water and it reads 0 ppm, an air bubble might be trapped between the two pins. **Give the probe a gentle tap or stir** in the water to dislodge bubbles.

#### B. Optical Turbidity Sensor (Black U-shaped probe):
* **Immersion Depth**: Submerge **only the lower U-shaped optical gap** (about 3 to 4 cm). The light path between the two prongs must be underwater.
* **Keep Dry**: Keep the upper circular joint and connecting wires completely dry.
* **Adapter Board Switch**: The little blue/black circuit board connected to the turbidity probe has a slide switch: **It MUST be set to "A" (Analog)**, never "D" (Digital)!

#### C. DS18B20 Temperature Probe (Silver metal cylinder):
* **Immersion Depth**: Fully waterproof! You can submerge the silver metal tube **5 to 10 cm deep**.
* Can stay submerged indefinitely.

### 2.3 Rinsing Between Cups (The Carryover Trap):
* When you take the TDS probe out of **Cup 2 (Salt Water)**, a thin layer of salt water stays stuck between the two pins.
* If you dip it directly into **Cup 1 (Clean Water)** without wiping, it will carry salt into the clean cup and read 150–200 ppm instead of pristine!
* **Pro-Tip**: Keep a small paper napkin or a separate "Rinse Cup" of clean water. Swish the probes in the rinse cup and lightly dab them dry before putting them into clean water.

---

## 3. Step-by-Step Live Demonstration Script

Here is the exact demonstration flow to follow when presenting to teachers, examiners, or executives:

```
[ CUP 1: Clean Water ]  ───>  [ CUP 2: Salt Anomaly ]  ───>  [ CUP 3: Silt / Turbid ]
  • WQI: 95 - 100               • WQI: < 40                   • WQI: 0 - 30
  • State: NORMAL               • State: ALARM                • State: ALARM
  • LED: Green                  • LED: Red (Buzzer @ 30s)     • LED: Red (Sediment)
```

### Stage 1: The Clean Baseline (Cup 1)
1. Fill Cup 1 with standard clean tap water or drinking water.
2. Submerge the TDS probe (2 cm), Turbidity probe (U-gap), and Temperature probe.
3. **Show the Evaluator**:
   * Hardware: **Green LED (`D18`) is solidly ON**. Buzzer is silent.
   * Dashboard (`jalrakshak-rosy.vercel.app`):
     * WQI reads **`95 – 100`** with green badge **`POTABLE • SAFE FOR CONSUMPTION`**.
     * Turbidity reads **`< 5 NTU`**.
     * TDS reads **`50 – 250 ppm`**.
     * Temperature displays actual fluid temperature (e.g. **`25 – 27 °C`**).
     * Top header displays **`Siren Armed`** (quiet slate badge, locked/non-clickable).

### Stage 2: Chemical & Saline Anomaly (Cup 2)
1. Fill Cup 2 with water and dissolve **half a teaspoon of table salt**.
2. Move the probes into Cup 2.
3. **Show the Evaluator**:
   * Hardware: **Red LED (`D23`) turns ON immediately**.
   * Dashboard:
     * TDS shoots up to **`600 – 780 ppm`**.
     * WQI drops to **`< 45`** (Critical Hazard).
     * Anomaly Banner triggers: **`Chemical / Saline Infiltration`**.
     * Header button lights up in red and unlocks: **`[Acknowledge & Mute Siren]`**.
4. **The 30-Second Qualification Demo**:
   * Explain: *"Notice the buzzer didn't scream instantly. This is our industrial 30-second continuous debounce to prevent false alarms from temporary fluid splashes."*
   * At exactly second 30, the **buzzer will sound loudly at 2600 Hz** and your **Telegram bot (`@jalrakshak_test_bot`) will ping an instant alert** with the IST timestamp.
5. **The Remote Cloud Mute Demo**:
   * Click **`Acknowledge & Mute Siren`** on your phone or laptop dashboard.
   * Within 3 seconds, the buzzer will shut off! The button flips to emerald green: **`[Buzzer Muted (Turn ON)]`**.
   * Explain: *"This demonstrates bidirectional SCADA control—operators can acknowledge and silence factory sirens remotely from their phone."*

### Stage 3: Silt / Sediment Anomaly (Cup 3)
1. Rinse the probes and place them in Cup 3.
2. Add **2 to 3 drops of milk** (or a pinch of soil), OR simply **block the U-gap with your finger or paper**.
3. **Show the Evaluator**:
   * Hardware: **Red LED (`D23`) turns ON**.
   * Dashboard:
     * Turbidity spikes to **`> 500 – 2800 NTU`**.
     * Smart Diagnosis correctly identifies: **`Severe Sediment / Particulate Intrusion`**.
   * Explain: *"Notice our algorithm didn't just say 'water is bad'—it cross-referenced optical transmittance with conductivity and diagnosed that this is a physical particulate problem (sediment), not a chemical salt problem."*

### Stage 4: 1-Click Executive PDF Inspection Certificate
1. With the data on screen, click the **"Inspection Certificate"** button in the top navigation bar.
2. The browser instantly downloads a signed, official PDF report containing:
   * Test batch ID, timestamp, and hardware node ID (`ESP32_JALRAKSHAK_01`).
   * Full measurement table vs. BIS IS 10500:2012 standards.
   * Root-cause diagnosis and formal sign-off lines.
3. Hand the PDF to the evaluator or display it on screen!

---

## 4. Bench Troubleshooting Matrix (Presentation Emergency Guide)

If something doesn't look right during your presentation, use this quick checklist:

| Symptom | Probable Cause | Immediate 10-Second Fix |
| :--- | :--- | :--- |
| **Dashboard shows `NODE OFFLINE • UNPOWERED`** | ESP32 cannot reach Wi-Fi hotspot. | 1. Ensure phone hotspot is ON.<br/>2. Ensure hotspot is set to **2.4 GHz** (turn on "Maximize Compatibility").<br/>3. Unplug and replug the USB cable to reboot the ESP32. |
| **TDS reads flat `0.0 ppm` in salt water** | Conductive metal cup used, OR air bubble trapped. | 1. **Switch to a plastic or glass cup immediately.**<br/>2. Shake the probe underwater to dislodge air bubbles from between the pins. |
| **Temperature displays stuck at `24.5 °C`** | 1-Wire signal wire or 4.7kΩ pull-up resistor loose. | 1. Check Yellow wire in screw terminal `4`.<br/>2. Ensure 4.7kΩ resistor is firmly clamped between Yellow (Data) and Red (3.3V). |
| **Turbidity reads `2800 NTU` in clean water** | Sensor adapter slide switch set to 'D' (Digital), or sensor not powered. | 1. Slide the switch on the small adapter board to **`A`** (Analog).<br/>2. Verify the red power LED on the sensor adapter board is glowing. |
| **Buzzer won't stop beeping** | Sustained anomaly is active. | Tap **"Mute Siren"** on your web dashboard, or press the built-in **`BOOT` button (GPIO 0)** on the ESP32 board. |
| **Water Quality increased when I touched the temperature probe** | Normal $EC_{25}$ temperature compensation. | When the temp probe gets warm, the math assumes warm water has faster ions and mathematically lowers the estimated salt content. Keep all probes in the same water. |
| **Status LEDs are not turning ON** | LED polarity reversed. | The longer leg of the LED is Positive (Anode) connected to the GPIO resistor; the flat notch side is Ground (Cathode) connected to the Blue (-) Rail. |

---

## 5. Master Defense Answers (For Teachers & Examiners)

When superiors or professors ask technical questions, use these concise, textbook answers:

#### Q: "How does your system differentiate between mud and salt?"
> **Your Answer**: *"We use multi-modal sensor fusion. The optical turbidity sensor uses 940nm infrared nephelometry to measure physical light scattering from suspended particles (like silt and mud), while the TDS sensor uses high-frequency AC conductivity to measure dissolved ions (like sodium chloride and minerals). Our classification algorithm computes the non-dimensional Z-score for both channels. If Turbidity Z dominates, it flags **Sediment Intrusion**; if TDS Z dominates, it flags **Chemical Infiltration**; if both spike, it flags **Surface Runoff**."*

#### Q: "Why did you use Euclidean distance instead of a weighted linear average?"
> **Your Answer**: *"Linear weighted averages have a fatal flaw called the 'masking effect'—if water has zero mud but a toxic amount of salt, a linear average dilutes the alert and gives a falsely reassuring score. By calculating the Euclidean distance in 2D space ($S = \sqrt{z_{\text{turb}}^2 + z_{\text{tds}}^2}$), if any single parameter spikes critically, the squared term dominates mathematically and immediately triggers the ALARM state."*

#### Q: "Why is there an active buzzer qualification delay of 30 seconds?"
> **Your Answer**: *"In real industrial plumbing and water supply networks, transient air bubbles, pipe valve switching, and fluid splashes cause temporary 1-to-3 second sensor spikes. If our system alarmed immediately, it would suffer from constant false alarms and operator fatigue. Our 30-second continuous qualification timer acts as an industrial debounce—the Red LED alerts instantly, but the siren only triggers if the contamination is sustained and verified."*

#### Q: "Why did you power the analog sensors with 3.3V instead of 5V?"
> **Your Answer**: *"The ESP32's internal 12-bit ADC multiplexer has a strict maximum input rating of 3.3V. If we powered the TDS sensor from the 5V rail, its operational amplifier output could swing up to 3.8V in heavy salt, which would permanently burn out the microcontroller's ADC pin. By powering the conditioning circuit from the regulated 3.3V rail, the maximum possible output is physically limited to $\approx 1.85\text{V}$, providing inherent hardware overvoltage protection."*

#### Q: "Why does the temperature reading affect the TDS score?"
> **Your Answer**: *"Water electrical conductivity has a temperature coefficient of approximately $+2.0\% \text{ per } ^\circ\text{C}$ because fluid viscosity drops and ions move faster at higher temperatures. Without compensation, normal summer heat would falsely trigger contamination alarms. Our firmware applies international $EC_{25}$ compensation to normalize all conductivity measurements back to the standard reference of $25.0^\circ\text{C}$."*

---

## 6. Enclosure Layout & Driver Boards Arrangement

The 3D printed enclosure (`docs/cad/jalrakshak_enclosure.scad`) is designed with dedicated internal bays for all components:

```
┌─────────────────────────────────────────────────────────────┐
│                      ENCLOSURE TOP VIEW                     │
│                                                             │
│  [LEFT BAY: MCU CONTROLLER]     [RIGHT BAY: SENSOR DRIVERS] │
│  ┌────────────────────────┐     ┌────────────────────────┐  │
│  │                        │     │ TDS Driver Board       │  │
│  │ ESP32 DevKit V1 &      │     │ (32mm × 42mm)          │  │
│  │ Expansion Shield       │     ├────────────────────────┤  │
│  │ (Screw Terminals)      │     │ Turbidity SEN0189      │  │ ===> Cable
│  │                        │     │ Adapter Board (38×28mm)│  │      Egress
│  └────────────────────────┘     └────────────────────────┘  │      Slot
│         ▲                                    ▲              │      (3 Probes)
│   USB Port Cutout                    Divider Rib &          │
│   (Side Wall)                        Zip-Tie Clamp          │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Does the Enclosure Have Space for the Sensor Drivers?
**YES, absolutely.**
* **Interior Dimensions**: $130.2\text{ mm (Length)} \times 90.2\text{ mm (Width)} \times 39.6\text{ mm (Height)}$.
* **Left Bay**: Mounts the ESP32 expansion shield on 4 raised M2.5 standoffs directly aligning with the left-wall Micro-USB/USB-C cutout.
* **Right Bay ($40\text{mm} \times 85\text{mm}$ Cavity)**: Specifically reserved to hold:
  1. The **Gravity TDS Analog Adapter Board** ($32\text{mm} \times 42\text{mm}$).
  2. The **Optical Turbidity SEN0189 Adapter Board** ($28\text{mm} \times 38\text{mm}$).
* **Height Headroom ($42\text{ mm}$)**: Standard jumper wires arch upward by $15\text{ mm}$ when connected to screw terminals. The $42\text{ mm}$ total box height ensures that jumper wires and the active buzzer underneath the top lid fit comfortably without being squished or pinched.
* **Cable Strain Relief**: The right egress slot includes an internal anchor post where you can wrap a small zip-tie around the 3 probe cables. This prevents accidental tugs on the cables from pulling wires out of the screw terminals.
