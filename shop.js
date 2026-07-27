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

  const breadthMultipliers = {
    standard: 1,
    broad: 1.75,
    extensive: 3
  };

  const categoryLabels = {
    potion: "Potions",
    incantation: "Incantations",
    special_incantation: "Incantations",
    alchemical_item: "Alchemical items",
    poison: "Poisons",
    alchemical_poison: "Poisons",
    poison_gear: "Poison gear",
    forbidden_item: "Forbidden goods",
    engineering_marvel: "Engineering marvels"
  };

  const settlementSelect = document.querySelector("#shop-settlement");
  const breadthSelect = document.querySelector("#stock-breadth");
  const shopOptions = document.querySelector("#shop-options");
  const selectAllShopsButton = document.querySelector("#select-all-shops");
  const clearShopsButton = document.querySelector("#clear-shops");
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
  const filterSelect = document.querySelector("#stock-filter");
  const sortSelect = document.querySelector("#stock-sort");
  const groupSelect = document.querySelector("#stock-group");
  const visibleStockCount = document.querySelector("#visible-stock-count");

  let profiles = null;
  let items = [];
  let spells = [];
  let currentStock = [];
  let currentSeed = "";
  let currentSettlementName = "";
  let currentShopNames = [];

  const titleCase = (value) => String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const normalise = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();

  const categoryFor = (item) => categoryLabels[item.category] ?? titleCase(item.category);

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

  function selectedShops() {
    return Array.from(shopOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value).sort();
  }

  function setSelectedShops(names) {
    const selected = new Set(names);
    shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function itemAvailableAtSettlement(item, settlement) {
    const itemRank = availabilityOrder[item.availability] ?? 99;
    const maximumRank = availabilityOrder[settlement.max_availability] ?? -1;
    return itemRank <= maximumRank;
  }

  function itemMatchesShop(item, shopName) {
    return item.shop_types.split("|").filter(Boolean).includes(shopName);
  }

  function makeIncantation(template, rng, usedKeys) {
    const rankMatch = template.id.match(/rank-(\d+)/);
    const rank = rankMatch ? rankMatch[1] : "";
    const candidates = spells.filter((spell) => spell.rank === rank);
    if (!candidates.length) return null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
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
        categoryLabel: "Incantations",
        detail: `${spell.tradition} ${spell.type.toLowerCase()} spell`
      };
    }
    return null;
  }

  function quantityFor(item, rng) {
    if (["potion", "poison", "alchemical_poison", "alchemical_item"].includes(item.category)) {
      const roll = rng();
      if (roll < 0.6) return 1;
      if (roll < 0.88) return 2;
      return 3;
    }
    return 1;
  }

  function generateShopStock(seed, settlementName, shopName, breadthName) {
    const settlement = profiles.settlements[settlementName];
    const seedKey = `${seed}|${settlementName}|${shopName}|${breadthName}`;
    const rng = mulberry32(xmur3(seedKey)());
    const [minimumSlots, maximumSlots] = settlement.stock_slots.special;
    const multiplier = breadthMultipliers[breadthName] ?? 1;
    const slotCount = Math.max(1, Math.round(randomInteger(rng, minimumSlots, maximumSlots) * multiplier));
    const eligible = items.filter((item) => itemAvailableAtSettlement(item, settlement) && itemMatchesShop(item, shopName));
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
          categoryLabel: categoryFor(selected),
          detail: selected.notes || ""
        };
      }

      stockItem.quantity = quantityFor(stockItem, rng);
      stockItem.location = titleCase(shopName);
      stockItem.shopName = shopName;
      generated.push(stockItem);
    }

    return generated;
  }

  function generateStock() {
    if (!profiles || !items.length) return;

    const seed = seedInput.value.trim() || makeSeed();
    seedInput.value = seed;
    const settlementName = settlementSelect.value;
    const breadthName = breadthSelect.value;
    const shopNames = selectedShops();

    if (!shopNames.length) {
      status.textContent = "Select at least one business before generating stock.";
      return;
    }

    currentSeed = seed;
    currentSettlementName = settlementName;
    currentShopNames = shopNames;
    currentStock = shopNames.flatMap((shopName) => generateShopStock(seed, settlementName, shopName, breadthName));

    populateCategoryFilter();
    renderStockHeader();
    renderVisibleStock();
    updateShareUrl();
  }

  function populateCategoryFilter() {
    const previous = filterSelect.value || "all";
    const categories = Array.from(new Set(currentStock.map(categoryFor))).sort((a, b) => a.localeCompare(b));
    const options = [
      ["all", "All item types"],
      ...categories.map((category) => [category, category])
    ].map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    });
    filterSelect.replaceChildren(...options);
    filterSelect.value = categories.includes(previous) ? previous : "all";
  }

  function renderStockHeader() {
    const settlement = profiles.settlements[currentSettlementName];
    results.hidden = false;
    shopTitle.textContent = `Stock available in this ${titleCase(currentSettlementName)}`;
    shopKey.textContent = `Seed: ${currentSeed} · ${currentShopNames.map(titleCase).join(", ")} · ${settlement.population_hint} · maximum ${settlement.max_availability}`;
    status.textContent = `${currentStock.length} stock entries generated across ${currentShopNames.length} ${currentShopNames.length === 1 ? "business" : "businesses"}. The same seed and settings reproduce this settlement.`;
    itemCheckResult.textContent = "";
  }

  function compareItems(a, b, mode) {
    if (mode === "location") {
      return a.location.localeCompare(b.location) || categoryFor(a).localeCompare(categoryFor(b)) || a.name.localeCompare(b.name);
    }
    if (mode === "type") {
      return categoryFor(a).localeCompare(categoryFor(b)) || a.name.localeCompare(b.name) || a.location.localeCompare(b.location);
    }
    return a.name.localeCompare(b.name) || a.location.localeCompare(b.location);
  }

  function visibleItems() {
    const filter = filterSelect.value;
    return currentStock
      .filter((item) => filter === "all" || categoryFor(item) === filter)
      .sort((a, b) => compareItems(a, b, sortSelect.value));
  }

  function makeStockCard(item) {
    const article = document.createElement("article");
    article.className = "stock-card";

    const heading = document.createElement("div");
    heading.className = "stock-card-heading";
    const title = document.createElement("h4");
    title.textContent = item.name;
    const price = document.createElement("strong");
    price.textContent = item.price;
    heading.append(title, price);

    const location = document.createElement("p");
    location.className = "stock-location";
    location.textContent = `Location: ${item.location}`;

    const meta = document.createElement("p");
    meta.className = "stock-meta";
    meta.textContent = `${categoryFor(item)} · ${item.availability} · quantity ${item.quantity}`;

    const source = document.createElement("p");
    source.className = "stock-source";
    source.textContent = `${sourceNames[item.source] ?? item.source}, p. ${item.page}`;

    article.append(heading, location, meta);
    if (item.detail) {
      const detail = document.createElement("p");
      detail.className = "stock-detail";
      detail.textContent = item.detail;
      article.append(detail);
    }
    article.append(source);
    return article;
  }

  function renderVisibleStock() {
    stockList.replaceChildren();
    const visible = visibleItems();
    visibleStockCount.textContent = `${visible.length} of ${currentStock.length} stock entries shown`;

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No generated stock matches this filter.";
      stockList.append(empty);
      return;
    }

    const groupMode = groupSelect.value;
    if (groupMode === "none") {
      const cards = document.createElement("div");
      cards.className = "stock-cards";
      cards.replaceChildren(...visible.map(makeStockCard));
      stockList.append(cards);
      return;
    }

    const groups = new Map();
    for (const item of visible) {
      const key = groupMode === "location" ? item.location : categoryFor(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
    for (const groupName of groupNames) {
      const section = document.createElement("section");
      section.className = "stock-section";
      const heading = document.createElement("h3");
      heading.className = "stock-section-title";
      heading.textContent = `${groupName} (${groups.get(groupName).length})`;
      const cards = document.createElement("div");
      cards.className = "stock-cards";
      cards.replaceChildren(...groups.get(groupName).map(makeStockCard));
      section.append(heading, cards);
      stockList.append(section);
    }
  }

  function updateShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", currentSeed);
    url.searchParams.set("settlement", currentSettlementName);
    url.searchParams.set("shops", currentShopNames.join(","));
    url.searchParams.set("breadth", breadthSelect.value);
    url.searchParams.set("filter", filterSelect.value);
    url.searchParams.set("sort", sortSelect.value);
    url.searchParams.set("group", groupSelect.value);
    url.searchParams.delete("shop");
    url.hash = "shop";
    window.history.replaceState({}, "", url);
  }

  function stockAsText() {
    const visible = visibleItems();
    const heading = `${shopTitle.textContent}\n${shopKey.textContent}`;
    const lines = visible.map((item) => `- ${item.name} x${item.quantity} — ${item.price} — ${categoryFor(item)} — ${item.location} — ${item.availability} — ${sourceNames[item.source] ?? item.source}, p. ${item.page}`);
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
      itemCheckResult.className = "check-result unavailable";
      itemCheckResult.textContent = "Enter an item or spell name.";
      return;
    }

    const matches = currentStock.filter((item) => {
      const names = [item.name, item.baseName, item.spell?.name].filter(Boolean).map(normalise);
      return names.some((name) => name === query || name.includes(query) || query.includes(name));
    });

    if (matches.length) {
      const locations = Array.from(new Set(matches.map((item) => item.location))).sort();
      const totalQuantity = matches.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
      const first = matches[0];
      itemCheckResult.className = "check-result available";
      itemCheckResult.textContent = `Yes. ${first.name} is available at ${locations.join(", ")} (total quantity ${totalQuantity}; ${first.price}; ${sourceNames[first.source] ?? first.source} p. ${first.page}).`;
    } else {
      itemCheckResult.className = "check-result unavailable";
      itemCheckResult.textContent = "No. That item is not present in this generated settlement stock.";
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

  function buildShopOptions() {
    const availableShopNames = Object.keys(profiles.shops).filter((name) => name !== "specialist");
    const labels = availableShopNames.map((name) => {
      const label = document.createElement("label");
      label.className = "shop-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = name;
      const text = document.createElement("span");
      text.textContent = titleCase(name);
      label.append(input, text);
      return label;
    });
    shopOptions.replaceChildren(...labels);
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
      buildShopOptions();

      const parameters = new URLSearchParams(window.location.search);
      const requestedSettlement = parameters.get("settlement");
      settlementSelect.value = requestedSettlement && profiles.settlements[requestedSettlement] ? requestedSettlement : "city";

      const requestedBreadth = parameters.get("breadth");
      breadthSelect.value = breadthMultipliers[requestedBreadth] ? requestedBreadth : "broad";

      const validShopNames = new Set(Object.keys(profiles.shops).filter((name) => name !== "specialist"));
      const requestedShops = (parameters.get("shops") || parameters.get("shop") || "")
        .split(",")
        .filter((name) => validShopNames.has(name));
      setSelectedShops(requestedShops.length ? requestedShops : ["apothecary", "occult", "temple", "engineer"]);

      seedInput.value = parameters.get("seed") || makeSeed();
      sortSelect.value = ["name", "type", "location"].includes(parameters.get("sort")) ? parameters.get("sort") : "name";
      groupSelect.value = ["type", "location", "none"].includes(parameters.get("group")) ? parameters.get("group") : "type";

      status.textContent = `${items.length} catalogue entries and ${spells.length} spells loaded.`;
      if (window.location.hash === "#shop" || parameters.has("seed")) {
        switchView("shop-view");
        generateStock();
        const requestedFilter = parameters.get("filter");
        if (requestedFilter && Array.from(filterSelect.options).some((option) => option.value === requestedFilter)) {
          filterSelect.value = requestedFilter;
          renderVisibleStock();
        }
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
  selectAllShopsButton.addEventListener("click", () => {
    shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = true; });
  });
  clearShopsButton.addEventListener("click", () => {
    shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  });
  copySeedButton.addEventListener("click", () => copyText(seedInput.value, "Seed copied."));
  copyLinkButton.addEventListener("click", () => {
    if (!currentStock.length) generateStock();
    copyText(window.location.href, "Share link copied.");
  });
  copyListButton.addEventListener("click", () => copyText(stockAsText(), "Visible stock list copied."));
  itemCheckButton.addEventListener("click", checkItem);
  itemQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkItem();
  });
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") generateStock();
  });
  filterSelect.addEventListener("change", () => {
    renderVisibleStock();
    updateShareUrl();
  });
  sortSelect.addEventListener("change", () => {
    renderVisibleStock();
    updateShareUrl();
  });
  groupSelect.addEventListener("change", () => {
    renderVisibleStock();
    updateShareUrl();
  });

  loadData();
})();