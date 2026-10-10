(function () {
  "use strict";

  const STORAGE_KEY = "dorcashop_products_v1";
  const DELETED_PRODUCTS_KEY = "dorcashop_deleted_products_v1";
  const TRASH_PRODUCTS_KEY = "dorcashop_trash_v1";
  const ADMIN_SESSION_KEY = "dorcashop_admin_session_v1";
  const CLIENT_SESSION_KEY = "dorcashop_client_session_v1";
  const CATALOG_CHANGED_KEY = "dorcashop_catalog_changed_v1";
  const DASHBOARD_METRICS_KEY = "dorcashop_dashboard_metrics_v1";
  const DASHBOARD_EVENTS_KEY = "dorcashop_dashboard_events_v1";
  const DEFAULT_DASHBOARD_METRICS = {
    visitors: 300,
    orders: 50,
    revenue: 100000,
    conversion: 1.7
  };
  const DEMO_ADMIN = { username: "admin", password: "admin0" };

  function apiUrl(path) {
    const basePath = new URL(".", document.baseURI).pathname.replace(/\/$/, "");
    return `${basePath}/api/${String(path).replace(/^\/+/, "")}`;
  }

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

  async function fetchJson(url, options = {}) {
    let response;
    let text;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
      text = await response.text();
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: { message: "Impossible de joindre le serveur API. Vérifiez le déploiement du backend." }
      };
    }

    let payload = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
        const detail = text.trim().replace(/\s+/g, " ").slice(0, 300);
        const responseDetail = detail ? ` Réponse du serveur : ${detail}` : "";
        const message = response.status === 404
          ? `Route API introuvable : le backend PHP n'est pas déployé sur cet hébergement (HTTP ${status}).${responseDetail}`
          : `Le serveur a renvoyé une réponse non JSON (HTTP ${status}).${responseDetail}`;
        return { ok: false, status: response.status, payload: { message } };
      }
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {
        ok: false,
        status: response.status,
        payload: { message: `Réponse API invalide (HTTP ${response.status}).` }
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload: { ...payload, message: payload.message || `Erreur API HTTP ${response.status}.` }
      };
    }

    return { ok: true, status: response.status, payload };
  }

  async function loadProductsFromServer() {
    if (typeof fetch !== "function") {
      return getStoredProducts();
    }

    const response = await fetchJson(apiUrl("products"));
    if (!response.ok || !Array.isArray(response.payload.products)) {
      return getStoredProducts();
    }

    const products = response.payload.products.map((product) => normalizeProduct(product));
    safeLocalStorageSet(STORAGE_KEY, JSON.stringify(products));
    notifyCatalogChanged();
    return products;
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

  function trackSiteVisit(visitorId) {
    return fetchJson(apiUrl("analytics/visit"), {
      method: "POST",
      body: JSON.stringify({ visitorId })
    });
  }

  function trackOrderIntent(visitorId, itemCount, amount) {
    return fetchJson(apiUrl("analytics/order-intent"), {
      method: "POST",
      body: JSON.stringify({ visitorId, itemCount, amount })
    });
  }

  function getAdminAnalytics() {
    return fetchJson(apiUrl("analytics"));
  }

  function getDashboardMetrics() {
    const raw = safeLocalStorageGet(DASHBOARD_METRICS_KEY);
    if (!raw) {
      const initial = { ...DEFAULT_DASHBOARD_METRICS };
      safeLocalStorageSet(DASHBOARD_METRICS_KEY, JSON.stringify(initial));
      return initial;
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_DASHBOARD_METRICS,
        ...(parsed || {})
      };
    } catch (error) {
      const initial = { ...DEFAULT_DASHBOARD_METRICS };
      safeLocalStorageSet(DASHBOARD_METRICS_KEY, JSON.stringify(initial));
      return initial;
    }
  }

  function saveDashboardMetrics(metrics) {
    const next = {
      ...DEFAULT_DASHBOARD_METRICS,
      ...(metrics || {})
    };

    next.visitors = Math.max(0, Number(next.visitors) || 0);
    next.orders = Math.max(0, Number(next.orders) || 0);
    next.revenue = Math.max(0, Number(next.revenue) || 0);
    next.conversion = Number(next.conversion) || 0;
    safeLocalStorageSet(DASHBOARD_METRICS_KEY, JSON.stringify(next));
  }

  function getDashboardEvents() {
    const raw = safeLocalStorageGet(DASHBOARD_EVENTS_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function recordDashboardEvent(type, delta = {}) {
    const metrics = getDashboardMetrics();
    const next = {
      visitors: Math.max(0, (Number(metrics.visitors) || 0) + (Number(delta.visitors) || 0)),
      orders: Math.max(0, (Number(metrics.orders) || 0) + (Number(delta.orders) || 0)),
      revenue: Math.max(0, (Number(metrics.revenue) || 0) + (Number(delta.revenue) || 0)),
      conversion: Number(delta.conversion) || 0
    };

    if (!next.conversion && next.visitors > 0) {
      next.conversion = (next.orders / next.visitors) * 100;
    }

    saveDashboardMetrics(next);

    const event = {
      type,
      timestamp: Date.now(),
      ...delta
    };

    const history = getDashboardEvents();
    history.push(event);
    if (history.length > 25) {
      history.splice(0, history.length - 25);
    }
    safeLocalStorageSet(DASHBOARD_EVENTS_KEY, JSON.stringify(history));

    return next;
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

  function getDeletedProductRecords() {
    const raw = safeLocalStorageGet(TRASH_PRODUCTS_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => item && (item.id || item.product)) : [];
    } catch (error) {
      return [];
    }
  }

  function saveDeletedProductIds(ids) {
    safeLocalStorageSet(DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
  }

  function saveDeletedProductRecords(records) {
    safeLocalStorageSet(TRASH_PRODUCTS_KEY, JSON.stringify(records.filter(Boolean)));
  }

  function resolveCatalogProducts() {
    const deletedIds = new Set([
      ...getDeletedProductIds(),
      ...getDeletedProductRecords().map((record) => String(record.id || record.product?.id || ""))
    ].filter(Boolean));
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

  async function createProduct(input) {
    const createdAt = Date.now();
    const clean = ensureProductId({
      ...(input || {}),
      createdAt,
      badge: input && input.badge ? input.badge : "NOUVEAU"
    }, `custom-${createdAt}`);

    if (typeof fetch !== "function") {
      throw new Error("La création de produits nécessite une connexion au serveur.");
    }

    const response = await fetchJson(apiUrl("products"), {
      method: "POST",
      body: JSON.stringify(clean)
    });
    if (!response.ok || !response.payload || !response.payload.product) {
      const status = response.status ? ` (HTTP ${response.status})` : "";
      throw new Error(`${response.payload.message || "Le produit n’a pas pu être enregistré."}${status}`);
    }

    const serverProduct = normalizeProduct(response.payload.product);
    const nextStored = getStoredProducts().filter((product) => String(product.id) !== String(serverProduct.id));
    nextStored.unshift(serverProduct);
    saveStoredProducts(nextStored);
    return serverProduct;
  }

  async function updateProduct(id, updates) {
    const current = resolveCatalogProducts().find((product) => String(product.id) === String(id));
    const next = normalizeProduct({ ...(current || {}), ...updates, id }, id);
    const stored = getStoredProducts();
    const index = stored.findIndex((product) => String(product.id) === String(id));

    if (index === -1) {
      stored.push(next);
    } else {
      stored[index] = next;
    }

    saveStoredProducts(stored);

    if (typeof fetch === "function") {
      try {
        const response = await fetchJson(apiUrl(`products/${encodeURIComponent(String(id))}`), {
          method: "PUT",
          body: JSON.stringify(next)
        });

        if (response.ok && response.payload && response.payload.product) {
          const serverProduct = normalizeProduct(response.payload.product);
          const nextStored = getStoredProducts().map((product) => String(product.id) === String(serverProduct.id) ? serverProduct : product);
          saveStoredProducts(nextStored);
          return serverProduct;
        }
      } catch (error) {
        // keep the local fallback when the backend is unavailable
      }
    }

    return next;
  }

  function getTrashProducts() {
    const records = getDeletedProductRecords();
    const deletedIds = new Set(getDeletedProductIds());
    const fallbackProducts = [...getDefaultProducts(), ...getStoredProducts()].filter((product) => {
      if (!product || !product.id) {
        return false;
      }
      return deletedIds.has(String(product.id));
    });

    const productsById = new Map();
    records.forEach((record) => {
      const product = record && record.product ? normalizeProduct(record.product) : null;
      if (product && product.id) {
        productsById.set(String(product.id), product);
      }
    });

    fallbackProducts.forEach((product) => {
      if (product && product.id && !productsById.has(String(product.id))) {
        productsById.set(String(product.id), normalizeProduct(product));
      }
    });

    return Array.from(productsById.values()).map((product) => {
      const record = records.find((item) => String((item && (item.id || item.product?.id)) || "") === String(product.id));
      return {
        ...product,
        deletedAt: record && record.deletedAt ? record.deletedAt : Date.now()
      };
    }).sort((a, b) => Number(b.deletedAt || 0) - Number(a.deletedAt || 0));
  }

  async function deleteProduct(id) {
    const product = resolveCatalogProducts().find((item) => String(item.id) === String(id))
      || [...getDefaultProducts(), ...getStoredProducts()].find((item) => String(item.id) === String(id));

    const deletedIds = getDeletedProductIds();
    if (!deletedIds.includes(String(id))) {
      deletedIds.push(String(id));
      saveDeletedProductIds(deletedIds);
    }

    const records = getDeletedProductRecords();
    const alreadyTrashed = records.some((record) => String(record.id || record.product?.id || "") === String(id));
    if (!alreadyTrashed) {
      records.push({
        id: String(id),
        product: product ? normalizeProduct(product) : null,
        deletedAt: Date.now()
      });
      saveDeletedProductRecords(records);
    }

    const stored = getStoredProducts().filter((productItem) => String(productItem.id) !== String(id));
    saveStoredProducts(stored);

    if (typeof fetch === "function") {
      try {
        await fetchJson(apiUrl(`products/${encodeURIComponent(String(id))}`), {
          method: "DELETE"
        });
      } catch (error) {
        // ignore backend delete failures and keep the local fallback
      }
    }

    return true;
  }

  function restoreDeletedProduct(id) {
    const records = getDeletedProductRecords().filter((record) => String(record.id || record.product?.id || "") !== String(id));
    saveDeletedProductRecords(records);

    const deletedIds = getDeletedProductIds().filter((deletedId) => String(deletedId) !== String(id));
    saveDeletedProductIds(deletedIds);

    const product = [...getDefaultProducts(), ...getStoredProducts(), ...records.map((record) => record.product).filter(Boolean)].find((item) => String(item.id) === String(id));
    if (product) {
      const stored = getStoredProducts();
      if (!stored.some((item) => String(item.id) === String(id))) {
        stored.push(normalizeProduct(product));
        saveStoredProducts(stored);
      }
    }

    return true;
  }

  function restoreAllDeletedProducts() {
    const ids = getDeletedProductIds();
    const records = getDeletedProductRecords();
    const allIds = Array.from(new Set([
      ...ids,
      ...records.map((record) => String(record.id || record.product?.id || ""))
    ].filter(Boolean)));

    const restored = [];
    const stored = getStoredProducts();
    allIds.forEach((id) => {
      const product = [...getDefaultProducts(), ...stored, ...records.map((record) => record.product).filter(Boolean)].find((item) => String(item.id) === String(id));
      if (product && !stored.some((item) => String(item.id) === String(id))) {
        stored.push(normalizeProduct(product));
        restored.push(id);
      }
    });

    saveStoredProducts(stored);
    saveDeletedProductIds([]);
    saveDeletedProductRecords([]);
    return { restored };
  }

  function clearTrash() {
    saveDeletedProductIds([]);
    saveDeletedProductRecords([]);
    return true;
  }

  function loginAdmin(username, password) {
    const user = String(username || "").trim();
    const pass = String(password || "");
    const success = user === DEMO_ADMIN.username && pass === DEMO_ADMIN.password;

    if (success) {
      safeLocalStorageSet(ADMIN_SESSION_KEY, "authenticated");
      safeLocalStorageRemove(CLIENT_SESSION_KEY);
      return true;
    }

    safeLocalStorageRemove(ADMIN_SESSION_KEY);
    return false;
  }

  async function loginAdminAsync(username, password) {
    const result = await authenticateAccount(username, password);
    return result.success && result.role === "admin";
  }

  function saveAccountSession(account) {
    if (account && account.role === "admin") {
      safeLocalStorageSet(ADMIN_SESSION_KEY, "authenticated");
      safeLocalStorageRemove(CLIENT_SESSION_KEY);
      return;
    }

    safeLocalStorageRemove(ADMIN_SESSION_KEY);
    safeLocalStorageSet(CLIENT_SESSION_KEY, JSON.stringify(account));
  }

  async function authenticateAccount(identifier, password) {
    const response = await fetchJson(apiUrl("login"), {
      method: "POST",
      body: JSON.stringify({ identifier: String(identifier || "").trim(), password: String(password || "") })
    });

    if (!response.ok || !response.payload.success) {
      return { success: false, message: response.payload.message || "Identifiants incorrects." };
    }

    saveAccountSession(response.payload.account);
    return response.payload;
  }

  async function registerAccount(input) {
    const response = await fetchJson(apiUrl("register"), {
      method: "POST",
      body: JSON.stringify(input || {})
    });

    if (response.ok && response.payload.success) {
      saveAccountSession(response.payload.account);
    }

    return response.payload;
  }

  async function getAccountSession() {
    const response = await fetchJson(apiUrl("session"));
    if (response.ok && response.payload.authenticated && response.payload.account) {
      saveAccountSession(response.payload.account);
      return response.payload;
    }

    safeLocalStorageRemove(ADMIN_SESSION_KEY);
    safeLocalStorageRemove(CLIENT_SESSION_KEY);
    return { authenticated: false, account: null };
  }

  function isAccountAuthenticated() {
    return isAdminAuthenticated() || Boolean(safeLocalStorageGet(CLIENT_SESSION_KEY));
  }

  async function logoutAccount() {
    const response = await fetchJson(apiUrl("logout"), { method: "POST" });
    if (!response.ok || !response.payload.success) {
      return false;
    }
    safeLocalStorageRemove(ADMIN_SESSION_KEY);
    safeLocalStorageRemove(CLIENT_SESSION_KEY);
    return true;
  }

  function logoutAdmin() {
    return logoutAccount();
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
          <h3>${p.name}</h3>
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
    getTrashProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreDeletedProduct,
    restoreAllDeletedProducts,
    clearTrash,
    loginAdmin,
    logoutAdmin,
    isAdminAuthenticated,
    authenticateAccount,
    registerAccount,
    getAccountSession,
    isAccountAuthenticated,
    logoutAccount,
    isRecentProduct,
    loadProductsFromServer,
    trackSiteVisit,
    trackOrderIntent,
    getAdminAnalytics,
    loginAdminAsync,
    buildProductCardMarkup,
    getDashboardMetrics,
    saveDashboardMetrics,
    recordDashboardEvent,
    getDashboardEvents
  };
})();
