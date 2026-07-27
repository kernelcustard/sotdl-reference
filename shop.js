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
    incantation: "Incantations",
    special_incantation: "Special incantations",
    alchemical_item: "Alchemical items",
    poison: "Poisons",
    alchemical_poison: "Alchemical poisons",
    poison_gear: "Poison gear",
    forbidden_item: "Forbidden goods",
    engineering_marvel: "Engineering marvels"
  };

  const availabilityOrder = { Common: 0, Uncommon: 1, Rare: 2, Exotic: 3, "GM permission": 4 };
  const breadthMultipliers = { standard: 1, broad: 1.65, extensive: 2.4 };

  const settlementSelect = document.querySelector("#shop-settlement");
  const breadthSelect = document.querySelector("#stock-breadth");
  const shopOptions = document.querySelector("#shop-options");
  const seedInput = document.querySelector("#shop-seed");
  const generateButton = document.querySelector("#generate-shop");
  const newSeedButton = document.querySelector("#new-seed");
  const copySeedButton = document.querySelector("#copy-seed");
  const copyLinkButton = document.querySelector("#copy-link");
  const copyListButton = document.querySelector("#copy-list");
  const selectAllShopsButton = document.querySelector("#select-all-shops");
  const clearShopsButton = document.querySelector("#clear-shops");
  const selectAllCategoriesButton = document.querySelector("#select-all-categories");
  const clearCategoriesButton = document.querySelector("#clear-categories");
  const categoryFilters = document.querySelector("#category-filters");
  const status = document.querySelector("#shop-status");
  const results = document.querySelector("#shop-results");
  const stockList = document.querySelector("#stock-list");
  const shopTitle = document.querySelector("#shop-title");
  const shopKey = document.querySelector("#shop-key");
  const itemQuery = document.querySelector("#item-query");
  const itemCheckResult = document.querySelector("#item-check-result");
  const visibleStockCount = document.querySelector("#visible-stock-count");

  let profiles = null;
  let items = [];
  let spells = [];
  let currentStock = [];
  let selectedCategories = new Set();

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

  function selectedShopNames() {
    return [...shopOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value).sort();
  }

  function selectedSort() {
    return document.querySelector('input[name="stock-sort"]:checked')?.value || "name";
  }

  function itemAvailableAtSettlement(item, settlement) {
    return (availabilityOrder[item.availability] ?? 99) <= (availabilityOrder[settlement.max_availability] ?? -1);
  }

  function itemMatchesShop(item, shopName, shopProfile) {
    return item.shop_types.split("|").includes(shopName) && shopProfile.categories.includes(item.category);
  }

  function makeIncantation(template, rng, usedKeys) {
    const rank = template.id.match(/rank-(\d+)/)?.[1] || "";
    const candidates = spells.filter((spell) => spell.rank === rank);
    for (let attempt = 0; attempt < 30 && candidates.length; attempt += 1) {
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
        category: "incantation",
        categoryLabel: `Rank ${rank} incantation`,
        detail: `${spell.tradition} ${spell.type.toLowerCase()} spell`
      };
    }
    return null;
  }

  function quantityFor(item, rng) {
    if (["potion", "poison", "alchemical_poison", "alchemical_item"].includes(item.category)) {
      const roll = rng();
      return roll < .65 ? 1 : roll < .9 ? 2 : 3;
    }
    return 1;
  }

  function generateStock() {
    if (!profiles || !items.length) return;
    const shops = selectedShopNames();
    if (!shops.length) { status.textContent = "Select at least one business."; return; }

    const seed = seedInput.value.trim() || makeSeed();
    seedInput.value = seed;
    const settlementName = settlementSelect.value;
    const breadth = breadthSelect.value;
    const settlement = profiles.settlements[settlementName];
    const multiplier = breadthMultipliers[breadth] || 1;
    const seedKey = `${seed}|${settlementName}|${breadth}|${shops.join(",")}`;
    const rng = mulberry32(xmur3(seedKey)());
    const usedKeys = new Set();
    const generated = [];

    for (const shopName of shops) {
      const shop = profiles.shops[shopName];
      const [baseMinimum, baseMaximum] = settlement.stock_slots.special;
      const minimum = Math.max(shopName === "black_market" ? 0 : 1, Math.round(baseMinimum * multiplier));
      const maximum = Math.max(minimum, Math.round(baseMaximum * multiplier));
      const slotCount = randomInteger(rng, minimum, maximum);
      const eligible = items.filter((item) => itemAvailableAtSettlement(item, settlement) && itemMatchesShop(item, shopName, shop));

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
          stockItem = { ...selected, key: selected.id, categoryLabel: categoryNames[selected.category] || titleCase(selected.category), detail: selected.notes || "" };
        }
        if (!stockItem) continue;
        stockItem.quantity = quantityFor(stockItem, rng);
        stockItem.location = titleCase(shopName);
        generated.push(stockItem);
      }
    }

    currentStock = generated;
    selectedCategories = new Set([...new Set(currentStock.map((item) => item.category))]);
    buildCategoryFilters();
    renderStock();
    updateShareUrl();
    results.hidden = false;
    status.textContent = "";
  }

  function buildCategoryFilters() {
    const categories = [...new Set(currentStock.map((item) => item.category))].sort((a, b) => (categoryNames[a] || a).localeCompare(categoryNames[b] || b));
    categoryFilters.replaceChildren(...categories.map((category) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = category;
      input.checked = selectedCategories.has(category);
      input.addEventListener("change", () => {
        if (input.checked) selectedCategories.add(category); else selectedCategories.delete(category);
        renderStock();
      });
      label.append(input, document.createTextNode(categoryNames[category] || titleCase(category)));
      return label;
    }));
  }

  function filteredStock() {
    const query = normalise(itemQuery.value);
    return currentStock.filter((item) => {
      if (!selectedCategories.has(item.category)) return false;
      if (!query) return true;
      const haystack = [item.name, item.baseName, item.spell?.name, item.categoryLabel, item.location, item.detail, sourceNames[item.source]].filter(Boolean).map(normalise).join(" ");
      return haystack.includes(query);
    });
  }

  function sortItems(values, mode) {
    return [...values].sort((a, b) => {
      if (mode === "type") return (categoryNames[a.category] || a.category).localeCompare(categoryNames[b.category] || b.category) || a.name.localeCompare(b.name);
      if (mode === "location") return a.location.localeCompare(b.location) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }

  function makeStockCard(item) {
    const article = document.createElement("article");
    article.className = "stock-card";
    const heading = document.createElement("div");
    heading.className = "stock-card-heading";
    const title = document.createElement("h3");
    title.append(document.createTextNode(item.name + " "));
    const location = document.createElement("span");
    location.className = "stock-location-inline";
    location.textContent = `(${item.location})`;
    title.append(location);
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
    const settlementName = settlementSelect.value;
    const settlement = profiles.settlements[settlementName];
    shopTitle.textContent = `${titleCase(settlementName)} Stock`;
    shopKey.textContent = `Seed ${seedInput.value} · maximum ${settlement.max_availability}`;
    visibleStockCount.textContent = `${visible.length} of ${currentStock.length} items`;
    stockList.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No matching stock.";
      stockList.append(empty);
    } else if (mode === "name") {
      stockList.replaceChildren(...visible.map(makeStockCard));
    } else {
      const groups = new Map();
      for (const item of visible) {
        const key = mode === "type" ? (categoryNames[item.category] || titleCase(item.category)) : item.location;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      }
      for (const [groupName, groupItems] of groups) {
        const section = document.createElement("section");
        section.className = "stock-section";
        const heading = document.createElement("h3");
        heading.className = "stock-section-title";
        heading.textContent = groupName;
        const cards = document.createElement("div");
        cards.className = "stock-cards";
        cards.replaceChildren(...groupItems.map(makeStockCard));
        section.append(heading, cards);
        stockList.append(section);
      }
    }

    const query = normalise(itemQuery.value);
    if (query) {
      const exact = currentStock.find((item) => [item.name, item.baseName, item.spell?.name].filter(Boolean).map(normalise).some((name) => name === query));
      itemCheckResult.className = `check-result ${exact ? "available" : visible.length ? "available" : "unavailable"}`;
      itemCheckResult.textContent = exact ? `${exact.name} is available at ${exact.location}.` : visible.length ? `${visible.length} matching item${visible.length === 1 ? "" : "s"}.` : "No matching item is available.";
    } else itemCheckResult.textContent = "";
  }

  function updateShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seedInput.value.trim());
    url.searchParams.set("settlement", settlementSelect.value);
    url.searchParams.set("breadth", breadthSelect.value);
    url.searchParams.set("shops", selectedShopNames().join(","));
    url.searchParams.set("sort", selectedSort());
    url.hash = "shop";
    window.history.replaceState({}, "", url);
  }

  function stockAsText() {
    const visible = sortItems(filteredStock(), selectedSort());
    return [`${shopTitle.textContent}`, `${shopKey.textContent}`, "", ...visible.map((item) => `- ${item.name} (${item.location}) x${item.quantity} — ${item.price} — ${sourceNames[item.source] ?? item.source}, p. ${item.page}`)].join("\n");
  }

  async function copyText(text, successMessage) {
    try { await navigator.clipboard.writeText(text); status.textContent = successMessage; }
    catch { status.textContent = "Copying was blocked by the browser."; }
  }

  function switchView(viewId) {
    document.querySelectorAll(".app-view").forEach((view) => { view.hidden = view.id !== viewId; });
    document.querySelectorAll(".view-tab").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === viewId)));
    window.location.hash = viewId === "shop-view" ? "shop" : "rules";
  }

  async function loadData() {
    try {
      const [profileResponse, itemResponse, ...spellResponses] = await Promise.all([
        fetch(`${DATA_ROOT}/location-profiles.json`, { cache: "no-store" }),
        fetch(`${DATA_ROOT}/items.csv`, { cache: "no-store" }),
        ...SPELL_FILES.map((file) => fetch(`${DATA_ROOT}/${file}`, { cache: "no-store" }))
      ]);
      if ([profileResponse, itemResponse, ...spellResponses].some((response) => !response.ok)) throw new Error("One or more data files could not be loaded.");
      profiles = await profileResponse.json();
      items = parseCsv(await itemResponse.text());
      spells = (await Promise.all(spellResponses.map((response) => response.text()))).flatMap(parseCsv).filter((spell) => spell.name && spell.rank && spell.tradition);

      settlementSelect.replaceChildren(...Object.entries(profiles.settlements).map(([value, profile]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${titleCase(value)} (${profile.population_hint})`;
        return option;
      }));

      shopOptions.replaceChildren(...Object.keys(profiles.shops).map((value) => {
        const label = document.createElement("label");
        label.className = "shop-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = value;
        label.append(input, document.createTextNode(titleCase(value)));
        return label;
      }));

      const parameters = new URLSearchParams(window.location.search);
      settlementSelect.value = profiles.settlements[parameters.get("settlement")] ? parameters.get("settlement") : "city";
      breadthSelect.value = breadthMultipliers[parameters.get("breadth")] ? parameters.get("breadth") : "broad";
      seedInput.value = parameters.get("seed") || makeSeed();
      const requestedShops = (parameters.get("shops") || "apothecary,occult,temple,engineer").split(",");
      shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = requestedShops.includes(input.value); });
      const requestedSort = parameters.get("sort") || "name";
      const sortRadio = document.querySelector(`input[name="stock-sort"][value="${requestedSort}"]`);
      if (sortRadio) sortRadio.checked = true;

      status.textContent = "";
      if (window.location.hash === "#shop" || parameters.has("seed")) { switchView("shop-view"); generateStock(); }
    } catch (error) {
      status.textContent = `Shop data could not be loaded: ${error.message}`;
      generateButton.disabled = true;
    }
  }

  document.querySelectorAll(".view-tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  generateButton.addEventListener("click", generateStock);
  newSeedButton.addEventListener("click", () => { seedInput.value = makeSeed(); generateStock(); });
  copySeedButton.addEventListener("click", () => copyText(seedInput.value, "Seed copied."));
  copyLinkButton.addEventListener("click", () => { if (!currentStock.length) generateStock(); copyText(window.location.href, "Share link copied."); });
  copyListButton.addEventListener("click", () => copyText(stockAsText(), "List copied."));
  selectAllShopsButton.addEventListener("click", () => shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = true; }));
  clearShopsButton.addEventListener("click", () => shopOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; }));
  selectAllCategoriesButton.addEventListener("click", () => { selectedCategories = new Set(currentStock.map((item) => item.category)); buildCategoryFilters(); renderStock(); });
  clearCategoriesButton.addEventListener("click", () => { selectedCategories.clear(); buildCategoryFilters(); renderStock(); });
  itemQuery.addEventListener("input", renderStock);
  seedInput.addEventListener("keydown", (event) => { if (event.key === "Enter") generateStock(); });
  document.querySelectorAll('input[name="stock-sort"]').forEach((input) => input.addEventListener("change", () => { renderStock(); updateShareUrl(); document.querySelector("#sort-menu").open = false; }));

  loadData();
})();