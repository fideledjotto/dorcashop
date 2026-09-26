(function () {
  "use strict";

  const STORAGE_KEY = "dorcashop_products_v1";
  const DELETED_PRODUCTS_KEY = "dorcashop_deleted_products_v1";
  const ADMIN_SESSION_KEY = "dorcashop_admin_session_v1";
  const CATALOG_CHANGED_KEY = "dorcashop_catalog_changed_v1";
  const DEMO_ADMIN = { username: "admin", password: "admin0" };

  function safeLocalStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // silent on browser privacy restrictions
    }
  }

  function safeLocalStorageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // silent on browser privacy restrictions
    }
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `produit-${Date.now()}`;
  }

  function normalizeProduct(product, fallbackId = null) {
    const name = String(product && product.name ? product.name : "Produit");
    const category = String(product && product.category ? product.category : "fournitures");
    const cats = Array.isArray(product && product.cats)
      ? product.cats.map((cat) => String(cat).trim()).filter(Boolean)
      : [category];

    return {
      id: String(product && product.id ? product.id : fallbackId || slugify(name)),
      name,
      cats: cats.length ? cats : [category],
      category: category,
      img: product && product.img ? product.img : "",
      desc: product && product.desc ? product.desc : "",
      price: product && product.price ? product.price : "0 F",
      oldPrice: product && product.oldPrice ? product.oldPrice : "",
      priceNote: product && product.priceNote ? product.priceNote : "",
      priceGros: product && product.priceGros ? product.priceGros : "",
      badge: product && product.badge ? product.badge : "",
      details: product && product.details ? product.details : null,
      icon: product && product.icon ? product.icon : "",
      createdAt: product && product.createdAt ? Number(product.createdAt) : 0
    };
  }

  function getDefaultProducts() {
    if (!Array.isArray(PRODUCTS)) {
      return [];
    }

    return PRODUCTS.map((product, index) => normalizeProduct(product, `default-${index}`));
  }

  function getStoredProducts() {
    const raw = safeLocalStorageGet(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((product) => normalizeProduct(product)) : [];
    } catch (error) {
      return [];
    }
  }

  function notifyCatalogChanged() {
    const timestamp = String(Date.now());
    safeLocalStorageSet(CATALOG_CHANGED_KEY, timestamp);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dorcashop:catalog-updated", { detail: { timestamp } }));
    }
  }

  function saveStoredProducts(products) {
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(products.map((product) => normalizeProduct(product))));
    notifyCatalogChanged();
  }

  function getDeletedProductIds() {
    const raw = safeLocalStorageGet(DELETED_PRODUCTS_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (error) {
      return [];
    }
  }

  function saveDeletedProductIds(ids) {
    safeLocalStorageSet(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
  }

  function resolveCatalogProducts() {
    const deletedIds = new Set(getDeletedProductIds());
    const defaults = getDefaultProducts().filter((product) => !deletedIds.has(String(product.id)));
    const stored = getStoredProducts().filter((product) => !deletedIds.has(String(product.id)));
    const byId = new Map();

    defaults.forEach((product) => {
      if (!product || !product.id) {
        return;
      }
      byId.set(String(product.id), normalizeProduct(product));
    });

    stored.forEach((product) => {
      if (!product || !product.id) {
        return;
      }
      byId.set(String(product.id), normalizeProduct(product));
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = Number(a.createdAt || 0);
      const bTime = Number(b.createdAt || 0);
      return bTime - aTime;
    });
  }

  function isRecentProduct(product, days = 30) {
    const createdAt = Number(product && product.createdAt ? product.createdAt : 0);
    if (!createdAt) {
      return false;
    }
    return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
  }

  function ensureProductId(product, fallback) {
    const item = normalizeProduct(product, fallback);
    item.id = item.id || slugify(item.name || fallback || "produit");
    return item;
  }

  function createProduct(input) {
    const createdAt = Date.now();
    const clean = ensureProductId({
      ...(input || {}),
      createdAt,
      badge: input && input.badge ? input.badge : "NOUVEAU"
    }, `custom-${createdAt}`);
    const stored = getStoredProducts();
    stored.push(clean);
    saveStoredProducts(stored);
    return clean;
  }

  function updateProduct(id, updates) {
    const current = resolveCatalogProducts().find((product) => String(product.id) === String(id));
    const stored = getStoredProducts();
    const next = normalizeProduct({ ...(current || {}), ...updates, id }, id);
    const index = stored.findIndex((product) => String(product.id) === String(id));

    if (index === -1) {
      stored.push(next);
    } else {
      stored[index] = next;
    }

    saveStoredProducts(stored);
    return next;
  }

  function deleteProduct(id) {
    const deletedIds = getDeletedProductIds();
    if (!deletedIds.includes(String(id))) {
      deletedIds.push(String(id));
      saveDeletedProductIds(deletedIds);
    }

    const stored = getStoredProducts().filter((product) => String(product.id) !== String(id));
    saveStoredProducts(stored);
    return true;
  }

  function loginAdmin(username, password) {
    const user = String(username || "").trim();
    const pass = String(password || "");
    const success = user === DEMO_ADMIN.username && pass === DEMO_ADMIN.password;

    if (success) {
      safeLocalStorageSet(ADMIN_SESSION_KEY, "authenticated");
      return true;
    }

    safeLocalStorageRemove(ADMIN_SESSION_KEY);
    return false;
  }

  function logoutAdmin() {
    safeLocalStorageRemove(ADMIN_SESSION_KEY);
  }

  function isAdminAuthenticated() {
    return safeLocalStorageGet(ADMIN_SESSION_KEY) === "authenticated";
  }

  function buildProductCardMarkup(product, options = {}) {
    const p = normalizeProduct(product);
    const barColor = {
      fournitures: "#E6007E",
      etudiants: "#FF6A00",
      enfants: "#14A56B",
      maison: "#142343",
      gros: "#FFD400"
    }[p.cats[0]] || "#142343";

    const badgeLabel = p.badge || (isRecentProduct(p) ? "NOUVEAU" : "");
    const badge = badgeLabel ? `<span class="card-badge badge-${badgeLabel.replace(/\s+/g, "")}">${badgeLabel}</span>` : "";
    const detailsBtn = p.details ? `<button type="button" class="details-btn" data-id="${p.id}" aria-label="Voir les tarifs détaillés de ${p.name}">+</button>` : "";
    const media = p.img
      ? `<img src="${p.img}" alt="${p.name}" loading="lazy">`
      : `<svg viewBox="0 0 48 48" fill="none" stroke="#142343" stroke-width="2"><rect x="9" y="6" width="30" height="36" rx="2"/><path d="M15 16h18M15 23h18M15 30h11" stroke-linecap="round"/><path d="M31 30l4 4-2 5-5-2 3-7z" fill="#FFD400" stroke="#142343"/></svg>`;
    const oldPriceMarkup = p.oldPrice ? `<div class="card-old-price">${p.oldPrice}</div>` : "";
    const gros = p.priceGros ? `<div class="card-gros">Gros : ${p.priceGros}</div>` : "";
    const actions = options && options.showActions ? `
      <div class="admin-product-actions">
        <button type="button" class="mini-btn mini-btn-edit" data-action="edit" data-id="${p.id}">Modifier</button>
        <button type="button" class="mini-btn mini-btn-delete" data-action="delete" data-id="${p.id}">Supprimer</button>
      </div>
    ` : "";

    return `
      <article class="product-card" data-id="${p.id}" data-cats="${p.cats.join(" ")}" data-name="${p.name.toLowerCase()}">
        <div class="card-cat-bar" style="background:${barColor}"></div>
        <div class="card-media">
          ${badge}
          ${detailsBtn}
          ${media}
        </div>
        <div class="card-body">
          <h4>${p.name}</h4>
          <p class="card-desc">${p.desc || "Produit de la boutique DORCASHOP."}</p>
          <div class="card-price-row">
            <div>
              ${oldPriceMarkup}
              <span class="card-price">${p.price}</span>
              <small>${p.priceNote || ""}</small>
            </div>
          </div>
          ${gros}
          ${options && options.hideOrderButton ? "" : `<button type="button" class="card-order-btn" data-id="${p.id}">Commander</button>`}
          ${actions}
        </div>
      </article>
    `;
  }

  window.DORCASHOPStore = {
    STORAGE_KEY,
    ADMIN_SESSION_KEY,
    DEMO_ADMIN,
    normalizeProduct,
    resolveCatalogProducts,
    getCatalogProducts: resolveCatalogProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    loginAdmin,
    logoutAdmin,
    isAdminAuthenticated,
    isRecentProduct,
    buildProductCardMarkup
  };
})();
