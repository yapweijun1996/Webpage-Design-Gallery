# Borsch Med open patch folio

This original display for S04 uses two inclined cream leaves with a visible book gutter and a rose-panelled plinth with an oxblood top. Its starting point was the approved S04 room concept. The 18-patch carton, pouch and backing sheet remain separate assets from the room detail GLB. The leaves and their inset use unprinted materials.

The GLBs use metres, with the installed origin at the plinth foot and +Z facing into the aisle. The forward ledge reaches 1.15 m with the installed 0.081 m floor offset. The same silhouette and support plane are used in all three tiers. Fine page subdivision varies by tier. One opaque vertex-coloured material covers the entire fixture.

Rebuild the three exports with Blender 5.1:

```sh
blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
  --python models/gjh-borsch-folio/generate.py -- --output /tmp/gjh-borsch-folio
```

Copy the three generated files into `demos/corporate/gjh/v11/assets/interiors/`. Run the [interior packager and layout generator](../../scripts/gjh_interiors/README.md) before the gallery generator. The fixture uses the existing S04 position, collision, and Story targets.

Original fixture geometry and finishes were created for the owner's virtual shop. Reuse within the owner's projects is permitted. Public redistribution terms have not been specified.
