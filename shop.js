(() => {
  const DATA_ROOT = "research/shop-generator";
  const SPELL_FILES = [
    "spells-core.csv",
    "spells-dlc.csv",
    "spells-occult-ranks-0-2.csv",
    "spells-occult-ranks-3-5.csv",
    "spells-occult-ranks-6-8.csv",
    "spells-occult-ranks-9-10.csv"
  ];

  const sourceNames = {
    core: "Core rulebook",
    dlc1: "Demon Lord's Companion",
    dlc2: "Demon Lord's Companion 2",
    occult: "Occult Philosophy",
    poisoned_pages: "Do We Not Die?"
  };

  const availabilityOrder = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Exotic: 3,
    "GM permission": 4
  };

  const settlementSelect = document.querySelector("#shop-settlement");
  const shopSelect = document.querySelector("#shop-type");
  const seedInput = document.querySelector("#shop-seed");
  const generateButton = document.querySelector("#generate-shop");
  const newSeedButton = document.querySelector("#new-seed");
  const copySeedButton = document.querySelector("#copy-seed");
  const copyLinkButton = document.querySelector("#copy-link");
  const copyListButton = document.querySelector("#copy-list");
  const status = document.querySelector("#shop-status");
  const results = document.querySelector("#shop-results");
  const stockList = document.querySelector("#stock-list");
  const shopTitle = document.querySelector("#shop-title");
  const shopKey = document.querySelector("#shop-key");
  const itemQuery = document.querySelector("#item-query");
  const itemCheckButton = document.querySelector("#check-item");
  const itemCheckResult = document.querySelector("#item-check-result");

  let profiles = null;
  let items = [];
  let spells = [];
  let currentStock = [];

  const titleCase = (value) => String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const normalise = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];

      if (character === '"' && quoted && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map((header) => header.trim());
    return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()])));
  }

  function xmur3(value) {
    let hash = 1779033703 ^ value.length;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return () => {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      return (hash ^= hash >>> 16) >>> 0;
    };
  }

  function mulberry32(seed) {
    return () => {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomInteger(rng, minimum, maximum) {
    return minimum + Math.floor(rng() * (maximum - minimum + 1));
  }

  function choose(rng, values) {
    return values[Math.floor(rng() * values.length)];
  }

  function weightedChoice(rng, weights) {
    const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
    const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
    let roll = rng() * total;
    for (const [name, weight] of entries) {
      roll -= Number(weight);
      if (roll <= 0) return name;
    }
    return entries.at(-1)?.[0];
  }

  function makeSeed() {
    const words = ["ash", "crow", "demon", "ember", "fang", "gloom", "iron", "moon", "rune", "shadow", "thorn", "void"];
    const randomValues = new Uint32Array(2);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(randomValues);
    } else {
      randomValues[0] = Date.now() >>> 0;
      randomValues[1] = Math.floor(Math.random() * 0xffffffff);
    }
    return `${words[randomValues[0] % words.length]}-${words[randomValues[1] % words.length]}-${(randomValues[0] ^ randomValues[1]).toString(36)}`;
  }

  function itemAvailableAtSettlement(item, settlement) {
    const itemRank = availabilityOrder[item.availability] ?? 99;
    const maximumRank = availabilityOrder[settlement.max_availability] ?? -1;
    return itemRank <= maximumRank;
  }

  function itemMatchesShop(item, shopName, shopProfile) {
    const listedShops = item.shop_types.split("|").filter(Boolean);
    return listedShops.includes(shopName) && shopProfile.categories.includes(item.category);
  }

  function makeIncantation(template, rng, usedKeys) {
    const rankMatch = template.id.match(/rank-(\d+)/);
    const rank = rankMatch ? rankMatch[1] : "";
    const candidates = spells.filter((spell) => spell.rank === rank);
    if (!candidates.length) return null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const spell = choose(rng, candidates);
      const key = `incantation:${spell.id}`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      return {
        ...template,
        key,
        name: `${spell.name} incantation`,
        baseName: spell.name,
        spell,
        source: spell.source,
        page: spell.page,
        categoryLabel: `Rank ${rank} incantation`,
        detail: `${spell.tradition} ${spell.type.toLowerCase()} spell`
      };
    }
    return null;
  }

  function quantityFor(item, rng) {
    if (["potion", "poison", "alchemical_poison", "alchemical_item"].includes(item.category)) {
      const roll = rng();
      if (roll < 0.65) return 1;
      if (roll < 0.9) return 2;
      return 3;
    }
    return 1;
  }

  function generateStock() {
    if (!profiles || !items.length) return;

    const seed = seedInput.value.trim() || makeSeed();
    seedInput.value = seed;
    const settlementName = settlementSelect.value;
    const shopName = shopSelect.value;
    const settlement = profiles.settlements[settlementName];
    const shop = profiles.shops[shopName];
    const seedKey = `${seed}|${settlementName}|${shopName}`;
    const rng = mulberry32(xmur3(seedKey)());
    const [minimumSlots, maximumSlots] = settlement.stock_slots.special;
    const slotCount = randomInteger(rng, minimumSlots, maximumSlots);
    const eligible = items.filter((item) => itemAvailableAtSettlement(item, settlement) && itemMatchesShop(item, shopName, shop));
    const usedKeys = new Set();
    const generated = [];

    for (let slot = 0; slot < slotCount && eligible.length; slot += 1) {
      const preferredRarity = weightedChoice(rng, settlement.rarity_weights);
      let pool = eligible.filter((item) => item.availability === preferredRarity && !usedKeys.has(item.id));
      if (!pool.length) pool = eligible.filter((item) => !usedKeys.has(item.id));
      if (!pool.length) break;

      const selected = choose(rng, pool);
      let stockItem;
      if (selected.category === "incantation") {
        stockItem = makeIncantation(selected, rng, usedKeys);
        if (!stockItem) continue;
      } else {
        usedKeys.add(selected.id);
        stockItem = {
          ...selected,
          key: selected.id,
          categoryLabel: titleCase(selected.category),
          detail: selected.notes || ""
        };
      }
      stockItem.quantity = quantityFor(stockItem, rng);
      generated.push(stockItem);
    }

    currentStock = generated;
    renderStock(seed, settlementName, shopName, settlement);
    updateShareUrl(seed, settlementName, shopName);
  }

  function renderStock(seed, settlementName, shopName, settlement) {
    stockList.replaceChildren();
    results.hidden = false;
    shopTitle.textContent = `${titleCase(shopName)} stock in a ${titleCase(settlementName)}`;
    shopKey.textContent = `Seed: ${seed} · ${settlement.population_hint} · maximum ${settlement.max_availability}`;

    if (!currentStock.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No special stock is available for this shop and settlement combination.";
      stockList.append(empty);
    } else {
      const cards = currentStock.map((item) => {
        const article = document.createElement("article");
        article.className = "stock-card";

        const heading = document.createElement("div");
        heading.className = "stock-card-heading";
        const title = document.createElement("h3");
        title.textContent = item.name;
        const price = document.createElement("strong");
        price.textContent = item.price;
        heading.append(title, price);

        const meta = document.createElement("p");
        meta.className = "stock-meta";
        meta.textContent = `${item.categoryLabel} · ${item.availability} · quantity ${item.quantity}`;

        const source = document.createElement("p");
        source.className = "stock-source";
        source.textContent = `${sourceNames[item.source] ?? item.source}, p. ${item.page}`;

        article.append(heading, meta);
        if (item.detail) {
          const detail = document.createElement("p");
          detail.className = "stock-detail";
          detail.textContent = item.detail;
          article.append(detail);
        }
        article.append(source);
        return article;
      });
      stockList.replaceChildren(...cards);
    }

    status.textContent = `${currentStock.length} ${currentStock.length === 1 ? "item" : "items"} generated. The same seed and settings will reproduce this list.`;
    itemCheckResult.textContent = "";
  }

  function updateShareUrl(seed, settlementName, shopName) {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    url.searchParams.set("settlement", settlementName);
    url.searchParams.set("shop", shopName);
    url.hash = "shop";
    window.history.replaceState({}, "", url);
  }

  function stockAsText() {
    const heading = `${shopTitle.textContent}\n${shopKey.textContent}`;
    const lines = currentStock.map((item) => `- ${item.name} x${item.quantity} — ${item.price} — ${item.availability} — ${sourceNames[item.source] ?? item.source}, p. ${item.page}`);
    return [heading, "", ...lines].join("\n");
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = successMessage;
    } catch {
      status.textContent = "Copying was blocked by the browser. Select the text manually instead.";
    }
  }

  function checkItem() {
    const query = normalise(itemQuery.value);
    if (!query) {
      itemCheckResult.textContent = "Enter an item or spell name.";
      return;
    }

    const match = currentStock.find((item) => {
      const names = [item.name, item.baseName, item.spell?.name].filter(Boolean).map(normalise);
      return names.some((name) => name === query || name.includes(query) || query.includes(name));
    });

    if (match) {
      itemCheckResult.className = "check-result available";
      itemCheckResult.textContent = `Yes. ${match.name} is available: quantity ${match.quantity}, ${match.price}, ${sourceNames[match.source] ?? match.source} p. ${match.page}.`;
    } else {
      itemCheckResult.className = "check-result unavailable";
      itemCheckResult.textContent = "No. That item is not in this seeded stock list.";
    }
  }

  function switchView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => {
      view.hidden = view.id !== viewId;
    });
    document.querySelectorAll(".view-tab").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === viewId));
    });
    window.location.hash = viewId === "shop-view" ? "shop" : "rules";
  }

  async function loadData() {
    try {
      const [profileResponse, itemResponse, ...spellResponses] = await Promise.all([
        fetch(`${DATA_ROOT}/location-profiles.json`, { cache: "no-store" }),
        fetch(`${DATA_ROOT}/items.csv`, { cache: "no-store" }),
        ...SPELL_FILES.map((file) => fetch(`${DATA_ROOT}/${file}`, { cache: "no-store" }))
      ]);

      const responses = [profileResponse, itemResponse, ...spellResponses];
      if (responses.some((response) => !response.ok)) throw new Error("One or more data files could not be loaded.");

      profiles = await profileResponse.json();
      items = parseCsv(await itemResponse.text());
      const spellTexts = await Promise.all(spellResponses.map((response) => response.text()));
      spells = spellTexts.flatMap(parseCsv).filter((spell) => spell.name && spell.rank && spell.tradition);

      settlementSelect.replaceChildren(...Object.entries(profiles.settlements).map(([value, profile]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${titleCase(value)} (${profile.population_hint})`;
        return option;
      }));

      shopSelect.replaceChildren(...Object.keys(profiles.shops).map((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = titleCase(value);
        return option;
      }));

      const parameters = new URLSearchParams(window.location.search);
      const requestedSettlement = parameters.get("settlement");
      const requestedShop = parameters.get("shop");
      if (requestedSettlement && profiles.settlements[requestedSettlement]) settlementSelect.value = requestedSettlement;
      else settlementSelect.value = "city";
      if (requestedShop && profiles.shops[requestedShop]) shopSelect.value = requestedShop;
      else shopSelect.value = "occult";
      seedInput.value = parameters.get("seed") || makeSeed();

      status.textContent = `${items.length} catalogue entries and ${spells.length} spells loaded.`;
      if (window.location.hash === "#shop" || parameters.has("seed")) {
        switchView("shop-view");
        generateStock();
      }
    } catch (error) {
      status.textContent = `Shop data could not be loaded: ${error.message}`;
      generateButton.disabled = true;
    }
  }

  document.querySelectorAll(".view-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  generateButton.addEventListener("click", generateStock);
  newSeedButton.addEventListener("click", () => {
    seedInput.value = makeSeed();
    generateStock();
  });
  copySeedButton.addEventListener("click", () => copyText(seedInput.value, "Seed copied."));
  copyLinkButton.addEventListener("click", () => {
    if (!currentStock.length) generateStock();
    copyText(window.location.href, "Share link copied.");
  });
  copyListButton.addEventListener("click", () => copyText(stockAsText(), "Stock list copied."));
  itemCheckButton.addEventListener("click", checkItem);
  itemQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkItem();
  });
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") generateStock();
  });

  loadData();
})();