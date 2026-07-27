# Shop Generator Coverage Report

> Generated from `coverage-manifest.csv` and the current research datasets.

## Summary

- Fixed-price and template catalogue rows: **80**
- Spell catalogue rows: **1,152** across **6** files
- Coverage manifest rows: **29**
- Entries requiring an inclusion decision: **0**
- Relics included as shop stock: **0**
- Generator systems not yet implemented: **1**

The catalogue is deliberately limited to special stock: potions, incantations, alchemical items, poisons, forbidden goods, poison-delivery gear and engineering marvels. Normal equipment and specialist tools are outside scope.

## Decisions applied

### Specialist tools

Normal and specialist tools from the core equipment chapter are excluded. This includes healer's kits, lock picks, implements, crystal balls, writing kits and similar ordinary purchases. They belong in a general equipment tool rather than this special-stock generator.

### Named incantations

The seven incantation-only spells from *Demon Lord's Companion* are included as fixed special incantation records using the standard price and availability for their ranks:

- Corpse Sight - rank 1
- Ley Line - rank 1
- Animal Spy - rank 2
- Destructive Rune - rank 2
- Prophecy - rank 2
- Recall Soul - rank 2
- Entrapping Pentagram - rank 3

### Relics

All nine named relics from the core book and *Demon Lord's Companion* are documented in the coverage manifest but excluded from shop generation. They are unique, priceless adventure content rather than merchandise.

## Generator implementation

The application now includes a seeded shop generator. Its inventory key consists of:

```text
seed + settlement type + shop type
```

Using the same three values produces the same inventory. The application can copy the seed, copy a share link containing all three values, copy the generated list and check whether a requested item or spell incantation appears in that stock.

The generator loads:

- `items.csv`
- `location-profiles.json`
- `spells-core.csv`
- `spells-dlc.csv`
- Four rank-split *Occult Philosophy* spell files

## Remaining generator work

### Random enchanted objects

The core rules provide forms and random property tables rather than an ordinary retail list. A separate enchanted-object generator remains outstanding. It should be restricted to auctions, curiosity dealers or explicit GM permission and should not assign a standard retail price.

## Deliberate exclusions

- Relics
- Armour and ordinary weapons
- Clothing and personal equipment
- General adventuring gear
- Specialist tools
- Vehicles other than the explicitly listed engineering marvels

## Audit command

Run from the repository root:

```bash
python scripts/audit-shop-data.py
```

The normal GitHub audit reports structural findings without failing the workflow. Strict local validation is available with:

```bash
AUDIT_STRICT=1 python scripts/audit-shop-data.py
```
