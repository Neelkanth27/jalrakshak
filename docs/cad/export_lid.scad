include <jalrakshak_enclosure.scad>

// Pre-oriented for FDM 3D printing:
// Top face is rotated flat onto the print bed (Z=0).
// The inner alignment lip and screw countersinks point UPWARDS into the air.
// This guarantees 100% support-free printing for the lid!
translate([box_length, 0, lid_th])
    rotate([0, 180, 0])
        enclosure_lid();
