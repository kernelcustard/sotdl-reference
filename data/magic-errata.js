(() => {
  if (!Array.isArray(window.RULES)) return;

  const exchangingSpells = window.RULES.find((rule) => rule.id === "exchanging-spells");
  if (!exchangingSpells) return;

  Object.assign(exchangingSpells, {
    summary: "Whenever you are eligible to learn a new spell, you may also replace one spell you previously learned with a different spell.",
    details: "This exchange is additional to the new spell you are already eligible to learn: you learn the normal new spell, forget one previously learned spell, and learn a second new spell in its place. The replacement spell's rank must be equal to or lower than your Power score. This errata removes the core rulebook option to discover a tradition as part of the exchange and removes the requirement that the replacement be the same rank as, or lower rank than, the forgotten spell.",
    source: "Occult Philosophy, p. 7 (errata to Core rulebook, p. 111)",
    tags: [
      "swap spells",
      "retrain spell",
      "second new spell",
      "occult philosophy errata",
      "power score"
    ]
  });
})();
