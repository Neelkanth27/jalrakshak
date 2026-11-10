include <jalrakshak_enclosure.scad>

// Both parts laid out flat side-by-side on the build plate (Z=0)
enclosure_base();

translate([0, box_width + 15, lid_th])
    translate([box_length, 0, 0])
        rotate([0, 180, 0])
            enclosure_lid();
