export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_URL = "https://www.marjane.ma/courses-en-ligne/11-marche";
const MAX_PRODUCTS = 20;

type AuditProduct = {
  name: string;
  price: number | null;
  image: string | null;
  url: string | null;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(decodeHtml(value), TARGET_URL).toString();
  } catch {
    return null;
  }
}

function parsePrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.replace(/\s+/g, " ").match(/(\d+(?:[.,]\d{1,2})?)\s*(?:dh|mad|dhs|د\.?م)?/i);

  if (!match) {
    return null;
  }

  const price = Number(match[1].replace(",", "."));
  return Number.isFinite(price) ? price : null;
}

function uniqueProducts(products: AuditProduct[]) {
  const seen = new Set<string>();

  return products.filter((product) => {
    const key = `${product.name}|${product.url}|${product.price}`;

    if (!product.name || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function productFromUnknown(value: unknown): AuditProduct | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const looksLikeProduct =
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product")) ||
    (typeof record.name === "string" && ("price" in record || "offers" in record || "image" in record));

  if (!looksLikeProduct || typeof record.name !== "string") {
    return null;
  }

  const offers = record.offers && typeof record.offers === "object" ? (Array.isArray(record.offers) ? record.offers[0] : record.offers) : null;
  const offerRecord = offers && typeof offers === "object" ? (offers as Record<string, unknown>) : {};
  const rawImage = Array.isArray(record.image) ? record.image[0] : record.image;
  const rawUrl = record.url ?? offerRecord.url;
  const rawPrice = record.price ?? offerRecord.price ?? offerRecord.lowPrice;

  return {
    name: stripTags(record.name),
    price: parsePrice(rawPrice),
    image: typeof rawImage === "string" ? absoluteUrl(rawImage) : null,
    url: typeof rawUrl === "string" ? absoluteUrl(rawUrl) : null,
  };
}

function walkForProducts(value: unknown, products: AuditProduct[], depth = 0) {
  if (products.length >= MAX_PRODUCTS || depth > 12 || !value) {
    return;
  }

  const product = productFromUnknown(value);

  if (product) {
    products.push(product);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkForProducts(item, products, depth + 1));
    return;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => walkForProducts(item, products, depth + 1));
  }
}

function extractJsonProducts(html: string) {
  const products: AuditProduct[] = [];
  const jsonScripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const script of jsonScripts) {
    try {
      walkForProducts(JSON.parse(decodeHtml(script[1])), products);
    } catch {
      // Ignore malformed structured data and continue with other extraction methods.
    }
  }

  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);

  if (nextData) {
    try {
      walkForProducts(JSON.parse(decodeHtml(nextData[1])), products);
    } catch {
      // Ignore malformed hydration data.
    }
  }

  return uniqueProducts(products).slice(0, MAX_PRODUCTS);
}

function extractHtmlProducts(html: string) {
  const products: AuditProduct[] = [];
  const blocks = html.match(/<(?:article|li|div|a)\b[^>]*(?:product|item|card|price)[^>]*>[\s\S]{0,5000}?<\/(?:article|li|div|a)>/gi) ?? [];

  for (const block of blocks) {
    if (products.length >= MAX_PRODUCTS || !/(?:dh|mad|dhs|د\.?م)/i.test(block)) {
      continue;
    }

    const link = block.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
    const image = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1] ?? null;
    const text = stripTags(block);
    const price = parsePrice(text);
    const name = text
      .replace(/(\d+(?:[.,]\d{1,2})?)\s*(?:dh|mad|dhs|د\.?م).*/i, "")
      .replace(/\b(ajouter|promo|prix|acheter)\b/gi, "")
      .trim();

    if (name && price !== null) {
      products.push({
        name,
        price,
        image: absoluteUrl(image),
        url: absoluteUrl(link),
      });
    }
  }

  return uniqueProducts(products).slice(0, MAX_PRODUCTS);
}

function extractApiCandidates(html: string) {
  const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => absoluteUrl(match[1]))
    .filter((value): value is string => Boolean(value));
  const urlCandidates = [...html.matchAll(/["']([^"']*(?:api|graphql|product|catalog|search|_next\/data)[^"']*)["']/gi)]
    .map((match) => absoluteUrl(match[1]))
    .filter((value): value is string => Boolean(value));

  return {
    scriptSources: Array.from(new Set(scriptSources)).slice(0, 30),
    apiCandidates: Array.from(new Set(urlCandidates)).slice(0, 40),
    detectedFrameworks: {
      nextData: /id=["']__NEXT_DATA__["']/i.test(html),
      nuxtData: /__NUXT__|__nuxt/i.test(html),
      reactRoot: /id=["']root["']|data-reactroot/i.test(html),
      hydrationJson: /window\.__|__APOLLO_STATE__|__INITIAL_STATE__|dataLayer/i.test(html),
    },
  };
}

function getNoProductDiagnostics(html: string, status: number) {
  const diagnostics = extractApiCandidates(html);
  const cloudflareBlocked = status === 403 && /cloudflare|cf-ray|just a moment|attention required/i.test(html);

  if (cloudflareBlocked) {
    return {
      productsRenderedInHtml: false,
      fetchBlocked: true,
      reason:
        "La requête serveur reçoit HTTP 403 avec une page Cloudflare/anti-bot au lieu du HTML catalogue. Les produits ne sont donc pas présents dans la réponse, et les appels API du catalogue ne sont pas identifiables depuis ce HTML bloqué.",
      ...diagnostics,
    };
  }

  if (status >= 400) {
    return {
      productsRenderedInHtml: false,
      fetchBlocked: true,
      reason: `La page répond HTTP ${status}. Les produits ne sont pas récupérables tant que la requête ne reçoit pas le vrai HTML catalogue.`,
      ...diagnostics,
    };
  }

  return {
    productsRenderedInHtml: false,
    fetchBlocked: false,
    reason:
      "Aucun produit exploitable n'a été trouvé dans le HTML initial. Le site semble probablement charger le catalogue après le rendu initial via JavaScript ou via des endpoints API.",
    ...diagnostics,
  };
}

export async function GET() {
  try {
    const response = await fetch(TARGET_URL, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      },
    });
    const html = await response.text();
    const products = uniqueProducts([...extractJsonProducts(html), ...extractHtmlProducts(html)]).slice(0, MAX_PRODUCTS);
    const productsRenderedInHtml = products.length > 0;

    return Response.json({
      success: true,
      sourceUrl: TARGET_URL,
      status: response.status,
      totalProducts: products.length,
      products,
      diagnostics: productsRenderedInHtml
        ? {
            productsRenderedInHtml,
          }
        : getNoProductDiagnostics(html, response.status),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        sourceUrl: TARGET_URL,
        totalProducts: 0,
        products: [],
        error: error instanceof Error ? error.message : "Erreur inconnue pendant l'audit Marjane.",
      },
      { status: 500 },
    );
  }
}
