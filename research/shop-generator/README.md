# SotDL shop-generator research dataset

Structured research for the shop generator. This is source metadata and implementation input, not reproduced rulebook text.

## Contents

- `sources.json`: source identifiers and scope.
- `items.json`: 85 fixed-price special items, potions, poisons, gear, and incantation rank templates.
- `spells.json`: 1152 spell records for dynamic incantation generation.
- `location-profiles.json`: settlement thresholds, stock weights, shop category filters, and design rules.

## Important constraints

1. Core availability is population-based: Common anywhere; Uncommon at 1,000+; Rare at 5,000+; Exotic at 10,000+.
2. Enchanted objects are explicitly not ordinary retail items. The generator must keep them behind a GM override or special venue.
3. Rank 7–10 incantations require GM permission rather than ordinary availability.
4. Poisons are generally illegal in civilised areas, so normal apothecaries should exclude them unless configured as illicit.
5. Prices are stored as printed strings and normalised to copper pennies in `price_cp` for sorting and arithmetic.
6. The spell extraction is machine-assisted from the named PDFs. It should be validated before treating the catalogue as publication-complete, especially multi-column Invocation headings in *Demon Lord’s Companion 2*.

## Generator contract

- Pick settlement and shop profile.
- Determine slot count.
- Roll an availability tier no higher than the settlement maximum.
- Filter `items.json` by category, tier, legality, and shop.
- For an incantation result, choose a spell of the same rank from `spells.json`, respecting any tradition filter.
- Deduplicate by item ID unless quantity rules explicitly allow duplicates.
- Preserve generated stock by seed.
