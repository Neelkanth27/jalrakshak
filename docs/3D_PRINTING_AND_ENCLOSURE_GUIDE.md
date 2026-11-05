# JalRakshak — 3D Printable Industrial Enclosure Specification & Assembly Guide

This document provides complete manufacturing specifications, 3D printing parameters, and assembly instructions for the custom custom-engineered **JalRakshak SCADA Node Enclosure**.

---

## 1. Enclosure Design & Mechanical Overview

The enclosure is designed as a rugged, compact, two-part protective chassis (Base Body + Top Bezel Lid) engineered specifically for the ESP32 microcontroller, dual sensor driver PCBs, audio buzzer, and visual status indicators.

```
                      JALRAKSHAK SCADA NODE
     ┌─────────────────────────────────────────────────────────┐
     │                      130.0 mm                           │
     │   ┌─────────────────────────────────────────────────┐   │
     │   │                                                 │   │
     │   │   [NORM]    [WARN]    [ALRM]         ( ::: )    │   │
  90 │   │    (O)       (O)       (O)           SIREN      │   │
  mm │   │   Green     Yellow     Red         7-Hole Vent  │   │
     │   │                                                 │   │
     │   └─────────────────────────────────────────────────┘   │
     │                                                         │
[USB]│◄── 13x8.5mm USB Cutout       18x12mm Sensor Egress ────►│[PROBES]
Port │    (Removable Power)         (Turb, TDS, Temp)          │Slot
     └─────────────────────────────────────────────────────────┘
```

### Key Mechanical Features:
1. **3× Top Bezel Indicator Holes (5.3 mm)**:
   * Sized with a standard +0.3 mm FDM print tolerance for 5 mm LEDs.
   * Spaced 14 mm apart with debossed technical status labels:
     - `NORM` $\rightarrow$ Green LED (Normal / Potable baseline)
     - `WARN` $\rightarrow$ Yellow LED (Warning / Permissible drift)
     - `ALRM` $\rightarrow$ Red LED (Alarm / Critical contamination)
2. **Buzzer Acoustic Sound Grille**:
   * Circular 7-hole cluster (center 3.0 mm + 6 surrounding 2.4 mm holes) located directly above the 12 mm active buzzer.
   * Ensures the 2.6 kHz alarm tone radiates clearly without muffled internal resonance.
3. **Removable USB Power Port (Side Wall)**:
   * 13.0 mm $\times$ 8.5 mm rectangular port on the left wall aligned with the ESP32 micro-USB / USB-C socket.
   * Allows the power cable to be easily plugged in or unplugged without having to open the case.
4. **3-Sensor Cable Egress Port & Strain Relief (Opposite Wall)**:
   * 18.0 mm $\times$ 12.0 mm U-channel slot on the right wall accommodating:
     - Optical Turbidity waterproof probe cable (4.0 mm OD)
     - Analog TDS probe cable (3.5 mm OD)
     - DS18B20 stainless steel temperature probe cable (4.0 mm OD)
   * Features an integrated internal anchor post with a zip-tie slot: clamping the cables internally ensures that pulling or bumping the sensor wands never strains the soldered pins or screw terminals!
5. **Secure Dual-Closure System**:
   * **Snap-Fit Friction Flange**: 3.5 mm inner lip with 0.35 mm clearance for tool-less snap-fit inspection.
   * **M3 Corner Screw Bosses**: 4 corner columns designed for M3 $\times$ 10 mm self-tapping or machine screws for permanent, tamper-resistant field installations.

---

## 2. 3D Printing & Slicer Configuration

The parametric design file is located at:
📁 **[`docs/cad/jalrakshak_enclosure.scad`](file:///C:/Users/ATHARVA/.gemini/antigravity/scratch/jalrakshak/docs/cad/jalrakshak_enclosure.scad)**

### Recommended Slicer Settings (Cura / PrusaSlicer / Bambu Studio / OrcaSlicer):

| Parameter | Recommended Value | Engineering Rationale |
| :--- | :--- | :--- |
| **Material** | **PETG** (or tough PLA+) | PETG offers superior UV resistance, water splash tolerance, and layer adhesion. PLA+ is also suitable for indoor bench testing. |
| **Layer Height** | **0.20 mm** (Standard) | Optimal balance between printing speed and dimensional accuracy. |
| **Wall Loops (Perimeters)** | **4 to 6 walls** (min 2.0 mm) | Guarantees the 2.4 mm outer shell is printed as solid plastic without void pockets, maximizing mechanical rigidity. |
| **Top / Bottom Layers** | **5 layers** (1.0 mm) | Prevents pillowing and ensures watertight top face. |
| **Infill Density** | **20% to 25%** | Sufficient internal strength for screw bosses and floor. |
| **Infill Pattern** | **Gyroid** (or Honeycomb) | Provides uniform multi-directional stress resistance. |
| **Supports** | **None required!** | The enclosure is designed with flat planar orientations. All bridge overhangs (USB port and cable slot) are under 18 mm and bridge cleanly without support material. |
| **Print Bed Orientation** | **Base flat on floor; Lid face-down on bed** | Placing the lid face-down ensures the debossed technical text (`JALRAKSHAK`, `NORM`, `WARN`) gets a smooth, professional bed-textured finish. |

### Approximate Print Time & Material Weight:
* **Base Lower Body**: ~75g filament | ~2.5 to 3.5 hours
* **Top Bezel Lid**: ~35g filament | ~1.0 to 1.5 hours
* **Total Filament Used**: ~110 grams (Cost: ~₹90–₹130 INR)

---

## 3. How to Generate STL Files from OpenSCAD

1. Download and install [OpenSCAD](https://openscad.org/downloads.html) (free & open source).
2. Open [`docs/cad/jalrakshak_enclosure.scad`](file:///C:/Users/ATHARVA/.gemini/antigravity/scratch/jalrakshak/docs/cad/jalrakshak_enclosure.scad) in OpenSCAD.
3. **To export the Base**:
   - Set line 15: `PART_TO_PRINT = "base";`
   - Press **F6** (Render), then press **F7** (Export as STL). Save as `jalrakshak_base.stl`.
4. **To export the Lid**:
   - Set line 15: `PART_TO_PRINT = "lid";`
   - Press **F6** (Render), then press **F7** (Export as STL). Save as `jalrakshak_lid.stl`.
5. Open the `.stl` files in your 3D slicer (Cura / Bambu Studio) and send to your 3D printer!

---

## 4. Final Assembly Sequence

```
Step 1: Mount ESP32 Expansion Shield to base floor standoffs (4x M2.5 screws).
Step 2: Place TDS and Turbidity driver PCBs alongside the ESP32.
Step 3: Route the 3 sensor cables through the right egress slot.
Step 4: Tighten a small zip-tie through the internal anchor post to lock cables.
Step 5: Insert the 3 LEDs (Green, Yellow, Red) into the top lid bezel holes.
Step 6: Mount the active buzzer directly under the 7-hole acoustic grille.
Step 7: Connect the neat jumper wires between boards and ESP32 terminals.
Step 8: Press the lid onto the base (or fasten 4x M3 corner screws).
Step 9: Plug in the USB power cable through the left side cutout.
```
