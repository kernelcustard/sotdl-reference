(() => {
  function compactGoldPrice(text) {
    const match = String(text).trim().match(/^(\d+)\s+gc(?:\s+(\d+)\s+ss)?(?:\s+(\d+)\s+cp)?$/i);
    if (!match) return text;

    let gold = Number(match[1]);
    let silver = Number(match[2] || 0);
    const copper = Number(match[3] || 0);

    silver += Math.ceil(copper / 10);
    gold += Math.floor(silver / 10);
    silver %= 10;

    return silver > 0 ? `${gold} gc ${silver} ss` : `${gold} gc`;
  }

  function updatePrices(root = document) {
    root.querySelectorAll(".stock-card strong").forEach((price) => {
      const compact = compactGoldPrice(price.textContent);
      if (compact !== price.textContent) price.textContent = compact;
    });
  }

  function start() {
    const stockList = document.querySelector("#stock-list");
    if (!stockList) return;

    updatePrices(stockList);
    new MutationObserver(() => updatePrices(stockList)).observe(stockList, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
