# Yeo Hiap Seng landing ideas and implementation

**Art direction.** Use the ingredient, the container or the visitor’s tasting choice as the organising element. Tea House pairs the leaf and blossom photographs, Pack Finder leads with the reach of a selected format, and the Notebook uses the chosen drink as its cover image. A visitor can carry the same two soy drinks from the editorial spread into the comparison, or take the second pour of a flight directly into a personal notebook.

## Fifteen editions

| Page | Visitor question | Implemented treatment | Try it |
| --- | --- | --- | --- |
| [V1 · The Drinks Index](../demos/food-beverage/yeos/v1/index.html) | Which of two drinks comes in the container I need? | The red serving photograph leads the desktop spread. The adjacent masthead has separate routes to the drinks and the comparison. The comparison produces a permanent link containing both drink IDs. | Choose Black Soy Milk and Bandung. Open the permalink to restore this pair and compare the can row. |
| [V2 · Tea House](../demos/food-beverage/yeos/v2/index.html) | Am I interested in the leaf or the blossom? | Two staggered, arch-shaped photographic portraits introduce the teas. Each caption leads to its own botanical profile. | Choose Hang Bai Ju blossom to land on Chrysanthemum Tea. |
| [V3 · The Soy Study](../demos/food-beverage/yeos/v3/index.html) | How do the two soy drinks differ? | Cream and dark specimen labels open in place to show all four and two pack formats above the portraits. The spread links to this exact pair in V1. | Open “Compare the soy packs” to see both product names already selected. |
| [V4 · Kopitiam Board](../demos/food-beverage/yeos/v4/index.html) | What does the drink I selected look like? | Opening a menu item on the framed chalkboard updates the enlarged photo print and its caption. A chalk-coloured edge marks the active row. | Open Lychee Drink with Enter and inspect the matching print. |
| [V5 · Pack Finder](../demos/food-beverage/yeos/v5/index.html) | How widely available is a particular pack across these six drinks? | A large numerator and a proportional bar read directly from the published availability matrix. | Select the 1 L carton. The readout shows two of six. |
| [V6 · Botanical Notes](../demos/food-beverage/yeos/v6/index.html) | Which drink uses the ingredient pictured here? | Three photographic specimens form a visual key for flower, leaf and bean blend. Each opens its matching disclosure and has a bookmarkable fragment. | Choose Bean blend and reload the resulting link to reopen its notes. |
| [V7 · Lychee Season](../demos/food-beverage/yeos/v7/index.html) | How much larger is the sharing bottle? | A four-bar capacity plate joins the red fruit poster. Every bar uses the same 1,500 mL scale and each pack retains its written volume and container. | Compare the 250 mL carton and the 1.5 L bottle on the poster. |
| [V8 · Rose Milk Studio](../demos/food-beverage/yeos/v8/index.html) | Which features make up Bandung? | Three photographic contact prints reframe the serving photograph around the rose petals, the glass or the complete composition. The print caption and accompanying ingredient note follow the selection. | Choose Rose essence, Milk and Together in turn. |
| [V9 · The Nanyang Archive](../demos/food-beverage/yeos/v9/index.html) | How does the family business’s history connect to a drink I know? | A newspaper-style lead introduces Zhangzhou and Nanyang. A separate present-day soy drink photograph links the chronology to the product guide. | Follow “In the range today” to the Soy Bean Milk entry. |
| [V10 · Picnic Counter](../demos/food-beverage/yeos/v10/index.html) | How many whole packs should I bring? | A large packing slip on the picnic sheet shows the whole-pack quantity, container and unit volume. The receipt retains the calculation and spare volume. | Calculate seven 250 mL servings from 300 mL cans. The slip reads six cans, with 50 mL spare. |
| [V11 · Cooler Shelf](../demos/food-beverage/yeos/v11/index.html) | Which sizes remain when I narrow the shelf to cans? | Shelf tickets carry individual capacities. The container control filters tickets and products together, with a visible result count. | Select Cans to reveal five matching drinks with one 300 mL ticket each. |
| [V12 · Tasting Notebook](../demos/food-beverage/yeos/v12/index.html) | Which drink am I writing about? | A photographic stamp and printed drink name identify the current entry. A flight can open a matching notebook directly. Saved entries and unsaved drafts remain attached to their own drinks. | Select Lychee Drink and observe the new stamp. |
| [V13 · The Drink Dial](../demos/food-beverage/yeos/v13/index.html) | Which drink is behind this flavour direction? | Focusing a direction updates the centre photograph, selected marker and drink name before the visitor opens a profile. | Tab to Rose milk to preview Bandung, then press Enter to reach its profile. |
| [V14 · Tasting Flight](../demos/food-beverage/yeos/v14/index.html) | How do I record a particular pour? | Connected tasting cards read as one flight, with perforated boundaries between pours. A journal link on each card opens the matching drink entry. | In the Bean flight, choose the second pour’s tasting note. The notebook opens on Black Soy Milk. |
| [V15 · Beverage Atlas](../demos/food-beverage/yeos/v15/index.html) | Can I find the drink when I know an ingredient but have forgotten its name? | A masthead lookup searches existing names, descriptions and pack text. The letter rail follows visible results and the Clear button restores the full atlas. | Search for “rose essence”, then clear the search to restore all six drinks. |

