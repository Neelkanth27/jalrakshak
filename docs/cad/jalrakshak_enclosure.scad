/**
 * ==============================================================================
 * Project: JalRakshak — Industrial Edge Water Quality Monitoring System
 * File: docs/cad/jalrakshak_enclosure.scad
 * Description: Parametric 3D Printable Enclosure accommodating a FULL-SIZE 830-POINT
 *              BREADBOARD (MB-102), ESP32 Screw Terminal Shield, Sensor Driver Boards,
 *              Cable Egress with Strain Relief, and Top Lid UI with LED/Buzzer Bezels.
 * Software: OpenSCAD (https://openscad.org), Bambu Studio, Cura, PrusaSlicer
 * ==============================================================================
 */

// ==========================================
// RENDER CONFIGURATION
// Default is "both" so opening directly in OpenSCAD displays the full 3D assembly.
// Set to "base" or "lid" for single-part view.
// ==========================================
PART_TO_PRINT = "both"; // ["base", "lid", "both"]

if (PART_TO_PRINT == "base") {
    enclosure_base();
} else if (PART_TO_PRINT == "lid") {
    enclosure_lid_print_ready();
} else if (PART_TO_PRINT == "both") {
    enclosure_full_assembly();
}

module enclosure_lid_print_ready() {
    // Flipped 180 deg flat on build plate (Z=0) for 100% support-free printing
    translate([box_length, 0, lid_th])
        rotate([0, 180, 0])
            enclosure_lid();
}

module enclosure_full_assembly() {
    enclosure_base();
    translate([0, box_width + 18, 0])
        enclosure_lid_print_ready();
}

// ==========================================
// PARAMETRIC DIMENSIONS (All units in millimeters)
// Sized specifically for:
// - 1x Full-Size 830-Point Breadboard (MB-102: 166mm x 55mm x 9.5mm)
// - 1x ESP32 Screw Terminal Shield (77mm x 55mm)
// - 2x Sensor Driver Modules (TDS 42x32mm + Turbidity 38x28mm)
// - Generous wire routing arch & maintenance slack (48mm outer height)
// ==========================================
box_length      = 195.0; // Outer length (X) — Accommodates 166mm breadboard with margins
box_width       = 145.0; // Outer width (Y)  — Accommodates dual bays: Breadboard (Front) + MCU/Drivers (Rear)
box_height      = 48.0;  // Base height (Z)  — Generous 45.5mm internal cavity for tall jumper wire loops
wall_th         = 2.5;   // Wall thickness (robust 6 perimeters on 0.4mm nozzle)
floor_th        = 2.5;   // Floor thickness
lid_th          = 2.5;   // Lid top face thickness
corner_r        = 4.0;   // Outer corner fillet radius

// Tolerances
lid_clearance   = 0.40;  // FDM thermal shrinkage clearance for easy open/close fit

// Breadboard Bay Specs (Front Bay: Y = 10mm to 70mm)
bb_length       = 168.0; // Fits standard 165-166mm 830-point breadboard with clearance
bb_width        = 56.0;  // Standard MB-102 width with power rails
bb_x_offset     = (box_length - bb_length) / 2; // Centered along X: 13.5mm
bb_y_offset     = 10.0;

// ESP32 Shield Bay Specs (Rear-Left Bay: X = 15mm to 95mm, Y = 78mm to 135mm)
esp_w           = 48.0;  // Hole spacing Y
esp_l           = 68.0;  // Hole spacing X
esp_x           = 16.0;
esp_y           = 80.0;

// Ports & Cable Openings
usb_w           = 14.0;  // Micro-USB / USB-C port width
usb_h           = 9.0;   // Port height
usb_z_offset    = floor_th + 5.0 + 1.6; // Aligned with ESP32 socket plane
usb_y_pos       = esp_y + esp_w / 2;    // Center of ESP32 shield: 104.0mm

cable_slot_w    = 24.0;  // Generous U-slot for 3 thick sensor probe cables
cable_slot_h    = 16.0;  // Height of egress slot from top rim
cable_y_pos     = 105.0; // Centered on sensor driver bay (Right wall)

// Lid Front Panel UI
led_dia         = 5.3;   // 5mm LED through-hole (with 0.3mm print tolerance)
led_spacing     = 16.0;  // Distance between LED centers
buzzer_dia      = 12.0;  // Standard 5V active buzzer diameter
acoustic_hole_d = 2.4;   // Sound aperture hole size

// Screw Boss Settings
boss_dia        = 9.0;   // Beefy 9mm screw bosses
corner_offset   = wall_th + 3.2;

// $fn for smooth curves
$fn = 40;

// ==========================================
// HELPER MODULES
// ==========================================
module rounded_box(x, y, z, r) {
    hull() {
        translate([r, r, 0]) cylinder(r=r, h=z);
        translate([x - r, r, 0]) cylinder(r=r, h=z);
        translate([r, y - r, 0]) cylinder(r=r, h=z);
        translate([x - r, y - r, 0]) cylinder(r=r, h=z);
    }
}

