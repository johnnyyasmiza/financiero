"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addExpense, deleteExpense } from "@/lib/finance-db";
import { isOnline } from "@/lib/offline-store";
import { detectProductUnit } from "@/lib/products/detect-product-unit";
import { ensureProductExists } from "@/lib/products/ensure-product";
import { addNeeds, getProducts, subscribeToProducts, type ShoppingProduct } from "@/lib/shopping-catalog";
import { formatCaissePrice } from "@/lib/caisse-config";
import { getTodayDate } from "@/lib/utils";
import { upsertPurchasedFridgeItems } from "@/lib/fridge";
import { normalizeUnit as normalizeSupportedUnit } from "@/lib/units";

export type CaisseCartItem = {
  product: ShoppingProduct;
  quantity: number;
};

type CaisseCartContextValue = {
  products: ShoppingProduct[];
  isLoadingProducts: boolean;
  cart: CaisseCartItem[];
  total: number;
  itemCount: number;
  error: string;
  success: string;
  isSaving: boolean;
  clearMessages: () => void;
  addToCart: (product: ShoppingProduct, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  validateNow: () => Promise<void>;
  saveForLater: () => Promise<void>;
  reloadProducts: () => void;
};

const CaisseCartContext = createContext<CaisseCartContextValue | null>(null);
export const CART_STORAGE_KEY = "financiero-caisse-cart";

function lineTotal(item: CaisseCartItem) {
  return (item.product.price ?? 0) * item.quantity;
}

function getCartStore(cart: CaisseCartItem[]) {
  const stores = Array.from(new Set(cart.map((item) => item.product.store).filter(Boolean)));
  return stores.length === 1 ? stores[0] : "Courses";
}

function buildCartNote(cart: CaisseCartItem[]) {
  return cart
    .map((item) => `${item.product.name} - ${item.quantity} x ${item.product.unit} - ${formatCaissePrice(item.product.price)} = ${lineTotal(item).toFixed(2)} DH`)
    .join("\n");
}

function readStoredCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CaisseCartItem[];
  } catch {
    return [];
  }
}

