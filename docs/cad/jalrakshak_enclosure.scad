/**
 * ==============================================================================
 * Project: JalRakshak — Industrial Edge Water Quality Monitoring System
 * File: docs/cad/jalrakshak_enclosure.scad
 * Description: 100% SUPPORT-FREE Parametric 3D Printable Enclosure accommodating:
 *              - 1x Full-Size 830-Point Breadboard (MB-102: 166mm x 55mm)
 *              - 1x ESP32 Screw Terminal Shield (77mm x 55mm)
 *              - 2x Sensor Driver Modules (TDS + Turbidity) directly adjacent
 *              - Clustered layout optimized for SHORT JUMPER WIRES (all reaches < 50mm)
 *              - 100% Support-Free 45° chamfered USB lintel + zero-overhang flat lid
 *              - Dedicated pre-supported STL option for vendors requesting support files
 * Software: OpenSCAD (https://openscad.org), Bambu Studio, Cura, PrusaSlicer
 * ==============================================================================
 */

// ==========================================
// RENDER CONFIGURATION
// Default is "both" so opening directly in OpenSCAD displays the full 3D assembly.
// Set to "base", "base_supported", "lid", or "both"
// ==========================================
PART_TO_PRINT = "both"; // ["base", "base_supported", "lid", "both"]

if (PART_TO_PRINT == "base") {
    enclosure_base(with_built_in_supports = false);
} else if (PART_TO_PRINT == "base_supported") {
    enclosure_base(with_built_in_supports = true);
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
    enclosure_base(with_built_in_supports = false);
    translate([0, box_width + 18, 0])
        enclosure_lid_print_ready();
}

// ==========================================
// PARAMETRIC DIMENSIONS (All units in millimeters)
// Clustered architecture:
// Front Bay: Full-size 830-point breadboard (166 x 55 mm)
// Rear Bay:  ESP32 Shield (left) + TDS Board (center) + Turbidity Board (right)
//            Direct adjacent spacing guarantees that even 10cm jumper wires
//            and short sensor leads reach with >50% slack!
// ==========================================
box_length      = 195.0; // Outer length (X)
box_width       = 145.0; // Outer width (Y)
box_height      = 46.0;  // Base height (Z) — 43.5mm internal clearance (plenty of arch room, minimal vertical lift)
wall_th         = 2.5;   // Wall thickness (robust 6 perimeters on 0.4mm nozzle)
floor_th        = 2.5;   // Floor thickness
lid_th          = 2.5;   // Lid top face thickness
corner_r        = 4.0;   // Outer corner fillet radius

// Tolerances
lid_clearance   = 0.40;  // FDM thermal shrinkage clearance for easy open/close fit

// Breadboard Bay Specs (Front Bay: Y = 9mm to 68mm)
bb_length       = 168.0; // Fits standard 165-166mm 830-point breadboard
bb_width        = 56.0;  // Standard MB-102 width with power rails
bb_x_offset     = (box_length - bb_length) / 2; // Centered along X: 13.5mm
bb_y_offset     = 9.0;

// Rear Bay Cluster (Y = 74mm to 135mm):
// 1. ESP32 Shield (Rear-Left): X = 16 to 93 mm
esp_w           = 48.0;  // Mounting hole spacing Y
esp_l           = 68.0;  // Mounting hole spacing X
esp_x           = 18.0;
esp_y           = 80.0;

// 2. TDS Driver Board (Rear-Center): X = 98 to 142 mm, Y = 82 to 124 mm
// 3. Turbidity Driver Board (Rear-Right): X = 146 to 186 mm, Y = 82 to 120 mm

// USB Port Cutout (Left Wall at X = 0)
// Designed with a 45-degree self-supporting peaked arch (lintel)
// so the 3D printer bridges zero overhang and prints 100% support-free!
usb_w           = 14.0;  // Port width
usb_h           = 8.5;   // Port rectangular height
usb_z_offset    = floor_th + 5.0 + 1.6; // Aligned with ESP32 socket plane
usb_y_pos       = esp_y + esp_w / 2;    // Center of ESP32 shield: 104.0mm

