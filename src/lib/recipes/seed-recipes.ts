import type { Recipe, RecipeIngredient } from "@/lib/recipes";

export type RecipeVariant = {
  label: string;
  title: string;
  tags: string[];
};

type CategorySeed = {
  category: string;
  categorySlug: string;
  baseServings?: number;
  baby?: boolean;
  titles: string[];
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeRecipeName(value: string) {
  return slug(value).replace(/-/g, " ");
}

function ingredient(name: string, quantity: number, unit: string): RecipeIngredient {
  return { name, quantity, unit };
}

function has(title: string, word: string) {
  return normalizeRecipeName(title).includes(normalizeRecipeName(word));
}

function inferIngredients(title: string, categorySlug: string): RecipeIngredient[] {
  const ingredients: RecipeIngredient[] = [];
  const add = (name: string, quantity: number, unit: string) => {
    if (!ingredients.some((item) => item.name === name)) {
      ingredients.push(ingredient(name, quantity, unit));
    }
  };

  if (categorySlug === "bebe") {
    if (has(title, "pomme")) add("pomme", 2, "piece");
    if (has(title, "banane")) add("banane", 1, "piece");
    if (has(title, "poire")) add("poire", 2, "piece");
    if (has(title, "peche")) add("peche", 2, "piece");
    if (has(title, "carotte")) add("carotte", 300, "g");
    if (has(title, "courgette")) add("courgette", 300, "g");
    if (has(title, "pomme de terre") || has(title, "patate")) add("pomme de terre", 300, "g");
    if (has(title, "poulet")) add("poulet", 120, "g");
    if (has(title, "poisson")) add("poisson", 120, "g");
    if (has(title, "riz")) add("riz", 120, "g");
    if (has(title, "brocoli")) add("brocoli", 250, "g");
    if (has(title, "petits pois")) add("petits pois", 250, "g");
    if (ingredients.length === 0) add("carotte", 300, "g");
    return ingredients;
  }

  if (has(title, "poulet")) add("poulet", 450, "g");
  if (has(title, "boeuf") || has(title, "viande") || has(title, "kefta") || has(title, "steak") || has(title, "burger")) add("viande boeuf", 400, "g");
  if (has(title, "poisson") || has(title, "saumon") || has(title, "sardine")) add("poisson", 450, "g");
  if (has(title, "crevette")) add("crevettes", 350, "g");
  if (has(title, "thon")) add("thon", 1, "piece");
  if (has(title, "pates") || has(title, "spaghetti") || has(title, "penne") || has(title, "macaroni") || has(title, "lasagnes")) add("pates", 250, "g");
  if (has(title, "riz") || has(title, "cantonais")) add("riz", 220, "g");
  if (has(title, "nouilles") || has(title, "ramen")) add("nouilles", 250, "g");
  if (has(title, "pizza")) add("pate pizza", 1, "piece");
  if (has(title, "fromage")) add("fromage", 120, "g");
  if (has(title, "creme")) add("creme", 200, "ml");
  if (has(title, "tomate") || has(title, "bolognaise")) add("tomate", 2, "piece");
  if (has(title, "oignon")) add("oignon", 1, "piece");
  if (has(title, "carotte")) add("carotte", 2, "piece");
  if (has(title, "courgette")) add("courgette", 1, "piece");
  if (has(title, "legumes") || has(title, "wok")) {
    add("carotte", 2, "piece");
    add("courgette", 1, "piece");
  }
  if (has(title, "pomme de terre") || has(title, "frites") || has(title, "patate")) add("pomme de terre", 500, "g");
  if (has(title, "salade")) add("laitue", 1, "piece");
  if (has(title, "jus") || has(title, "orange")) add("orange", 4, "piece");
  if (has(title, "citron")) add("citron", 1, "piece");
  if (has(title, "pomme")) add("pomme", 2, "piece");
  if (has(title, "banane")) add("banane", 2, "piece");
  if (has(title, "oeuf") || has(title, "omelette")) add("oeuf", 4, "piece");
  if (ingredients.length === 0) add(categorySlug === "salade" ? "tomate" : "poulet", categorySlug === "salade" ? 2 : 400, categorySlug === "salade" ? "piece" : "g");
  return ingredients;
}

function recipeTags(title: string, categorySlug: string) {
  const tags = new Set<string>();
  if (categorySlug === "bebe") tags.add("bebe");
  if (categorySlug === "rapide" || has(title, "rapide") || has(title, "sandwich") || has(title, "omelette")) tags.add("moins-30-min");
  if (has(title, "economique") || has(title, "lentilles") || has(title, "oeuf") || has(title, "riz") || has(title, "pomme de terre")) tags.add("petit-budget");
  return Array.from(tags);
}

function minutesFor(title: string, categorySlug: string) {
  if (categorySlug === "bebe") return 25;
  if (categorySlug === "jus") return 10;
  if (categorySlug === "salade" || categorySlug === "rapide") return 20;
  if (categorySlug === "tajine") return 55;
  if (categorySlug === "pizza") return 35;
  return has(title, "rapide") ? 20 : 35;
}

function stepsFor(categorySlug: string) {
  if (categorySlug === "bebe") {
    return ["Cuire doucement a la vapeur sans sel ni sucre ajoute.", "Mixer jusqu'a texture lisse.", "Laisser tiedir avant de servir."];
  }

  if (categorySlug === "jus") {
    return ["Laver et couper les fruits.", "Mixer ou presser.", "Servir frais sans sucre ajoute si possible."];
  }

  return ["Preparer les ingredients.", "Cuire ou assembler selon la recette.", "Servir chaud ou frais selon le plat."];
}

function buildRecipe(title: string, seed: CategorySeed): Recipe {
  return {
    id: slug(`${seed.categorySlug}-${title}`),
    title,
    category: seed.category,
    categorySlug: seed.categorySlug,
    baseServings: seed.baseServings ?? 2,
    minutes: minutesFor(title, seed.categorySlug),
    tags: recipeTags(title, seed.categorySlug),
    ingredients: inferIngredients(title, seed.categorySlug),
    steps: stepsFor(seed.categorySlug),
  };
}

const targetPerCategory = 100;
const globalStyles = [
  "maison",
  "aux herbes",
  "citron",
  "tomates",
  "oignons",
  "carottes",
  "courgettes",
  "pommes de terre",
  "riz",
  "fromage",
  "legumes",
  "economique",
  "rapide",
  "gratiné",
  "four",
  "crème",
  "olives",
  "champignons",
  "ail",
  "gingembre",
  "poivrons",
  "petits pois",
  "pois chiches",
  "salade",
  "façon marocaine",
  "façon familiale",
  "léger",
  "protéiné",
  "doux",
  "express",
];

const categoryStyles: Record<string, string[]> = {
  tajine: ["chermoula", "safran", "amandes", "pruneaux", "raisins secs", "artichauts", "coings"],
  pates: ["pesto", "bolognaise", "arrabiata", "carbonara", "quatre fromages", "thon tomate", "poulet crème"],
  poulet: ["moutarde", "barbecue", "teriyaki", "curry", "paprika", "miel", "tikka"],
  viande: ["sauce poivre", "brochettes", "kefta", "bourguignon", "chili", "grillé", "tajine"],
  poisson: ["chermoula", "vapeur", "grillé", "teriyaki", "sauce tomate", "fruits de mer", "ail citron"],
  salade: ["thon", "riz", "quinoa", "avocat", "niçoise", "grecque", "césar"],
  rapide: ["sandwich", "wrap", "toast", "omelette", "tacos", "burger", "croque"],
  bebe: ["texture lisse", "vapeur", "sans sel", "douce", "mixée", "petite portion", "légumes doux"],
  pizza: ["mozzarella", "olives", "champignons", "thon", "poulet", "quatre fromages", "végétarienne"],
  jus: ["frais", "sans sucre", "gingembre", "menthe", "pomme", "banane", "orange"],
  asiatique: ["soja", "wok", "teriyaki", "gingembre", "nouilles", "riz frit", "sésame"],
};

const seeds: CategorySeed[] = [
  {
    category: "tajine",
    categorySlug: "tajine",
    titles: [
      "Tajine poulet olives citron", "Tajine poulet pommes de terre", "Tajine poulet carottes", "Tajine poulet courgettes", "Tajine poulet legumes", "Tajine poulet petits pois", "Tajine poulet tomate", "Tajine poulet oignons", "Tajine poulet pruneaux", "Tajine poulet amandes",
      "Tajine viande legumes", "Tajine viande pruneaux", "Tajine viande pommes de terre", "Tajine viande carottes", "Tajine viande courgettes", "Tajine viande tomate", "Tajine viande pois chiches", "Tajine viande oignons", "Tajine kefta tomate", "Tajine kefta oeufs",
      "Tajine poisson legumes", "Tajine poisson citron", "Tajine poisson pommes de terre", "Tajine poisson tomates", "Tajine sardines tomate", "Tajine boulettes sardines", "Tajine legumes economique", "Tajine lentilles legumes", "Tajine courgettes tomates", "Tajine pommes de terre olives",
    ],
  },
  {
    category: "Pates",
    categorySlug: "pates",
    titles: [
      "Spaghetti bolognaise", "Pates poulet creme", "Gratin de pates fromage", "Penne tomate basilic", "Macaroni fromage", "Spaghetti thon tomate", "Pates legumes", "Pates carbonara", "Lasagnes bolognaise", "Lasagnes legumes",
      "Pates crevettes ail", "Pates saumon creme", "Pates poulet champignons", "Pates sauce tomate", "Pates pesto maison", "Pates kefta tomate", "Pates fromage rapide", "Pates thon mais", "Pates courgettes creme", "Pates oignons tomate",
      "Spaghetti ail huile", "Penne poulet curry", "Macaroni gratine", "Pates sardines tomate", "Pates boeuf fromage", "Pates epinards creme", "Pates poivrons tomate", "Pates economiques tomate", "Pates poulet legumes", "Pates rapides oeuf",
    ],
  },
  {
    category: "Poulet",
    categorySlug: "poulet",
    titles: [
      "Poulet roti pommes de terre", "Emince poulet legumes", "Poulet curry riz", "Poulet citron", "Poulet creme champignons", "Poulet grille salade", "Poulet aux olives", "Poulet tomate oignons", "Poulet pané maison", "Poulet riz legumes",
      "Brochettes poulet", "Poulet au four carottes", "Poulet sauce moutarde", "Poulet pommes de terre olives", "Poulet courgettes tomate", "Poulet haricots verts", "Poulet pois chiches", "Poulet vermicelle", "Poulet tacos maison", "Poulet sandwich rapide",
      "Poulet gratine fromage", "Poulet lait coco", "Poulet paprika doux", "Poulet aux oignons", "Poulet legumes vapeur", "Poulet riz citron", "Poulet champignons riz", "Poulet tomate riz", "Poulet economique pommes de terre", "Poulet salade composee",
    ],
  },
  {
    category: "Viande",
    categorySlug: "viande",
    titles: [
      "Kefta sauce tomate", "Burger maison", "Steak frites", "Boeuf oignons", "Boeuf carottes", "Boeuf pommes de terre", "Brochettes de boeuf", "Merguez de boeuf legumes", "Kefta oeufs tomate", "Viande hachee riz",
      "Boulettes boeuf tomate", "Boeuf courgettes", "Steak salade", "Boeuf haricots verts", "Viande hachee pates", "Kefta pommes de terre", "Boeuf pois chiches", "Boeuf tomate oignons", "Boeuf legumes", "Boeuf sauce soja",
      "Kefta sandwich", "Boeuf riz legumes", "Steak fromage", "Viande hachee gratin", "Boeuf lentilles", "Boeuf poivrons", "Boeuf carotte pomme de terre", "Boulettes viande legumes", "Boeuf economique riz", "Kefta courgettes tomate",
    ],
  },
  {
    category: "Poisson",
    categorySlug: "poisson",
    titles: [
      "Poisson au four legumes", "Poisson frit salade", "Filet poisson riz", "Sardines tomate", "Sardines grillees", "Poisson citron pommes de terre", "Poisson courgettes", "Poisson tomate oignons", "Poisson vapeur legumes", "Poisson sauce tomate",
      "Saumon riz legumes", "Saumon teriyaki", "Crevettes ail citron", "Crevettes riz", "Crevettes tomate", "Poisson pommes de terre olives", "Poisson carottes courgettes", "Poisson legumes economique", "Filet poisson salade", "Poisson riz tomate",
      "Sardines boulettes tomate", "Poisson poivrons", "Poisson oignons citron", "Crevettes legumes", "Saumon salade",
    ],
  },
  {
    category: "salade",
    categorySlug: "salade",
    titles: [
      "Salade marocaine", "Salade thon riz", "Salade composee", "Salade poulet", "Salade oeuf tomate", "Salade fromage tomate", "Salade legumes", "Salade riz mais", "Salade pates thon", "Salade pommes de terre",
      "Salade carottes orange", "Salade concombre tomate", "Salade poulet riz", "Salade thon haricots", "Salade betterave", "Salade lentilles", "Salade pois chiches", "Salade sardines tomate", "Salade avocat thon", "Salade fromage oeuf",
      "Salade courgettes grillees", "Salade carotte pomme", "Salade riz crevettes", "Salade tomate oignon", "Salade poulet mais", "Salade concombre fromage", "Salade pates poulet", "Salade economique oeuf", "Salade legumes vapeur", "Salade rapide thon",
    ],
  },
  {
    category: "Recette rapide",
    categorySlug: "rapide",
    titles: [
      "Omelette fromage", "Sandwich thon", "Croque monsieur", "Pates express", "Riz oeuf", "Tortilla pomme de terre", "Toast fromage", "Sandwich poulet", "Omelette tomate", "Wrap thon",
      "Quesadilla fromage", "Riz thon mais", "Salade rapide poulet", "Pain perdu sale", "Oeufs tomate", "Pates fromage rapide", "Sandwich kefta", "Toast oeuf fromage", "Riz legumes rapide", "Soupe rapide legumes",
      "Bruschetta tomate", "Croque thon", "Omelette courgette", "Sandwich fromage tomate", "Wrap poulet legumes", "Pomme de terre farcie", "Riz poulet minute", "Pates thon rapide", "Salade oeuf rapide", "Tartine avocat oeuf",
    ],
  },
  {
    category: "Recette bebe",
    categorySlug: "bebe",
    baseServings: 3,
    baby: true,
    titles: [
      "Compote pomme banane", "Compote pomme poire", "Compote pomme seule", "Compote poire seule", "Compote banane", "Compote peche", "Puree carotte", "Puree courgette", "Puree pomme de terre", "Puree patate douce",
      "Puree potiron", "Puree petits pois", "Puree haricots verts", "Puree brocoli", "Puree poulet carotte", "Puree poulet courgette", "Puree riz legumes", "Puree poisson legumes", "Puree pomme banane poire", "Puree carotte pomme de terre",
      "Puree courgette pomme de terre", "Puree poulet riz", "Puree poisson carotte", "Compote pomme peche", "Compote poire banane", "Puree legumes doux", "Puree carotte riz", "Puree brocoli pomme de terre", "Puree poulet petits pois", "Puree poisson courgette",
      "Compote pomme orange douce", "Puree patate douce carotte", "Puree potiron pomme de terre", "Puree riz carotte", "Puree banane pomme",
    ],
  },
  {
    category: "Pizza",
    categorySlug: "pizza",
    titles: [
      "Pizza margherita", "Pizza thon fromage", "Pizza poulet champignons", "Pizza viande hachee", "Pizza legumes", "Pizza fromage", "Pizza tomate olives", "Pizza poulet barbecue", "Pizza boeuf oignons", "Pizza thon mais",
      "Pizza quatre fromages", "Pizza saumon creme", "Pizza crevettes", "Pizza kefta", "Pizza courgettes fromage", "Pizza poivrons", "Pizza champignons fromage", "Pizza poulet curry", "Pizza sardines tomate", "Pizza economique fromage",
    ],
  },
  {
    category: "Jus",
    categorySlug: "jus",
    titles: [
      "Jus orange", "Jus pomme banane", "Jus carotte orange", "Jus citron menthe", "Jus pomme", "Jus banane lait", "Jus avocat lait", "Jus poire pomme", "Jus peche orange", "Jus concombre citron",
      "Jus betterave pomme", "Jus carotte pomme", "Jus orange banane", "Jus citron gingembre", "Jus pomme citron", "Jus fruits rouges", "Jus ananas orange", "Jus melon", "Jus pasteque", "Jus pomme poire",
    ],
  },
  {
    category: "Asiatique",
    categorySlug: "asiatique",
    titles: [
      "Riz cantonais", "Nouilles sautees poulet", "Nouilles sautees boeuf", "Nouilles legumes", "Poulet aigre douce", "Poulet teriyaki", "Poulet yakitori", "Poulet curry japonais", "Riz poulet curry", "Riz legumes soja",
      "Riz crevettes", "Crevettes ail gingembre", "Crevettes sauce soja", "Saumon teriyaki", "Saumon riz legumes", "Soupe miso", "Soupe nouilles poulet", "Soupe ramen boeuf", "Soupe ramen poulet", "Wok legumes",
      "Wok poulet legumes", "Wok boeuf legumes", "Boeuf sauce soja", "Boeuf oignons", "Boeuf gingembre", "Dumplings poulet", "Gyoza legumes", "Nems poulet", "Nems legumes", "Riz frit asiatique",
    ],
  },
];

function expandedTitles(seed: CategorySeed) {
  const titles = new Set(seed.titles);
  const styles = [...(categoryStyles[seed.categorySlug] ?? []), ...globalStyles];

  for (const title of seed.titles) {
    for (const style of styles) {
      if (titles.size >= targetPerCategory) {
        return Array.from(titles);
      }

      const normalizedTitle = normalizeRecipeName(title);
      const normalizedStyle = normalizeRecipeName(style);
      if (!normalizedTitle.includes(normalizedStyle)) {
        titles.add(`${title} ${style}`);
      }
    }
  }

  for (const style of styles) {
    for (const secondStyle of styles) {
      if (titles.size >= targetPerCategory) {
        return Array.from(titles);
      }

      if (style !== secondStyle) {
        titles.add(`${seed.category} ${style} ${secondStyle}`);
      }
    }
  }

  return Array.from(titles);
}

export const seedRecipes = seeds.flatMap((seed) => expandedTitles(seed).map((title) => buildRecipe(title, seed)));

export function generateRecipeVariants(recipe: Recipe, availableIngredients: string[] = []): RecipeVariant[] {
  const available = availableIngredients.slice(0, 4);
  return [
    { label: "economique", title: `${recipe.title} economique`, tags: ["petit-budget"] },
    { label: "rapide", title: `${recipe.title} rapide`, tags: ["moins-30-min"] },
    { label: "bebe", title: `${recipe.title} version bebe`, tags: ["bebe"] },
    { label: "sans viande", title: `${recipe.title} sans viande`, tags: ["sans-viande"] },
    { label: "plus proteine", title: `${recipe.title} plus proteine`, tags: ["proteine"] },
    { label: "avec riz", title: `${recipe.title} avec riz`, tags: ["riz"] },
    { label: "avec pates", title: `${recipe.title} avec pates`, tags: ["pates"] },
    ...available.map((item) => ({ label: `avec ${item}`, title: `${recipe.title} avec ${item}`, tags: ["disponible"] })),
  ];
}

export function recipeCounts() {
  return seedRecipes.reduce<Record<string, number>>((counts, recipe) => {
    counts[recipe.categorySlug] = (counts[recipe.categorySlug] ?? 0) + 1;
    return counts;
  }, {});
}
