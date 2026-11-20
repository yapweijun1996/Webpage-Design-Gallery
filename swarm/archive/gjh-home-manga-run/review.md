# GJH Home manga review — Work #304–#313

## Verdict

The assembled ten-section design meets the manga brief for owner visual review. No section revisions are assigned. Release sign-off remains open for the export shell and deployment checks below.

## What works

- 01–03 establish the manga treatment immediately: ink-framed navigation, a 001/002 cover with an ivory speech bubble and four storyboard links, then a separate 003 product panel with the full product name and two actions.
- 04–06 vary the page rhythm with MILI's straight frame, GOGO's slant and speed lines, Borsch Med's rounded speech bubble, Sony's offset panels and the Hormel-led directory rail. Captions remain readable and the directory link stays outside the rail.
- 07–10 carry the same visual language into the original-color history composite, the diagonally framed atrium, the two enquiry panels and the footer. The heritage and mall transitions leave room between frames. The official destinations, independent concept label and both footer disclosures remain present.

## Page-level changes, ranked for release

1. Give the shared export shell's Page preferences clearance above the fixed actions. At 393 × 844 the bottom 4px of Language sits behind the bar. At 767 × 844 all three preferences sit underneath it at the scroll limit. Reserve the 60px mobile bar, safe-area inset and a focus gutter in the export shell, then retest at 393px, 767px and 768px.
2. Remove the export shell's mobile zoom lock and verify text enlargement on a real iPhone. The PWA output declares both maximum-scale=1 and user-scalable=no. Keep viewport-fit=cover and recheck the fixed actions with the device safe area.
3. Regenerate the checked-in export after the shell changes. It differs from the reviewed fragments. Verify that the packaged home and sibling v11 routes are served together so the existing ../v11/ link reaches the mall demo.

## Verification and limits

- Read all ten HTML/CSS pairs in page order and inspected the workers' 393 × 844 visual evidence. A fresh temporary PWA export included ten sections and 16 images, with zero missing or unresolved assets.
- Chrome DevTools checked 320, 393, 767, 768 and 1440px. One h1, no broken fragment anchors or images, no horizontal page overflow, and 8px between the cover strip and fixed bar at all five widths. At 393px the primary cover action landed at New Moon, the rail reached its last item, and the page could scroll past both footer disclosures. The mobile disclosure opened and closed, and selecting MILI left one enquiry radio selected.
- Worker reports cover contrast and selected native keyboard paths. Manager-level native keypresses were denied by the tool, and iPhone safe areas and deployed PWA behavior remain unverified. The local file preview reported the expected manifest CORS error for file URLs.
- The gallery build check passed. Fourteen of fifteen unit tests passed. The remaining unit test and all three repository browser suites stopped during setup when the build attempted to write the v11 Rapier vendor files outside the writable workspace.
