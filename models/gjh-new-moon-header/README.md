# New Moon crescent header

Original fixture geometry and finishes created for this virtual shop. The asset may be reused within the owner’s projects. Public redistribution terms have not been specified. The wall art uses a stylized crescent and contains no package photography or third-party typography.

The source and exports use metres, with +Y up and +Z toward the aisle after export. Each tier has the same envelope and three batched surface colors and one luminous finish. The narrow luminous face simulates cabinet lighting without adding a dynamic light. Lower tiers simplify the scallop and crescent curves.

To regenerate the GLBs and editable checkpoint with Blender 5.1:

```sh
blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
  --python models/gjh-new-moon-header/generate.py -- --output /tmp/gjh-new-moon-header
```

Copy the three GLBs to the V11 `assets/interiors` directory, then run the interior packager and gallery generator. Pass `--preview` after the output argument for a rendered reference of the fixture.