## Content and evidence

The six products are a curated sample of the Singapore range. The original serving illustrations depict suggested presentations. Pack counts in the interface refer to product listings and carry no shop inventory or pricing claim. The archive’s historical account comes from Yeo’s. [Yeo’s product families](https://yeos.com.sg/brands/) · [Yeo’s history](https://yeos.com.sg/about-us/history-heritage/)

Volumes and container forms can be checked against the Singapore product pages. [Chrysanthemum Tea](https://yeos.com.sg/product/chrysanthemum-tea/) · [First Harvest Green Tea](https://yeos.com.sg/product/jasmine-green-tea/) · [Soy Bean Milk](https://yeos.com.sg/product/soy-bean-milk/) · [Black Soy Milk](https://yeos.com.sg/product/black-soy-milk-2/) · [Lychee Drink](https://yeos.com.sg/product/lychee-drink/) · [Bandung Rose Milk Drink](https://yeos.com.sg/product/bandung-rose-syrup-milk-drink/)

The two gallery runners exercise the editions at 320, 390, 768 and 1440 CSS pixels, including JavaScript-disabled browsing. Their capture mode produced 45 browser screenshots and 15 desktop-derived thumbnails. The company journey check exercised each interaction above in Chrome at 390 px, including inter-page selections, the empty atlas and fragment reloads. The optional axe run checked each initial main region against WCAG 2 A/AA and 2.1 A/AA rules.

```sh
python tests/browser_yeos_drinks.py --capture
python tests/browser_yeos_editions.py --capture
python demos/food-beverage/yeos/landing_checks.py
# Supply an installed axe-core browser distribution to include accessibility scanning.
python demos/food-beverage/yeos/landing_checks.py --axe-script /path/to/axe.min.js
```

## Twenty visual references

The [Yeo’s art directions](landing-atlas/yeos/directions.json) match fifteen primary studies to V1–V15 and describe five alternate compositions. Comparing the first-screen images with the working editions informed the desktop photograph order in V1, the above-photo pack disclosures in V3, the framed menu and larger print in V4, and the three ingredient crops in V8.

Six [browser-rendered studies](landing-atlas/yeos/verified-renders.json) read their catalogue, matrix, calculator or search state from the demo. The two soy specimens show their listed pack formats. The can inventory shows five of the six drinks. The picnic receipt calculates six 300 mL cans and 50 mL spare for seven 250 mL servings. The private notebook uses Black Soy Milk. The alphabetical atlas shows the sole result for “rose essence”. The measurement plate compares all five capacities on a common scale and pairs Black Soy Milk with the 380 mL bottle. Other photographic and illustrated reference scenes are original independent concepts. The Nanyang illustrations depict the context of the story and have no archival provenance.

Rebuild the six studies from the repository root with Python, Playwright, Pillow and Chrome installed. The optional `GALLERY_CHROME` environment variable selects a particular Chrome executable.

```sh
python docs/landing-atlas/yeos/render_verified.py
```
