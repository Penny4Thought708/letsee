export const categories = [
  { name: "Flooring", keywords: ["floor", "vinyl", "tile", "laminate"] },
  { name: "Painting", keywords: ["paint", "roller", "primer", "wall"] },
  { name: "Bathroom", keywords: ["bath", "toilet", "sink", "shower"] },
  { name: "Lighting", keywords: ["light", "bulb", "fixture", "lamp"] },
  { name: "Outdoor", keywords: ["garden", "deck", "yard", "outdoor"] }
];

export function detectCategorySmart(query) {
  const q = query.toLowerCase();
  let best = { name: "General", score: 0 };

  for (const cat of categories) {
    let score = 0;
    for (const key of cat.keywords) {
      if (q.includes(key)) score++;
    }
    if (score > best.score) best = { name: cat.name, score };
  }

  return best.name;
}
