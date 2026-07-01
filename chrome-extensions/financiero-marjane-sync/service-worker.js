const MARJANE_TAB_PATTERNS = ["https://www.marjane.ma/*", "https://api-ayaline.marjane.ma/*"];

async function queryTabs(queryInfo) {
  return chrome.tabs.query(queryInfo);
}

async function findMarjaneTab() {
  for (const url of MARJANE_TAB_PATTERNS) {
    const tabs = await queryTabs({ url });
    const match = tabs.find((tab) => tab.id !== undefined);
    if (match) {
      return match;
    }
  }

  return null;
}

function collectMarjaneShoppingList() {
  const API_BASE = "https://api-ayaline.marjane.ma";

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return value.data || value.items || value.results || value.products || value["hydra:member"] || [];
    }
    return [];
  }

  function readStorageText(storage) {
    try {
      return Object.keys(storage)
        .map((key) => `${key} ${storage.getItem(key) || ""}`)
        .join(" ");
    } catch {
      return "";
    }
  }

  function findCustomerId() {
    const text = `${readStorageText(window.localStorage)} ${readStorageText(window.sessionStorage)}`;
    const match =
      text.match(/customer[_-]?id["'\s:=]+(\d{2,})/i) ||
      text.match(/customer["'\s:=]+(\d{2,})/i) ||
      text.match(/"id"\s*:\s*(\d{2,})\s*,\s*"[^"]*customer/i);
    return match?.[1] || null;
  }

  async function readJson(url) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${url}`);
    }

    return response.json();
  }

  async function firstWorkingJson(urls) {
    const errors = [];

    for (const url of urls) {
      try {
        return { url, json: await readJson(url) };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(errors.join(" | ") || "API Marjane indisponible.");
  }

  function listId(list) {
    return list?.id || list?.uuid || list?.shopping_list_id || list?.shoppingListId || null;
  }

  return (async () => {
    if (!location.hostname.includes("marjane.ma")) {
      throw new Error("Ouvrez un onglet Marjane connecte, puis relancez la recuperation.");
    }

    const customerId = findCustomerId();
    const listUrls = [
      customerId ? `${API_BASE}/customers/shopping-list?customer=${encodeURIComponent(customerId)}` : null,
      `${API_BASE}/customers/shopping-list`,
    ].filter(Boolean);
    const listResult = await firstWorkingJson(listUrls);
    const lists = asArray(listResult.json);

    if (lists.length === 0) {
      throw new Error("Aucune liste Marjane trouvee. Verifiez que vous etes connecte a Marjane.");
    }

    let selectedList = lists.find((list) => list?.selected || list?.is_selected || list?.isDefault || list?.default) || lists[0];
    let selectedListId = listId(selectedList);

    if (!selectedListId) {
      throw new Error("Liste Marjane trouvee, mais identifiant de liste introuvable.");
    }

    let productsResult = null;
    let products = [];

    for (const list of [selectedList, ...lists.filter((candidate) => candidate !== selectedList)]) {
      selectedList = list;
      selectedListId = listId(list);

      if (!selectedListId) {
        continue;
      }

      try {
        productsResult = await firstWorkingJson([
          `${API_BASE}/customers/shopping-list/${encodeURIComponent(selectedListId)}/products`,
          `${API_BASE}/customers/shopping-list/${encodeURIComponent(selectedListId)}/items`,
        ]);
        products = asArray(productsResult.json);

        if (products.length > 0) {
          break;
        }
      } catch {
        products = [];
      }
    }

    if (products.length === 0) {
      throw new Error("Liste Marjane recuperee, mais aucun produit trouve.");
    }

    return {
      customerId,
      lists,
      selectedList,
      listSourceUrl: listResult.url,
      productsSourceUrl: productsResult?.url || null,
      products,
    };
  })();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FETCH_MARJANE_LIST") {
    return false;
  }

  findMarjaneTab()
    .then((tab) => {
      if (!tab?.id) {
        throw new Error("Installez l'extension puis ouvrez un onglet Marjane connecte avant de recuperer la liste.");
      }

      return chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: collectMarjaneShoppingList,
        world: "MAIN",
      });
    })
    .then((results) => {
      const payload = results?.[0]?.result;
      sendResponse({ ok: true, payload });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Erreur extension Marjane." });
    });

  return true;
});