export function CaisseCartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [cart, setCart] = useState<CaisseCartItem[]>(readStoredCart);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reloadProducts = useCallback(() => {
    getProducts()
      .then((nextProducts) => {
        setProducts(nextProducts);
        setError("");
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les produits."))
      .finally(() => setIsLoadingProducts(false));
  }, []);

  useEffect(() => {
    reloadProducts();
    return subscribeToProducts(reloadProducts);
  }, [reloadProducts]);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + lineTotal(item), 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function addToCart(product: ShoppingProduct, quantity = 1) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);

      if (existing) {
        return current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
      }

      return [...current, { product, quantity }];
    });
    setSuccess(`${product.name} ajoute au panier.`);
    setError("");
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.product.id === productId ? { ...item, quantity: Math.max(item.quantity + delta, 0) } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }

  const validateNow = useCallback(async () => {
    if (cart.length === 0) {
      setError("Panier vide");
      return;
    }

    if (!isOnline()) {
      setError("Connexion requise pour valider le panier sans risque de demi-validation.");
      return;
    }

    const cartSnapshot = cart.filter((item) => item.quantity > 0);
    const cartTotal = cartSnapshot.reduce((sum, item) => sum + lineTotal(item), 0);
    const today = getTodayDate();
    let createdExpenseId: string | null = null;

    console.log("VALIDATE_CART_START", { itemCount: cartSnapshot.length, total: cartTotal });
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const expense = await addExpense({
        amount: cartTotal,
        merchant: getCartStore(cartSnapshot),
        category: "Courses",
        payment: "Carte",
        note: `source: caisse\n${buildCartNote(cartSnapshot)}`,
        sourceType: "caisse",
        date: today,
      });
      createdExpenseId = expense.id;
      console.log("EXPENSE_CREATED", { id: expense.id, amount: expense.amount });

      try {
        const fridgePayload = await Promise.all(
          cartSnapshot.map(async (item) => {
            const productId = await ensureProductExists({
              id: item.product.id,
              productId: item.product.id,
              store: item.product.store,
              category: item.product.category,
              name: item.product.name,
              imageUrl: item.product.imageUrl,
              price: item.product.price,
              unit: item.product.unit,
              unitQuantity: item.product.unitQuantity,
              unitBase: item.product.unitBase,
              pricePerBaseUnit: item.product.pricePerBaseUnit,
              sourceUrl: item.product.sourceUrl,
            });

            if (!productId) {
              throw new Error(`Produit impossible a creer dans products : ${item.product.name}`);
            }

            console.log("PRODUCT_ENSURED", { productId, name: item.product.name });
            const detected = detectProductUnit(item.product.name);
            const unit = detected?.unit ?? normalizeSupportedUnit(item.product.unitBase ?? item.product.unit);
            const quantityPerCartUnit = detected?.quantity ?? (item.product.unitQuantity && item.product.unitQuantity > 0 ? item.product.unitQuantity : 1);
            const purchasedQuantity = item.quantity * quantityPerCartUnit;

            return {
              productId,
              store: item.product.store,
              category: item.product.category,
              name: item.product.name,
              imageUrl: item.product.imageUrl,
              quantity: purchasedQuantity,
              unit,
              unitQuantity: 1,
              totalQuantity: purchasedQuantity,
              initialQuantity: purchasedQuantity,
              remainingQuantity: purchasedQuantity,
              lowStockThreshold: 20,
              purchasePrice: lineTotal(item),
              purchaseDate: today,
              status: "en_stock",
            };
          }),
        );
        await upsertPurchasedFridgeItems(fridgePayload);
      } catch (stockError) {
        if (createdExpenseId && !createdExpenseId.startsWith("offline-")) {
          await deleteExpense(createdExpenseId);
        }
        throw stockError;
      }

      setCart([]);
      console.log("CART_CLEARED");
      setSuccess("Courses validées : dépense créée et stock ajouté au frigo.");
      console.log("VALIDATE_CART_SUCCESS", { expenseId: expense.id, itemCount: cartSnapshot.length });
      reloadProducts();
      router.refresh();
    } catch (saveError) {
      console.error("VALIDATE_CART_ERROR", saveError);
      setError(saveError instanceof Error ? saveError.message : "Impossible de valider les courses.");
    } finally {
      setIsSaving(false);
    }
  }, [cart, reloadProducts, router]);

  const saveForLater = useCallback(async () => {
    if (cart.length === 0) {
      setError("Ajoutez au moins un produit au panier.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await addNeeds(
        cart.map((item) => ({
          productId: item.product.id,
          store: item.product.store,
          category: item.product.category,
          name: item.product.name,
          imageUrl: item.product.imageUrl,
          unit: item.product.unit,
          quantity: item.quantity,
          unitPrice: item.product.price ?? null,
          total: lineTotal(item),
        })),
      );

      setCart([]);
      setSuccess("Produits ajoutes aux besoins.");
      router.push("/besoins?added=1");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'ajouter les produits aux besoins.");
    } finally {
      setIsSaving(false);
    }
  }, [cart, router]);

  const value = useMemo(
    () => ({
      products,
      isLoadingProducts,
      cart,
      total,
      itemCount,
      error,
      success,
      isSaving,
      clearMessages,
      addToCart,
      updateQuantity,
      removeFromCart,
      validateNow,
      saveForLater,
      reloadProducts,
    }),
    [cart, error, isLoadingProducts, isSaving, itemCount, products, reloadProducts, saveForLater, success, total, validateNow],
  );

  return <CaisseCartContext.Provider value={value}>{children}</CaisseCartContext.Provider>;
}

export function useCaisseCart() {
  const context = useContext(CaisseCartContext);

  if (!context) {
    throw new Error("useCaisseCart doit etre utilise dans CaisseCartProvider.");
  }

  return context;
}
