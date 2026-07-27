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

  const categoryNames = {
    potion: "Potions",
    alchemical_item: "Alchemical items",
    poison: "Poisons",
    alchemical_poison: "Alchemical poisons",
    engineering_marvel: "Engineering marvels",
    poison_gear: "Poison gear",
    forbidden_item: "Forbidden goods",
    incantation: "Incantations",
    special_incantation: "Incantations"
  };

  const categoryOrder = [
    "potion", "alchemical_item", "poison", "alchemical_poison",
    "engineering_marvel", "poison_gear", "forbidden_item", "incantation"
  ];

  const forbiddenTraditions = new Set([
    "chaos", "curse", "death", "demonology", "destruction",
    "forbidden", "madness", "necromancy", "shadow"
  ]);

  const clericalTraditions = new Set([
    "celestial", "life", "theurgy", "battle", "earth", "nature",
    "primal", "order", "soul", "spiritualism", "air", "water", "fire"
  ]);

  const broadFilters = {
    potions: new Set(["potion", "alchemical_item"]),
    poison: new Set(["poison", "alchemical_poison"]),
    gear: new Set(["engineering_marvel", "poison_gear"])
  };

  const availabilityOrder = { Common: 0, Uncommon: 1, Rare: 2, Exotic: 3, "GM permission": 4 };
  const breadthMultipliers = { standard: 3.2, broad: 4.8, extensive: 6.2 };
  const favouriteCounts = { standard: 3, broad: 4, extensive: 5 };

  const settlementSelect = document.querySelector("#shop-settlement");
  const breadthSelect = document.querySelector("#stock-breadth");
  const specialisationSelect = document.querySelector("#stock-specialisation");
  const seedInput = document.querySelector("#shop-seed");
  const generateButton = document.querySelector("#generate-shop");
  const newSeedButton = document.querySelector("#new-seed");
  const copyLinkButton = document.querySelector("#copy-link");
  const copyListButton = document.querySelector("#copy-list");
  const status = document.querySelector("#shop-status");
  const results = document.querySelector("#shop-results");
  const stockList = document.querySelector("#stock-list");
  const shopTitle = document.querySelector("#shop-title");
  const shopKey = document.querySelector("#shop-key");
  const itemQuery = document.querySelector("#item-query");
  const visibleStockCount = document.querySelector("#visible-stock-count");
  const filterBar = document.querySelector("#stock-filter-bar");
  const sortMenu = document.querySelector("#sort-menu");

  let profiles = null;
  let items = [];
  let spells = [];
  let currentStock = [];
  let selectedFilters = new Set();
  let favouriteTraditions = [];

  const titleCase = (value) => String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const normalise = (value) => String(value ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, " ").trim();

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];
      if (character === '"' && quoted && next === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { row.push(field); field = ""; }
      else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else field += character;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
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

  const choose = (rng, values) => values[Math.floor(rng() * values.length)];
  const randomInteger = (rng, minimum, maximum) => minimum + Math.floor(rng() * (maximum - minimum + 1));

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
    const values = new Uint32Array(2);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(values);
    else { values[0] = Date.now() >>> 0; values[1] = Math.floor(Math.random() * 0xffffffff); }
    return `${words[values[0] % words.length]}-${words[values[1] % words.length]}-${(values[0] ^ values[1]).toString(36)}`;
  }

  function selectedSort() {
    return document.querySelector('input[name="stock-sort"]:checked')?.value || "type";
  }

  function itemTradition(item) {
    if (item.spell?.tradition) return item.spell.tradition;
    if (item.tradition) return item.tradition;
    const known = [
      "Air", "Alchemy", "Alteration", "Arcana", "Battle", "Celestial", "Chaos", "Conjuration", "Curse", "Death",
      "Demonology", "Destruction", "Divination", "Earth", "Enchantment", "Fey", "Fire", "Forbidden", "Illusion",
      "Invocation", "Life", "Madness", "Metal", "Nature", "Necromancy", "Order", "Primal", "Protection", "Rune",
      "Shadow", "Song", "Soul", "Spiritualism", "Storm", "Technomancy", "Telekinesis", "Telepathy", "Teleportation",
      "Theurgy", "Time", "Transformation", "Water"
    ];
    const haystack = normalise(`${item.tags || ""} ${item.detail || ""}`);
    return known.find((tradition) => haystack.includes(normalise(tradition))) || "";
  }

  function traditionDomain(tradition) {
    const key = normalise(tradition);
    if (forbiddenTraditions.has(key)) return "forbidden";
    if (clericalTraditions.has(key)) return "clerical";
    return "magical";
  }

  function itemDomain(item) {
    if (["incantation", "special_incantation"].includes(item.category)) return traditionDomain(itemTradition(item));
    if (item.category === "forbidden_item") return "forbidden";
    return "";
  }

  function itemAvailableAtSettlement(item, settlement) {
    return (availabilityOrder[item.availability] ?? 99) <= (availabilityOrder[settlement.max_availability] ?? -1);
  }

  function rankFromTemplate(template) {
    return template.id.match(/rank-(\d+)/)?.[1] || "";
  }

  function makeIncantation(template, rng, usedKeys) {
    const rank = rankFromTemplate(template);
    let candidates = spells.filter((spell) => spell.rank === rank && !usedKeys.has(`incantation:${spell.id}`));
    if (!candidates.length) return null;

    if (specialisationSelect.value === "specialised" && favouriteTraditions.length) {
      const favoured = candidates.filter((spell) => favouriteTraditions.includes(spell.tradition));
      const outsiders = candidates.filter((spell) => !favouriteTraditions.includes(spell.tradition));
      candidates = rng() < 0.82 && favoured.length ? favoured : (outsiders.length ? outsiders : favoured);
    }

    const spell = choose(rng, candidates);
    const key = `incantation:${spell.id}`;
    usedKeys.add(key);
    return {
      ...template,
      key,
      name: `${spell.name} incantation`,
      baseName: spell.name,
      spell,
      source: spell.source,
      page: spell.page,
      category: "incantation",
      categoryLabel: `Rank ${rank} incantation`,
      detail: `${spell.tradition} ${String(spell.type).toLowerCase()} spell`,
      tradition: spell.tradition
    };
  }

  function quantityFor(item, rng) {
    if (["potion", "poison", "alchemical_poison", "alchemical_item"].includes(item.category)) {
      const roll = rng();
      return roll < .65 ? 1 : roll < .9 ? 2 : 3;
    }
    return 1;
  }

  function chooseFavouriteTraditions(rng) {
    const traditions = [...new Set(spells.map((spell) => spell.tradition).filter(Boolean))];
    const count = favouriteCounts[breadthSelect.value] || 4;
    const selected = [];
    while (selected.length < count && traditions.length) {
      const index = Math.floor(rng() * traditions.length);
      selected.push(traditions.splice(index, 1)[0]);
    }
    return selected.sort();
  }

  function generateStock() {
    if (!profiles || !items.length) return;
    const seed = seedInput.value.trim() || makeSeed();
    seedInput.value = seed;
    const settlementName = settlementSelect.value;
    const breadth = breadthSelect.value;
    const settlement = profiles.settlements[settlementName];
    const seedKey = `${seed}|${settlementName}|${breadth}|${specialisationSelect.value}`;
    const rng = mulberry32(xmur3(seedKey)());
    favouriteTraditions = specialisationSelect.value === "specialised" ? chooseFavouriteTraditions(rng) : [];

    const [baseMinimum, baseMaximum] = settlement.stock_slots.special;
    const multiplier = breadthMultipliers[breadth] || 1;
    const minimum = Math.max(4, Math.round(baseMinimum * multiplier));
    const maximum = Math.max(minimum, Math.round(baseMaximum * multiplier));
    const slotCount = randomInteger(rng, minimum, maximum);
    const eligible = items.filter((item) => itemAvailableAtSettlement(item, settlement));
    const usedKeys = new Set();
    const generated = [];

    for (let slot = 0; slot < slotCount && eligible.length; slot += 1) {
      const preferredRarity = weightedChoice(rng, settlement.rarity_weights);
      let pool = eligible.filter((item) => item.availability === preferredRarity && !usedKeys.has(item.id));
      if (!pool.length) pool = eligible.filter((item) => !usedKeys.has(item.id));
      if (!pool.length) break;

      const selected = choose(rng, pool);
      let stockItem;
      if (selected.category === "incantation") stockItem = makeIncantation(selected, rng, usedKeys);
      else {
        usedKeys.add(selected.id);
        stockItem = {
          ...selected,
          key: selected.id,
          categoryLabel: categoryNames[selected.category] || titleCase(selected.category),
          detail: selected.notes || "",
          tradition: itemTradition(selected)
        };
      }
      if (!stockItem) continue;
      stockItem.quantity = quantityFor(stockItem, rng);
      generated.push(stockItem);
    }

    currentStock = generated;
    selectedFilters.clear();
    syncFilterButtons();
    itemQuery.value = "";
    results.hidden = false;
    status.textContent = "";
    renderStock();
  }

  function matchesFilter(item) {
    if (!selectedFilters.size) return true;
    return [...selectedFilters].some((filterName) => {
      if (broadFilters[filterName]?.has(item.category)) return true;
      if (["forbidden", "clerical", "magical"].includes(filterName)) return itemDomain(item) === filterName;
      return false;
    });
  }

  function filteredStock() {
    const query = normalise(itemQuery.value);
    return currentStock.filter((item) => {
      if (!matchesFilter(item)) return false;
      if (!query) return true;
      return normalise([
        item.name, item.baseName, item.categoryLabel, item.detail,
        itemTradition(item), sourceNames[item.source]
      ].filter(Boolean).join(" ")).includes(query);
    });
  }

  function groupCategory(item) {
    return item.category === "special_incantation" ? "incantation" : item.category;
  }

  function sortItems(values, mode) {
    return [...values].sort((a, b) => {
      if (mode === "price") {
        return (Number(a.price_cp) || 0) - (Number(b.price_cp) || 0) || a.name.localeCompare(b.name);
      }
      if (mode === "type") {
        const aCategory = groupCategory(a);
        const bCategory = groupCategory(b);
        const categoryDifference = categoryOrder.indexOf(aCategory) - categoryOrder.indexOf(bCategory);
        if (categoryDifference) return categoryDifference;
        if (aCategory === "incantation") {
          const traditionDifference = itemTradition(a).localeCompare(itemTradition(b));
          if (traditionDifference) return traditionDifference;
          const rankDifference = Number(a.spell?.rank ?? rankFromTemplate(a) ?? 0) - Number(b.spell?.rank ?? rankFromTemplate(b) ?? 0);
          if (rankDifference) return rankDifference;
        }
      }
      return a.name.localeCompare(b.name);
    });
  }

  function makeStockCard(item) {
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
    meta.className = "stock-meta-line";
    meta.textContent = `${item.categoryLabel} · ${item.availability} · qty ${item.quantity}`;
    article.append(heading, meta);

    if (item.detail) {
      const detail = document.createElement("p");
      detail.className = "stock-detail";
      detail.textContent = item.detail;
      article.append(detail);
    }

    const source = document.createElement("p");
    source.className = "stock-source";
    source.textContent = `${sourceNames[item.source] ?? item.source} p. ${item.page}`;
    article.append(source);
    return article;
  }

  function renderStock() {
    if (!profiles) return;
    const mode = selectedSort();
    const visible = sortItems(filteredStock(), mode);
    stockList.replaceChildren();
    shopTitle.textContent = `${titleCase(settlementSelect.value)} Stock`;
    const settlement = profiles.settlements[settlementSelect.value];
    const specialisationText = favouriteTraditions.length ? `Specialised: ${favouriteTraditions.join(", ")}` : "General";
    shopKey.textContent = `Seed: ${seedInput.value} · maximum ${settlement.max_availability} · ${specialisationText}`;

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching stock.";
      stockList.append(empty);
    } else if (mode === "type") {
      const groups = new Map();
      for (const item of visible) {
        const key = groupCategory(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      }
      for (const category of categoryOrder) {
        const groupItems = groups.get(category);
        if (!groupItems?.length) continue;
        const section = document.createElement("section");
        section.className = "stock-section";
        const title = document.createElement("h3");
        title.className = "stock-section-title";
        title.textContent = categoryNames[category] || titleCase(category);
        const cards = document.createElement("div");
        cards.className = "stock-cards";
        cards.replaceChildren(...groupItems.map(makeStockCard));
        section.append(title, cards);
        stockList.append(section);
      }
    } else {
      stockList.replaceChildren(...visible.map(makeStockCard));
    }

    visibleStockCount.textContent = `${visible.length} of ${currentStock.length} items`;
    updateShareUrl();
  }

  function syncFilterButtons() {
    filterBar.querySelectorAll("button[data-filter]").forEach((button) => {
      const key = button.dataset.filter;
      button.setAttribute("aria-pressed", String(key === "all" ? selectedFilters.size === 0 : selectedFilters.has(key)));
    });
  }

  function updateShareUrl() {
    if (!profiles) return;
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seedInput.value);
    url.searchParams.set("settlement", settlementSelect.value);
    url.searchParams.set("breadth", breadthSelect.value);
    url.searchParams.set("specialisation", specialisationSelect.value);
    url.searchParams.set("sort", selectedSort());
    if (selectedFilters.size) url.searchParams.set("filters", [...selectedFilters].sort().join(","));
    else url.searchParams.delete("filters");
    url.hash = "shop";
    window.history.replaceState({}, "", url);
  }

  function stockAsText() {
    const visible = sortItems(filteredStock(), selectedSort());
    const lines = visible.map((item) => `- ${item.name} x${item.quantity} — ${item.price} — ${item.availability} — ${sourceNames[item.source] ?? item.source}, p. ${item.page}`);
    return [shopTitle.textContent, shopKey.textContent, "", ...lines].join("\n");
  }

  async function copySilently(text) {
    try { await navigator.clipboard.writeText(text); } catch { /* Browser blocked copying. */ }
  }

  function switchView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => { view.hidden = view.id !== viewId; });
    document.querySelectorAll(".view-tab").forEach((button) => { button.setAttribute("aria-pressed", String(button.dataset.view === viewId)); });
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

      const parameters = new URLSearchParams(window.location.search);
      settlementSelect.value = profiles.settlements[parameters.get("settlement")] ? parameters.get("settlement") : "city";
      breadthSelect.value = parameters.get("breadth") || "broad";
      specialisationSelect.value = parameters.get("specialisation") === "specialised" ? "specialised" : "general";
      seedInput.value = parameters.get("seed") || makeSeed();

      const requestedSort = parameters.get("sort") || "type";
      const sortInput = document.querySelector(`input[name="stock-sort"][value="${requestedSort}"]`);
      if (sortInput) sortInput.checked = true;
      const requestedFilters = parameters.get("filters");
      if (requestedFilters) selectedFilters = new Set(requestedFilters.split(",").filter((name) => ["potions", "poison", "gear", "forbidden", "clerical", "magical"].includes(name)));
      syncFilterButtons();

      status.textContent = "";
      if (window.location.hash === "#shop" || parameters.has("seed")) {
        switchView("shop-view");
        generateStock();
      }
    } catch (error) {
      status.textContent = `Stock data could not be loaded: ${error.message}`;
      generateButton.disabled = true;
    }
  }

  document.querySelectorAll(".view-tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  generateButton.addEventListener("click", generateStock);
  newSeedButton.addEventListener("click", () => { seedInput.value = makeSeed(); generateStock(); });
  copyLinkButton.addEventListener("click", () => copySilently(window.location.href));
  copyListButton.addEventListener("click", () => copySilently(stockAsText()));
  itemQuery.addEventListener("input", renderStock);
  seedInput.addEventListener("keydown", (event) => { if (event.key === "Enter") generateStock(); });

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    const filterName = button.dataset.filter;
    if (filterName === "all") selectedFilters.clear();
    else if (selectedFilters.has(filterName)) selectedFilters.delete(filterName);
    else selectedFilters.add(filterName);
    syncFilterButtons();
    renderStock();
  });

  document.querySelectorAll('input[name="stock-sort"]').forEach((input) => input.addEventListener("change", () => {
    sortMenu.open = false;
    renderStock();
  }));

  document.addEventListener("click", (event) => {
    if (sortMenu.open && !sortMenu.contains(event.target)) sortMenu.open = false;
  });

  loadData();
})();