// Cable Openings (Right Wall at X = box_length)
// U-channel slot cuts from top rim down — 100% support-free (no roof)
cable_slot_w    = 24.0;  // Wide enough for all 3 thick waterproof sensor probe cables
cable_slot_h    = 16.0;  // Height of egress slot
cable_y_pos     = 105.0; // Directly next to TDS and Turbidity driver boards

// Lid Front Panel UI (Centered over the wire corridor for shortest vertical wire reach)
led_dia         = 5.3;   // 5mm LED through-hole
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

// 45-degree Self-Supporting USB Port Aperture (Prints 100% Support-Free)
module self_supporting_usb_cutout() {
    hull() {
        // Lower rectangular body
        translate([-1, usb_y_pos - usb_w/2, usb_z_offset])
            cube([wall_th + 2, usb_w, usb_h]);
        // 45-degree peaked roof apex
        translate([-1, usb_y_pos, usb_z_offset + usb_h + usb_w/2])
            cube([wall_th + 2, 0.1, 0.1]);
    }
}

// ==========================================
// 1. BASE ENCLOSURE (LOWER CHASSIS)
// ==========================================
module enclosure_base(with_built_in_supports = false) {
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

            // 3. Breadboard Retaining Alignment Tabs (Lock MB-102 snugly in place)
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

            // 4. Central Bay Divider Rib with generous 60mm wire routing pass-through
            difference() {
                translate([wall_th, 70.0, floor_th - 0.5])
                    cube([box_length - 2*wall_th, 2.5, 5.0]);
                // Wide 60mm pass-through notch right between Breadboard and ESP32
                translate([esp_x + 5, 69.0, floor_th])
                    cube([60, 4.0, 6.0]);
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

            // 6. Sensor Driver Alignment Retaining Ridges (TDS and Turbidity bays)
            // TDS board bracket locator (Floor guide tabs)
            translate([100.0, 80.0, floor_th - 0.5])
                cube([2.0, 35.0, 2.5]);
            // Turbidity board bracket locator
            translate([145.0, 80.0, floor_th - 0.5])
                cube([2.0, 35.0, 2.5]);

            // 7. Sensor Cable Strain-Relief Anchor Post (Near Right Wall U-Slot)
            translate([box_length - wall_th - 16, cable_y_pos - 7, floor_th - 0.5])
                cube([6, 14, 16.5]);

            // 8. OPTIONAL BUILT-IN 3D PRINT SUPPORTS (If vendor explicitly asks for support-modelled file)
            if (with_built_in_supports) {
                // 0.4mm thin breakaway sacrificial ribs across the USB cutout
                for (offset = [-4, 0, 4]) {
                    translate([wall_th/2, usb_y_pos + offset - 0.2, usb_z_offset])
                        cube([0.4, 0.4, usb_h]);
                }
            }
        }

        // Penetrations & Cutouts:

        // A. 45-degree Self-Supporting USB Port Aperture (100% Support-Free)
        self_supporting_usb_cutout();

        // B. 3-Sensor Cable Egress Slot (Right wall U-channel down from rim, 100% support-free)
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
        // Positioned centrally above the breadboard/ESP32 wire corridor
        // ==========================================
        led_center_x = 75.0;
        led_center_y = 65.0; // Positioned right above the wire pass channel for shortest wire reach!

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
        buzzer_x = 115.0;
        buzzer_y = 65.0; // Right beside LEDs above the central wire corridor

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
        translate([box_length/2, box_width - 15, lid_th - 0.6])
            linear_extrude(height=1)
            text("JALRAKSHAK SCADA NODE", size=5.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([box_length/2, 14, lid_th - 0.6])
            linear_extrude(height=1)
            text("EDGE WATER QUALITY MONITORING  BIS IS 10500:2012", size=3.4, font="Liberation Sans:style=Bold", halign="center", valign="center");
    }
}
