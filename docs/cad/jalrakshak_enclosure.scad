/**
 * ==============================================================================
 * Project: JalRakshak — Industrial Edge Water Quality Monitoring System
 * File: docs/cad/jalrakshak_enclosure.scad
 * Description: Parametric 3D Printable Enclosure with external LED bezels,
 *              buzzer acoustic grille, removable USB port, and sensor cable egress.
 * Software: OpenSCAD (https://openscad.org), FreeCAD, or Bambu Studio
 * ==============================================================================
 */

// ==========================================
// RENDER CONFIGURATION (Change "both" to "base" or "lid" for slicing)
// ==========================================
PART_TO_PRINT = "both"; // ["both", "base", "lid"]

// ==========================================
// PARAMETRIC DIMENSIONS (All units in millimeters)
// ==========================================
box_length      = 135.0; // Outer length (X) — Generous room for ESP32 + 2 Driver Boards
box_width       = 95.0;  // Outer width (Y)
box_height      = 42.0;  // Base height (Z) — 42mm provides ample vertical arch for jumper wires
wall_th         = 2.4;   // Wall thickness (6 perimeters on 0.4mm nozzle)
floor_th        = 2.4;   // Floor thickness
lid_th          = 2.4;   // Lid top face thickness
corner_r        = 4.0;   // Outer corner fillet radius

// Tolerances
lid_clearance   = 0.35;  // Snap-fit clearance for FDM printers

// Ports & Openings
usb_w           = 13.0;  // Micro-USB / USB-C port width
usb_h           = 8.5;   // Micro-USB / USB-C port height
usb_z_offset    = 7.5;   // Height from bottom floor to USB centerline
usb_y_pos       = 47.5;  // Y position of USB port along side wall

cable_slot_w    = 20.0;  // Egress slot for 3 sensor probe cables
cable_slot_h    = 14.0;  // Height of egress slot
cable_y_pos     = 47.5;  // Centered on opposite wall

led_dia         = 5.3;   // 5mm LED through-hole (with 0.3mm print tolerance)
led_spacing     = 14.0;  // Distance between LED centers

buzzer_dia      = 12.0;  // Standard 5V active buzzer diameter
acoustic_hole_d = 2.4;   // Sound aperture hole size

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
    esp_w = 48.0;
    esp_l = 68.0;
    esp_x = 18.0;
    esp_y = 15.0;

    difference() {
        union() {
            // Solid outer body
            rounded_box(box_length, box_width, box_height, corner_r);

            // Corner Standoff Bosses for Lid Screws (Reinforced columns)
            for (pos = [
                [wall_th + 4, wall_th + 4],
                [box_length - wall_th - 4, wall_th + 4],
                [wall_th + 4, box_width - wall_th - 4],
                [box_length - wall_th - 4, box_width - wall_th - 4]
            ]) {
                translate([pos[0], pos[1], floor_th])
                    cylinder(d=8.0, h=box_height - floor_th);
            }

            // Cable Strain-Relief Anchor Post (Near right egress wall for zip-tie)
            translate([box_length - wall_th - 14, cable_y_pos - 6, floor_th])
                cube([5, 12, 14]);

            // Internal PCB Mounting Standoffs for ESP32 Expansion Shield (Left Bay)
            for (sp = [
                [esp_x, esp_y],
                [esp_x + esp_l, esp_y],
                [esp_x, esp_y + esp_w],
                [esp_x + esp_l, esp_y + esp_w]
            ]) {
                translate([sp[0], sp[1], floor_th])
                    cylinder(d=6.5, h=5.0);
            }

            // Divider rib separating MCU from sensor driver boards (Right Bay)
            driver_bay_x = esp_x + esp_l + 8.0;
            translate([driver_bay_x, 15.0, floor_th])
                cube([2.0, 65.0, 3.0]);
        }

        // Hollow interior pocket
        translate([wall_th, wall_th, floor_th])
            rounded_box(box_length - 2*wall_th, box_width - 2*wall_th, box_height, max(0.5, corner_r - wall_th));

        // Removable Micro-USB / USB-C Power Port (Left wall)
        translate([-1, usb_y_pos - usb_w/2, usb_z_offset])
            cube([wall_th + 2, usb_w, usb_h]);

        // 3-Sensor Cable Egress Slot (Right wall, U-channel down from top rim)
        translate([box_length - wall_th - 1, cable_y_pos - cable_slot_w/2, box_height - cable_slot_h])
            cube([wall_th + 2, cable_slot_w, cable_slot_h + 1]);

        // Cable Strain-Relief Zip-Tie Slot
        translate([box_length - wall_th - 15, cable_y_pos - 3, floor_th + 4])
            cube([7, 6, 4]);

        // Corner M3 screw mounting pilot holes (4 corners)
        for (pos = [
            [wall_th + 4, wall_th + 4],
            [box_length - wall_th - 4, wall_th + 4],
            [wall_th + 4, box_width - wall_th - 4],
            [box_length - wall_th - 4, box_width - wall_th - 4]
        ]) {
            translate([pos[0], pos[1], floor_th + 2])
                cylinder(d=2.8, h=box_height); // M3 tap hole
        }

        // ESP32 PCB Standoff Mounting Pilot Holes
        for (sp = [
            [esp_x, esp_y],
            [esp_x + esp_l, esp_y],
            [esp_x, esp_y + esp_w],
            [esp_x + esp_l, esp_y + esp_w]
        ]) {
            translate([sp[0], sp[1], floor_th])
                cylinder(d=2.4, h=6.0); // Self-tapping M2.5 screw hole
        }
    }
}

