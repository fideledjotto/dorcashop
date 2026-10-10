(function () {
  "use strict";

  const store = window.DORCASHOPStore;
  if (!store) {
    return;
  }

  const loginForm = document.getElementById("adminLoginForm");

  if (loginForm) {
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorBox = document.getElementById("loginError");
    const toggleButton = document.querySelector(".password-toggle");

    store.getAccountSession().then((session) => {
      if (!session.authenticated || !session.account) return;
      window.location.href = session.account.role === "admin" ? "administration.html" : "client.html";
    });

    toggleButton && toggleButton.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      toggleButton.setAttribute("aria-pressed", String(isPassword));
      toggleButton.setAttribute("aria-label", isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe");
      toggleButton.title = isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe";
    });

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorBox.hidden = false;
        errorBox.textContent = "Veuillez renseigner votre e-mail ou votre identifiant et votre mot de passe.";
        return;
      }

      const result = await store.authenticateAccount(username, password);
      if (result.success) {
        window.location.href = result.role === "admin" ? "administration.html" : "client.html";
        return;
      }
      errorBox.hidden = false;
      errorBox.textContent = result.message || "Identifiants incorrects.";
      passwordInput.value = "";
      passwordInput.focus();
    });
    return;
  }

  const adminPage = document.getElementById("adminProductForm");
  if (!adminPage) return;
  if (!store.isAdminAuthenticated()) {
    window.location.href = "admin-login.html";
    return;
  }

  store.getAccountSession().then((session) => {
    if (!session.authenticated || session.account?.role !== "admin") {
      window.location.href = "admin-login.html";
    }
  });

  const form = document.getElementById("adminProductForm");
  const productImageInput = document.getElementById("productImage");
  const productImagePreview = document.getElementById("productImagePreview");
  const globalMessage = document.getElementById("adminGlobalMessage");
  const existingProductsList = document.getElementById("existingProductsList");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const productCountBadge = document.getElementById("productCountBadge");
  const deletedProductCountBadge = document.getElementById("deletedProductCountBadge");
  const restoreAllTrashBtn = document.getElementById("restoreAllTrashBtn");
  const clearTrashBtn = document.getElementById("clearTrashBtn");
  const adminProductSearch = document.getElementById("adminProductSearch");
  const statTotalProducts = document.getElementById("statTotalProducts");
  const statCategoryCount = document.getElementById("statCategoryCount");
  const statRecentProducts = document.getElementById("statRecentProducts");
  const statBadgeProducts = document.getElementById("statBadgeProducts");
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutBtnMobile = document.getElementById("logoutBtnMobile");
  const adminMenuToggle = document.getElementById("adminMenuToggle");
  const adminMobileMenu = document.getElementById("adminMobileMenu");
  const confirmBackdrop = document.getElementById("adminConfirmBackdrop");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const adminTabs = Array.from(document.querySelectorAll("[data-admin-view]"));
  const adminPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));
  let activeAdminView = "addProduct";
  const doLogout = async () => {
    await store.logoutAdmin();
    window.location.href = "index.html";
  };

  if (adminMenuToggle && adminMobileMenu) {
    adminMenuToggle.addEventListener("click", () => {
      const isOpen = adminMobileMenu.classList.toggle("open");
      adminMenuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    adminMobileMenu.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        adminMobileMenu.classList.remove("open");
        adminMenuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const state = { editingId: null, pendingImage: "", pendingDeleteId: null };

  function showAdminView(viewName, moveFocus = false) {
    activeAdminView = viewName;
    adminTabs.forEach((tab) => {
      const isActive = tab.dataset.adminView === viewName;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      if (isActive && moveFocus) tab.focus();
    });
    adminPanels.forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== viewName;
    });

    if (viewName === "products") renderProducts();
    if (viewName === "trash") renderTrashList();
    if (viewName === "dashboard") loadDecisionDashboard();
  }

  adminTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showAdminView(tab.dataset.adminView));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % adminTabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + adminTabs.length) % adminTabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = adminTabs.length - 1;
      else return;
      event.preventDefault();
      showAdminView(adminTabs[nextIndex].dataset.adminView, true);
    });
  });

  window.addEventListener("dorcashop:catalog-updated", () => renderProducts());
  window.addEventListener("storage", (event) => {
    if (event.key === "dorcashop_catalog_changed_v1") renderProducts();
  });

  function formatCompactNumber(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(value);
  }

  function formatCurrency(value) {
    return `${new Intl.NumberFormat("fr-BJ", { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  function scrollToElement(element, offset = 90) {
    if (!element) return;
    const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top, behavior: "smooth" });
  }

  function setGlobalMessage(type, text) {
    if (!globalMessage) return;
    globalMessage.className = `admin-message ${type}`;
    globalMessage.textContent = text || "";
    globalMessage.hidden = !text;
    if (text) requestAnimationFrame(() => scrollToElement(globalMessage, 90));
  }

  function renderDashboardStats() {
    const products = store.getCatalogProducts();
    const categories = new Set(products.flatMap((product) => product.cats || []).map((cat) => String(cat).trim()).filter(Boolean));
    const recentCount = products.filter((product) => store.isRecentProduct ? store.isRecentProduct(product, 30) : false).length;
    const badgeCount = products.filter((product) => String(product.badge || "").trim()).length;

    if (statTotalProducts) {
      statTotalProducts.textContent = String(products.length);
    }

    if (statCategoryCount) {
      statCategoryCount.textContent = String(categories.size);
    }

    if (statRecentProducts) {
      statRecentProducts.textContent = String(recentCount);
    }

    if (statBadgeProducts) {
      statBadgeProducts.textContent = String(badgeCount);
    }

    if (productCountBadge) {
      productCountBadge.textContent = `${products.length} produit(s)`;
    }
  }

  function escapeAnalyticsText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function renderAnalyticsLineChart(daily) {
    const svg = document.getElementById("analyticsVisitorsChart");
    if (!svg) return;
    const width = 640;
    const height = 230;
    const padding = { top: 18, right: 20, bottom: 30, left: 36 };
    const maxValue = Math.max(1, ...daily.flatMap((day) => [Number(day.visitors) || 0, Number(day.orders) || 0]));
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const point = (value, index) => ({
      x: padding.left + (index / Math.max(daily.length - 1, 1)) * innerWidth,
      y: height - padding.bottom - ((Number(value) || 0) / maxValue) * innerHeight
    });
    const seriesPath = (key) => daily.map((day, index) => {
      const coordinates = point(day[key], index);
      return `${index === 0 ? "M" : "L"}${coordinates.x} ${coordinates.y}`;
    }).join(" ");
    const grid = Array.from({ length: 4 }, (_, index) => {
      const y = padding.top + (index / 3) * innerHeight;
      const value = Math.round(maxValue * (1 - index / 3));
      return `<g><line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e9e7e2"/><text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="#777b86" font-size="10">${value}</text></g>`;
    }).join("");
    const labels = daily.map((day, index) => {
      const coordinates = point(0, index);
      return `<text x="${coordinates.x}" y="${height - 8}" text-anchor="middle" fill="#777b86" font-size="10">${escapeAnalyticsText(day.label)}</text>`;
    }).join("");
    const dots = (key, color) => daily.map((day, index) => {
      const coordinates = point(day[key], index);
      return `<circle cx="${coordinates.x}" cy="${coordinates.y}" r="3.5" fill="${color}"/>`;
    }).join("");

    svg.innerHTML = `${grid}<path d="${seriesPath("visitors")}" fill="none" stroke="#E6007E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="${seriesPath("orders")}" fill="none" stroke="#16865d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots("visitors", "#E6007E")}${dots("orders", "#16865d")}${labels}`;
  }

  function renderAnalyticsOrders(daily) {
    const container = document.getElementById("analyticsOrdersBars");
    if (!container) return;
    const maxValue = Math.max(1, ...daily.map((day) => Number(day.orders) || 0));
    container.innerHTML = daily.map((day) => {
      const value = Number(day.orders) || 0;
      const barHeight = value > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
      return `<div class="decision-order-column"><span class="decision-order-value">${value}</span><span class="decision-order-track"><i style="height:${barHeight}%"></i></span><span class="decision-order-label">${escapeAnalyticsText(day.label)}</span></div>`;
    }).join("");
  }

  function renderAnalyticsCategories(categories) {
    const container = document.getElementById("analyticsCategoryBars");
    if (!container) return;
    if (!categories.length) {
      container.innerHTML = '<p class="decision-empty">Aucun produit au catalogue.</p>';
      return;
    }
    const maxCount = Math.max(1, ...categories.map((category) => Number(category.count) || 0));
    container.innerHTML = categories.map((category) => {
      const count = Number(category.count) || 0;
      return `<div class="decision-category-item"><div class="decision-category-meta"><span>${escapeAnalyticsText(category.label)}</span><strong>${count}</strong></div><span class="decision-category-track"><i style="width:${(count / maxCount) * 100}%"></i></span></div>`;
    }).join("");
  }

  function renderAnalyticsGauge(containerId, value, label, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));
    container.innerHTML = `<div class="decision-gauge-item"><div class="decision-gauge-ring" style="--gauge-color:${color};--gauge-value:${percentage}"><strong>${percentage.toFixed(1)}%</strong></div><span>${escapeAnalyticsText(label)}</span></div>`;
  }

  function renderAnalyticsActivity(activity) {
    const list = document.getElementById("analyticsActivityList");
    if (!list) return;
    if (!activity.length) {
      list.innerHTML = '<li class="decision-empty">Aucune activité enregistrée pour le moment.</li>';
      return;
    }
    list.innerHTML = activity.map((item) => {
      const timestamp = new Date(String(item.createdAt || "").replace(" ", "T"));
      const dateLabel = Number.isNaN(timestamp.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(timestamp);
      const orderDetails = item.type === "whatsapp_order"
        ? `${Number(item.itemCount) || 0} article(s) · potentiel ${formatCurrency(Number(item.amount) || 0)}`
        : item.type === "client_registered" ? "Compte client créé" : "Activité catalogue";
      return `<li class="decision-activity-item"><div><strong>${escapeAnalyticsText(item.description)}</strong><span>${escapeAnalyticsText(orderDetails)}</span></div><time>${escapeAnalyticsText(dateLabel)}</time></li>`;
    }).join("");
  }

  async function loadDecisionDashboard() {
    const loading = document.getElementById("analyticsLoading");
    const content = document.getElementById("analyticsContent");
    const errorBox = document.getElementById("analyticsError");
    const refreshButton = document.getElementById("refreshAnalyticsBtn");
    if (loading) loading.hidden = false;
    if (errorBox) errorBox.hidden = true;
    if (refreshButton) refreshButton.disabled = true;

    const response = await store.getAdminAnalytics();
    if (loading) loading.hidden = true;
    if (refreshButton) refreshButton.disabled = false;
    if (!response.ok || !response.payload.summary) {
      if (content) content.hidden = true;
      if (errorBox) {
        errorBox.textContent = response.payload.message || "Impossible de charger les indicateurs.";
        errorBox.hidden = false;
      }
      return;
    }

    const { summary, daily, categories, activity } = response.payload;
    document.getElementById("analyticsVisitors").textContent = formatCompactNumber(Number(summary.visitors) || 0);
    document.getElementById("analyticsClients").textContent = formatCompactNumber(Number(summary.clients) || 0);
    document.getElementById("analyticsNewClients").textContent = `${Number(summary.newClients) || 0} nouveau(x) cette semaine`;
    document.getElementById("analyticsOrders").textContent = formatCompactNumber(Number(summary.whatsappOrders) || 0);
    document.getElementById("analyticsPotentialRevenue").textContent = formatCurrency(Number(summary.potentialRevenue) || 0);
    renderAnalyticsLineChart(daily || []);
    renderAnalyticsOrders(daily || []);
    renderAnalyticsCategories(categories || []);
    renderAnalyticsGauge("analyticsOrderGauge", summary.orderIntentRate, "Paniers transmis / visiteurs", "#16865d");
    renderAnalyticsGauge("analyticsCatalogGauge", summary.catalogImageRate, "Produits avec photo", "#E6007E");
    renderAnalyticsActivity(activity || []);
    if (content) content.hidden = false;
  }

  function renderTrashList() {
    const trashList = document.getElementById("deletedProductsList");
    if (!trashList) {
      return;
    }

    const items = store.getTrashProducts ? store.getTrashProducts() : [];
    if (deletedProductCountBadge) {
      deletedProductCountBadge.textContent = `${items.length} élément(s)`;
    }

    if (!items.length) {
      trashList.innerHTML = '<div class="empty-state">Aucune suppression dans la corbeille.</div>';
      return;
    }

    trashList.innerHTML = items.map((product) => `
      <div class="deleted-product-card">
        <div class="deleted-product-copy">
          <strong>${product.name || "Produit supprimé"}</strong>
          <span>${product.category || product.cats?.[0] || "Divers"}</span>
        </div>
        <button type="button" class="btn btn-outline btn-sm restore-btn" data-restore-id="${product.id}">Restaurer</button>
      </div>
    `).join("");

    trashList.querySelectorAll("[data-restore-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const { restoreId } = button.dataset;
        if (!restoreId) {
          return;
        }

        if (store.restoreDeletedProduct) {
          await store.restoreDeletedProduct(restoreId);
        }
        renderProducts();
        setGlobalMessage("success", "Produit restauré avec succès.");
      });
    });
  }

  function renderProducts() {
    const products = store.getCatalogProducts();
    const searchTerm = (adminProductSearch ? adminProductSearch.value : "").trim().toLowerCase();
    const filteredProducts = searchTerm
      ? products.filter((product) => {
          const haystack = `${product.name || ""} ${product.category || ""} ${product.cats ? product.cats.join(" ") : ""} ${product.badge || ""}`.toLowerCase();
          return haystack.includes(searchTerm);
        })
      : products;

    if (!existingProductsList) {
      renderDashboardStats();
      return;
    }

    renderDashboardStats();
    renderTrashList();

    existingProductsList.innerHTML = filteredProducts.map((product) => {
      return `<div class="admin-product-card">${store.buildProductCardMarkup(product, { showActions: true })}</div>`;
    }).join("");

    existingProductsList.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const { action, id } = button.dataset;
        if (action === "edit") {
          const product = store.getCatalogProducts().find((item) => item.id === id);
          if (product) {
            fillForm(product);
          }
          return;
        }

        if (action === "delete") {
          if (!confirmBackdrop) {
            const shouldDelete = window.confirm("Voulez-vous vraiment supprimer ce produit ?\n\nOui = supprimer, Annuler = garder le produit.");
            if (!shouldDelete) {
              return;
            }
            executeDeleteProduct(id);
            return;
          }
          openDeleteConfirmation(id);
        }
      });
    });
  }

  function fillForm(product) {
    if (!form) {
      return;
    }

    state.editingId = product.id;
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productDescription").value = product.desc || "";
    document.getElementById("productPrice").value = product.price || "";
    document.getElementById("productOldPrice").value = product.oldPrice || "";
    document.getElementById("productCategory").value = product.category || (product.cats && product.cats[0]) || "fournitures";
    document.getElementById("productBadge").value = product.badge || "";

    if (product.img) {
      productImagePreview.src = product.img;
      productImagePreview.hidden = false;
      state.pendingImage = product.img;
    } else {
      productImagePreview.removeAttribute("src");
      productImagePreview.hidden = true;
      state.pendingImage = "";
    }

    form.querySelector("button[type='submit']").textContent = "Enregistrer les modifications";
    cancelEditBtn.classList.remove("hidden");
    requestAnimationFrame(() => scrollToElement(form, 110));
  }

  function resetForm() {
    form.reset();
    state.editingId = null;
    state.pendingImage = "";
    productImagePreview.hidden = true;
    productImagePreview.removeAttribute("src");
    form.querySelector("button[type='submit']").textContent = "Ajouter le produit";
    cancelEditBtn.classList.add("hidden");
    productImageInput.value = "";
  }

  function openDeleteConfirmation(id) {
    state.pendingDeleteId = id;
    if (confirmBackdrop) {
      confirmBackdrop.hidden = false;
      confirmBackdrop.classList.add("open");
      if (confirmDeleteBtn) {
        confirmDeleteBtn.focus();
      }
    }
  }

  function closeDeleteConfirmation() {
    if (confirmBackdrop) {
      confirmBackdrop.classList.remove("open");
      confirmBackdrop.hidden = true;
    }
    state.pendingDeleteId = null;
  }

  async function executeDeleteProduct(id) {
    if (!id) {
      return;
    }

    const currentProducts = store.getCatalogProducts();
    const targetProduct = currentProducts.find((product) => String(product.id) === String(id));

    setDeleteButtonLoading(true);
    closeDeleteConfirmation();

    if (targetProduct) {
      const optimisticList = currentProducts.filter((product) => String(product.id) !== String(id));
      const optimisticBadge = document.getElementById("productCountBadge");
      if (optimisticBadge) {
        optimisticBadge.textContent = `${optimisticList.length} produit(s)`;
      }
      renderProducts();
    }

    try {
      await store.deleteProduct(id);
      renderProducts();
      setGlobalMessage("success", "Produit supprimé avec succès.");
    } catch (error) {
      renderProducts();
      setGlobalMessage("error", "La suppression du produit a échoué.");
    } finally {
      setDeleteButtonLoading(false);
    }
  }

  function setDeleteButtonLoading(isLoading) {
    if (!confirmDeleteBtn) {
      return;
    }

    confirmDeleteBtn.disabled = isLoading;
    confirmDeleteBtn.textContent = isLoading ? "Suppression..." : "Oui, supprimer";
    confirmDeleteBtn.setAttribute("aria-busy", String(isLoading));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossible de lire l'image."));
      reader.readAsDataURL(file);
    });
  }

  productImageInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      state.pendingImage = "";
      productImagePreview.hidden = true;
      productImagePreview.removeAttribute("src");
      return;
    }

    try {
      const result = await readFileAsDataUrl(file);
      state.pendingImage = result;
      productImagePreview.src = result;
      productImagePreview.hidden = false;
    } catch (error) {
      setGlobalMessage("error", "L'image n'a pas pu être chargée.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const price = document.getElementById("productPrice").value.trim();
    const oldPrice = document.getElementById("productOldPrice").value.trim();
    const category = document.getElementById("productCategory").value;
    const badge = document.getElementById("productBadge").value;

    if (!name || !price || !category) {
      setGlobalMessage("error", "Veuillez renseigner au minimum le nom, la catégorie et le prix du produit.");
      return;
    }

    const payload = {
      id: state.editingId || `custom-${Date.now()}`,
      name,
      desc: description || "Produit de la boutique DORCASHOP.",
      price,
      oldPrice,
      priceNote: "",
      priceGros: "",
      category,
      cats: [category],
      badge,
      img: state.pendingImage || "",
      details: null
    };

    if (state.editingId) {
      await store.updateProduct(state.editingId, payload);
      setGlobalMessage("success", "Produit modifié avec succès.");
      renderProducts();
      resetForm();
      setTimeout(() => {
        setGlobalMessage("success", "Produit modifié avec succès.");
      }, 100);
      return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    try {
      await store.createProduct(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le produit n’a pas pu être enregistré.";
      setGlobalMessage("error", message);
      return;
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }

    try {
      window.localStorage.setItem("dorcashop_admin_toast_v1", "Produit ajouté avec succès.");
    } catch (error) {
      // ignore storage restrictions
    }
    setGlobalMessage("success", "Produit ajouté avec succès.");
    renderProducts();
    resetForm();
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  });

  if (adminProductSearch) {
    adminProductSearch.addEventListener("input", renderProducts);
  }

  cancelEditBtn.addEventListener("click", resetForm);

  confirmDeleteBtn.addEventListener("click", async () => {
    const id = state.pendingDeleteId;
    if (!id) {
      closeDeleteConfirmation();
      return;
    }

    await executeDeleteProduct(id);
  });

  cancelDeleteBtn.addEventListener("click", closeDeleteConfirmation);
  confirmBackdrop.addEventListener("click", (event) => {
    if (event.target === confirmBackdrop) {
      closeDeleteConfirmation();
    }
  });

  if (restoreAllTrashBtn) {
    restoreAllTrashBtn.addEventListener("click", async () => {
      if (store.restoreAllDeletedProducts) {
        const result = store.restoreAllDeletedProducts();
        renderProducts();
        setGlobalMessage("success", `Restauration complète effectuée (${result.restored.length} produit(s)).`);
      }
    });
  }

  if (clearTrashBtn) {
    clearTrashBtn.addEventListener("click", () => {
      if (store.clearTrash) {
        store.clearTrash();
      }
      renderProducts();
      setGlobalMessage("success", "Corbeille vidée avec succès.");
    });
  }

  logoutBtn && logoutBtn.addEventListener("click", doLogout);
  logoutBtnMobile && logoutBtnMobile.addEventListener("click", doLogout);
  document.getElementById("refreshAnalyticsBtn")?.addEventListener("click", loadDecisionDashboard);

  showAdminView("addProduct");
  renderProducts();
})();
