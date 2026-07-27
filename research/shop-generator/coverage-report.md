# Shop Generator Coverage Report

> Initial report prepared from `coverage-manifest.csv` and the current research datasets. Future reports can be regenerated with `python scripts/audit-shop-data.py`.

## Summary

- Fixed-price catalogue rows: **85**
- Spell catalogue rows: **1,152** across **6** files
- Coverage manifest rows: **52**
- Entries requiring an inclusion decision: **15**
- Special-stock records not yet implemented: **9**
- Generator systems not yet implemented: **1**
- Deliberate exclusions: **5**

The existing fixed-price catalogue substantially covers the selected potions, alchemical goods, poisons, forbidden goods, engineering devices and incantation rank templates. It does **not yet constitute complete coverage** of every potentially relevant source entry.

## Manifest status

| Status | Count |
|---|---:|
| covered | 21 |
| covered-provisional | 1 |
| missing-review | 15 |
| missing-special | 9 |
| missing-generator | 1 |
| excluded-mundane | 4 |
| excluded-section | 1 |

## Items requiring an inclusion decision

These are source entries that could plausibly belong in one or more specialist shops but were omitted from the initial catalogue:

### Core rulebook tools

- Block and tackle — p. 106
- Book, printed or tome — p. 106
- Holly and mistletoe — p. 106
- Holy symbol — p. 106
- Hourglass — p. 106
- Musical instrument — p. 106
- Tool kit — p. 106
- Torturer's tools — p. 106

### Demon Lord's Companion named incantations

- Corpse Sight — p. 42
- Ley Line — p. 42
- Animal Spy — p. 42
- Destructive Rune — p. 42
- Prophecy — p. 42
- Recall Soul — p. 42
- Entrapping Pentagram — p. 42

## Special stock not yet implemented

These should not be generated as normal purchasable stock. They need a separate special-dealer, auction, adventure-reward or explicit GM-override mechanism.

### Core relics

- Book of Whispers — p. 211
- Circlet of Eyes — p. 211
- Floating Skull of Ugrash — pp. 211–212
- Sword of Unmaking — p. 212

### Demon Lord's Companion relics

- Blood Moon Medallion — p. 44
- Flying Carpet — p. 44
- Gnarled Staff of the Black Wood — p. 44
- Underworld Caul — p. 45
- Widdershins — p. 45

## Generator system not yet implemented

### Random enchanted objects

The core rules do not provide a retail list of standard enchanted objects. They provide:

- 20 possible object forms
- Five d20 property tables
- 100 possible properties in total
- Guidance that enchanted objects are unusual discoveries rather than ordinary retail goods

The shop tool therefore needs a **random enchanted-object generator**, gated behind special dealers or GM permission, rather than one catalogue row per object.

## Deliberate exclusions

The following individual core tools were classified as ordinary mundane equipment rather than specialist or magical shop stock:

- Crowbar
- Garrote
- Knuckledusters
- Net

The broader armour, weapon, clothing, personal-gear and mundane-equipment sections are presently outside scope. This exclusion is explicit so that they are not accidentally described as audited and included.

## Source coverage

| Source | Current position |
|---|---|
| Core rulebook | Potions and selected specialist tools covered; several specialist tools require review; enchanted-object generator and relic handling remain outstanding. |
| Demon Lord's Companion | Alchemical goods, forbidden items, engineering marvels and potions covered; named incantations require review; relics require special-stock handling. |
| Demon Lord's Companion 2 | Its four traditions are represented through the incantation spell pool; it has no separate equipment chapter. |
| Occult Philosophy | Spell pool is present but remains provisional pending duplicate, malformed-heading and source-page validation. |
| Do We Not Die? | Ordinary poisons, poison-delivery gear and alchemical poisons are represented in the fixed-price catalogue. |

## Audit command

Run from the repository root:

```bash
python scripts/audit-shop-data.py
```

The script checks:

- Duplicate item IDs and names
- Missing required item fields
- Broken references from the manifest to `items.csv`
- Missing spell name, rank or tradition
- Non-numeric spell ranks
- Duplicate spell keys
- Counts by source and manifest status

It rewrites this report and returns a non-zero exit code for structural errors. Review items, special-stock omissions and deliberate exclusions remain visible but do not fail the audit.

## Next data pass

1. Decide which eight omitted core specialist tools enter the shop catalogue.
2. Confirm how the seven named DLC incantations interact with normal rank-based incantation pricing.
3. Add the enchanted-object generator tables.
4. Add relics as non-random special records, disabled by default.
5. Run the automated spell validation and manually inspect anything it flags.