// ==========================================
// 2. TOP ENCLOSURE LID (UPPER COVER WITH BEZELS)
// ==========================================
module enclosure_lid() {
    lip_h = 3.5;
    lid_total_h = lid_th + lip_h;

    difference() {
        union() {
            // Main Top Face
            rounded_box(box_length, box_width, lid_th, corner_r);

            // Alignment Lip (Snap-in inner flange)
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
        // Positioned neatly in a row on the top surface
        // ==========================================
        led_center_x = 45.0;
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
        buzzer_x = 85.0;
        buzzer_y = box_width / 2;

        // Center acoustic hole
        translate([buzzer_x, buzzer_y, -lip_h - 1])
            cylinder(d=acoustic_hole_d + 0.6, h=lid_total_h + 2);

        // 6 Surrounding acoustic vent holes
        for (a = [0:60:300]) {
            translate([buzzer_x + 3.8 * cos(a), buzzer_y + 3.8 * sin(a), -lip_h - 1])
                cylinder(d=acoustic_hole_d, h=lid_total_h + 2);
        }

        // ==========================================
        // 4× M3 CORNER SCREW COUNTERSINK HOLES
        // ==========================================
        for (pos = [
            [wall_th + 4, wall_th + 4],
            [box_length - wall_th - 4, wall_th + 4],
            [wall_th + 4, box_width - wall_th - 4],
            [box_length - wall_th - 4, box_width - wall_th - 4]
        ]) {
            // Screw shank clearance
            translate([pos[0], pos[1], -lip_h - 1])
                cylinder(d=3.4, h=lid_total_h + 2);
            // M3 Countersink head pocket
            translate([pos[0], pos[1], lid_th - 1.2])
                cylinder(d1=3.4, d2=6.2, h=1.4);
        }

        // ==========================================
        // EMBOSSED TECHNICAL LABELS (0.6mm debossed into lid)
        // ==========================================
        // LED Indicator Labels
        translate([led_center_x - led_spacing, led_center_y + 8, lid_th - 0.6])
            linear_extrude(height=1)
            text("NORM", size=3.2, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([led_center_x, led_center_y + 8, lid_th - 0.6])
            linear_extrude(height=1)
            text("WARN", size=3.2, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([led_center_x + led_spacing, led_center_y + 8, lid_th - 0.6])
            linear_extrude(height=1)
            text("ALRM", size=3.2, font="Liberation Sans:style=Bold", halign="center", valign="center");

        // Buzzer Sound Label
        translate([buzzer_x, buzzer_y + 8, lid_th - 0.6])
            linear_extrude(height=1)
            text("SIREN", size=3.2, font="Liberation Sans:style=Bold", halign="center", valign="center");

        // Main Station Branding
        translate([box_length/2, box_width - 12, lid_th - 0.6])
            linear_extrude(height=1)
            text("JALRAKSHAK SCADA NODE", size=4.5, font="Liberation Sans:style=Bold", halign="center", valign="center");

        translate([box_length/2, 12, lid_th - 0.6])
            linear_extrude(height=1)
            text("BIS IS 10500:2012 COMPLIANT", size=3.0, font="Liberation Sans:style=Bold", halign="center", valign="center");
    }
}

// ==========================================
// RENDER DISPATCH
// ==========================================
if (PART_TO_PRINT == "base") {
    enclosure_base();
} else if (PART_TO_PRINT == "lid") {
    enclosure_lid();
} else {
    // Both parts shown side by side for CAD assembly inspection
    enclosure_base();
    translate([0, box_width + 15, 0])
        enclosure_lid();
}
