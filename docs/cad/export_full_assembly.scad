include <jalrakshak_enclosure.scad>
enclosure_base();
translate([0, box_width + 15, 0])
    enclosure_lid();