// ==========================================
// 1. BASE ENCLOSURE (LOWER CHASSIS)
// ==========================================
module enclosure_base() {
    difference() {
        union() {
            // 1. Hollow Outer Chassis (Outer walls minus interior pocket)
            difference() {
                rounded_box(box_length, box_width, box_height, corner_r);
                translate([wall_th, wall_th, floor_th])
                    rounded_box(box_length - 2*wall_th, box_width - 2*wall_th, box_height, max(0.5, corner_r - wall_th));
            }

            // 2. Reinforced Screw Boss Pillars (4 Corners + 2 Mid-span for zero lid warping)
            for (pos = [
                [corner_offset, corner_offset],
                [box_length - corner_offset, corner_offset],
                [corner_offset, box_width - corner_offset],
                [box_length - corner_offset, box_width - corner_offset],
                [box_length / 2, corner_offset],
                [box_length / 2, box_width - corner_offset]
            ]) {
                translate([pos[0], pos[1], floor_th - 0.5])
                    cylinder(d=boss_dia, h=box_height - floor_th + 0.5);
            }

            // 3. Breadboard Retaining Alignment Tabs (4 corners of front bay to lock MB-102 in place)
            // Front-Left Tab
            translate([bb_x_offset - 2.5, bb_y_offset - 2.5, floor_th - 0.5])
                cube([2.5, 12, 3.5]);
            translate([bb_x_offset - 2.5, bb_y_offset - 2.5, floor_th - 0.5])
                cube([12, 2.5, 3.5]);
            // Front-Right Tab
            translate([bb_x_offset + bb_length, bb_y_offset - 2.5, floor_th - 0.5])
                cube([2.5, 12, 3.5]);
            translate([bb_x_offset + bb_length - 9.5, bb_y_offset - 2.5, floor_th - 0.5])
                cube([12, 2.5, 3.5]);
            // Rear-Left Tab
            translate([bb_x_offset - 2.5, bb_y_offset + bb_width - 9.5, floor_th - 0.5])
                cube([2.5, 12, 3.5]);
            translate([bb_x_offset - 2.5, bb_y_offset + bb_width, floor_th - 0.5])
                cube([12, 2.5, 3.5]);
            // Rear-Right Tab
            translate([bb_x_offset + bb_length, bb_y_offset + bb_width - 9.5, floor_th - 0.5])
                cube([2.5, 12, 3.5]);
            translate([bb_x_offset + bb_length - 9.5, bb_y_offset + bb_width, floor_th - 0.5])
                cube([12, 2.5, 3.5]);

            // 4. Central Bay Divider Rib (Separating Breadboard from MCU/Drivers with wire pass-through notch)
            difference() {
                translate([wall_th, 72.0, floor_th - 0.5])
                    cube([box_length - 2*wall_th, 2.5, 5.0]);
                // Center 50mm pass-through notch for neat jumper routing between bays
                translate([(box_length - 50)/2, 71.0, floor_th])
                    cube([50, 4.0, 6.0]);
            }

            // 5. ESP32 Expansion Shield Standoffs (4 pillars in Rear-Left Bay)
            for (sp = [
                [esp_x, esp_y],
                [esp_x + esp_l, esp_y],
                [esp_x, esp_y + esp_w],
                [esp_x + esp_l, esp_y + esp_w]
            ]) {
                translate([sp[0], sp[1], floor_th - 0.5])
                    cylinder(d=6.5, h=5.5);
            }

            // 6. Sensor Cable Strain-Relief Anchor Post (Near Right Wall U-Slot)
            translate([box_length - wall_th - 16, cable_y_pos - 7, floor_th - 0.5])
                cube([6, 14, 16.5]);
        }

        // Penetrations & Cutouts:

        // A. Micro-USB / USB-C Port Cutout (Left wall, chamfered top for clean bridging)
        translate([-1, usb_y_pos - usb_w/2, usb_z_offset])
            cube([wall_th + 2, usb_w, usb_h]);

        // B. 3-Sensor Cable Egress Slot (Right wall U-channel down from rim)
        translate([box_length - wall_th - 1, cable_y_pos - cable_slot_w/2, box_height - cable_slot_h])
            cube([wall_th + 2, cable_slot_w, cable_slot_h + 1]);

        // C. Cable Strain-Relief Zip-Tie Dual Slots through Anchor Post
        translate([box_length - wall_th - 17, cable_y_pos - 4, floor_th + 5])
            cube([8, 8, 3.5]);
        translate([box_length - wall_th - 17, cable_y_pos - 4, floor_th + 11])
            cube([8, 8, 3.5]);

        // D. M3 Screw Pilot Holes in All 6 Bosses (2.8mm tap hole)
        for (pos = [
            [corner_offset, corner_offset],
            [box_length - corner_offset, corner_offset],
            [corner_offset, box_width - corner_offset],
            [box_length - corner_offset, box_width - corner_offset],
            [box_length / 2, corner_offset],
            [box_length / 2, box_width - corner_offset]
        ]) {
            translate([pos[0], pos[1], floor_th + 2])
                cylinder(d=2.8, h=box_height - floor_th + 1);
        }

        // E. ESP32 PCB Standoff Pilot Holes (2.4mm for M2.5 self-tapping screws)
        for (sp = [
            [esp_x, esp_y],
            [esp_x + esp_l, esp_y],
            [esp_x, esp_y + esp_w],
            [esp_x + esp_l, esp_y + esp_w]
        ]) {
            translate([sp[0], sp[1], floor_th + 5.0 - 4.5])
                cylinder(d=2.4, h=5.0);
        }
    }
}

