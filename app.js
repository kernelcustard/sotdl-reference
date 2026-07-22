(() => {
  const rules = Array.isArray(window.RULES) ? window.RULES : [];
  const searchInput = document.querySelector("#search");
  const categoryContainer = document.querySelector("#categories");
  const rulesContainer = document.querySelector("#rules");
  const resultCount = document.querySelector("#result-count");
  const emptyState = document.querySelector("#empty-state");

  let selectedCategory = "All";

  const normalise = (value) => String(value ?? "").toLowerCase().trim();

  const categories = [
    "All",
    ...Array.from(new Set(rules.map((rule) => rule.category).filter(Boolean))).sort()
  ];

  function renderCategories() {
    categoryContainer.replaceChildren(...categories.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-button";
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === selectedCategory));
      button.addEventListener("click", () => {
        selectedCategory = category;
        renderCategories();
        renderRules();
      });
      return button;
    }));
  }

  function matchesSearch(rule, query) {
    if (!query) return true;
    const haystack = [
      rule.title,
      rule.category,
      rule.summary,
      rule.details,
      rule.source,
      ...(rule.tags ?? [])
    ].map(normalise).join(" ");
    return haystack.includes(query);
  }

  function createRuleCard(rule) {
    const card = document.createElement("details");
    card.className = "rule-card";
    card.id = rule.id;

    const summary = document.createElement("summary");
    const title = document.createElement("h2");
    title.className = "rule-title";
    title.textContent = rule.title;

    const shortText = document.createElement("p");
    shortText.className = "rule-summary";
    shortText.textContent = rule.summary;

    summary.append(title, shortText);

    const body = document.createElement("div");
    body.className = "rule-body";

    const details = document.createElement("p");
    details.textContent = rule.details;

    const meta = document.createElement("p");
    meta.className = "rule-meta";
    meta.innerHTML = `<span class="badge"></span><span></span>`;
    meta.querySelector(".badge").textContent = rule.category;
    meta.querySelector("span:last-child").textContent = rule.source;

    body.append(details, meta);
    card.append(summary, body);
    return card;
  }

  function renderRules() {
    const query = normalise(searchInput.value);
    const filtered = rules.filter((rule) => {
      const categoryMatch = selectedCategory === "All" || rule.category === selectedCategory;
      return categoryMatch && matchesSearch(rule, query);
    });

    rulesContainer.replaceChildren(...filtered.map(createRuleCard));
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "rule" : "rules"}`;
    emptyState.hidden = filtered.length !== 0;
  }

  searchInput.addEventListener("input", renderRules);
  renderCategories();
  renderRules();

  const linkedRule = window.location.hash.slice(1);
  if (linkedRule) {
    const target = document.getElementById(linkedRule);
    if (target) target.open = true;
  }
})();
