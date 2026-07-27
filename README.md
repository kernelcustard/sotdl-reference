# Shadow of the Demon Lord Reference

A small, mobile-friendly rules reference and seeded special-shop generator for personal tabletop use.

## Features

- Searchable rules summaries with source pages
- Random special-shop stock by settlement and shop type
- Potions, incantations, alchemical items, poisons, forbidden goods and engineering marvels
- Deterministic seeds: the same seed, settlement and shop reproduce the same inventory
- Copyable seed, share link and stock list
- Item lookup against the generated inventory

Relics, ordinary equipment and specialist tools are deliberately excluded from shop generation.

## Local use

The rules reference can be opened directly, but the shop generator loads CSV and JSON files and therefore needs a local web server. From the repository root, run:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000/`

No build step or package installation is required.

## Adding rules

Edit `data/rules.js` or `data/core-combat-rules.js`. Each rule is a plain JavaScript object with an id, title, category, summary, details, source and tags.

## Shop data

Shop research and generator data live under `research/shop-generator/`.

Run the coverage audit with:

```bash
python scripts/audit-shop-data.py
```

## GitHub Pages

The repository includes a GitHub Actions workflow that publishes the site whenever `main` changes.

The expected address is:

`https://kernelcustard.github.io/sotdl-reference/`

Substantial copyrighted rulebook text should not be published without permission. Prefer original summaries, structured metadata and page references.