// ==========================================
// 2. TOP ENCLOSURE LID (UPPER COVER WITH FRONT PANEL UI)
// ==========================================
module enclosure_lid() {
    lip_h = 3.5;
    lid_total_h = lid_th + lip_h;

    difference() {
        union() {
            // Main Top Plate Face
            rounded_box(box_length, box_width, lid_th, corner_r);

            // Alignment Lip (Continuous inner perimeter snap-ridge)
            translate([wall_th + lid_clearance, wall_th + lid_clearance, -lip_h])
                rounded_box(
                    box_length - 2*(wall_th + lid_clearance),
                    box_width - 2*(wall_th + lid_clearance),
                    lip_h + 0.1,
                    max(0.5, corner_r - wall_th - lid_clearance)
                );
        }

        // Hollow the interior alignment lip
        translate([wall_th * 2 + lid_clearance, wall_th * 2 + lid_clearance, -lip_h - 1])
            cube([box_length - 4*wall_th - 2*lid_clearance, box_width - 4*wall_th - 2*lid_clearance, lip_h + 1]);

        // ==========================================
        // 3× EXTERNAL STATUS LED BEZEL HOLES (5mm LEDs)
        // Positioned centrally for balanced wire reach from both bays
        // ==========================================
        led_center_x = 75.0;
        led_center_y = box_width / 2;

        // Green (NORMAL)
        translate([led_center_x - led_spacing, led_center_y, -lip_h - 1])
            cylinder(d=led_dia, h=lid_total_h + 2);

        // Yellow (WARNING)
        translate([led_center_x, led_center_y, -lip_h - 1])
            cylinder(d=led_dia, h=lid_total_h + 2);

        // Red (ALARM)
        translate([led_center_x + led_spacing, led_center_y, -lip_h - 1])
            cylinder(d=led_dia, h=lid_total_h + 2);

        // ==========================================
        // BUZZER ACOUSTIC GRILLE (7-hole aperture cluster)
        // ==========================================
        buzzer_x = 125.0;
        buzzer_y = box_width / 2;

        // Center acoustic hole
        translate([buzzer_x, buzzer_y, -lip_h - 1])
            cylinder(d=acoustic_hole_d + 0.6, h=lid_total_h + 2);

        // 6 Surrounding acoustic vent holes
        for (a = [0:60:300]) {
            translate([buzzer_x + 4.2 * cos(a), buzzer_y + 4.2 * sin(a), -lip_h - 1])
                cylinder(d=acoustic_hole_d, h=lid_total_h + 2);
        }

        // ==========================================
        // 6× M3 SCREW COUNTERSINK HOLES (4 Corners + 2 Mid-span)
        // ==========================================
        for (pos = [
            [corner_offset, corner_offset],
            [box_length - corner_offset, corner_offset],
            [corner_offset, box_width - corner_offset],
            [box_length - corner_offset, box_width - corner_offset],
            [box_length / 2, corner_offset],
            [box_length / 2, box_width - corner_offset]
        ]) {
            // Screw shank clearance
            translate([pos[0], pos[1], -lip_h - 1])
                cylinder(d=3.4, h=lid_total_h + 2);
            // M3 Countersink head pocket (Flush fit)
            translate([pos[0], pos[1], lid_th - 1.2])
                cylinder(d1=3.4, d2=6.4, h=1.4);
        }

        // ==========================================
        // EMBOSSED TECHNICAL LABELS (0.6mm debossed into lid)
        // ==========================================
        // LED Indicator Labels
        translate([led_center_x - led_spacing, led_center_y + 9, lid_th - 0.6])
            linear_extrude(height=1)
            text("NORM", size=3.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([led_center_x, led_center_y + 9, lid_th - 0.6])
            linear_extrude(height=1)
            text("WARN", size=3.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([led_center_x + led_spacing, led_center_y + 9, lid_th - 0.6])
            linear_extrude(height=1)
            text("ALRM", size=3.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        // Buzzer Siren Label
        translate([buzzer_x, buzzer_y + 9, lid_th - 0.6])
            linear_extrude(height=1)
            text("SIREN", size=3.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        // Main Station Branding
        translate([box_length/2, box_width - 14, lid_th - 0.6])
            linear_extrude(height=1)
            text("JALRAKSHAK SCADA NODE", size=5.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([box_length/2, 14, lid_th - 0.6])
            linear_extrude(height=1)
            text("EDGE WATER QUALITY MONITORING  BIS IS 10500:2012", size=3.4, font="Liberation Sans:style=Bold", halign="center", valign="center");
    }
}
