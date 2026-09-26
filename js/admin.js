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

    if (store.isAdminAuthenticated()) {
      window.location.href = "administration.html";
      return;
    }

    toggleButton && toggleButton.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      toggleButton.textContent = isPassword ? "Masquer" : "Afficher";
      toggleButton.setAttribute("aria-label", isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe");
    });

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        errorBox.hidden = false;
        errorBox.textContent = "Veuillez renseigner votre username et votre mot de passe.";
        return;
      }

      const success = await store.loginAdminAsync(username, password);
      if (success) {
        window.location.href = "administration.html";
        return;
      }

      errorBox.hidden = false;
      errorBox.textContent = "Identifiants incorrects. Veuillez vérifier votre username et votre mot de passe.";
      passwordInput.value = "";
      passwordInput.focus();
    });

    return;
  }

  const adminPage = document.getElementById("adminProductForm");
  if (!adminPage) {
    return;
  }

  if (!store.isAdminAuthenticated()) {
    window.location.href = "admin-login.html";
    return;
  }

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
  const doLogout = () => {
    store.logoutAdmin();
    window.location.href = "admin-login.html";
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

  const state = {
    editingId: null,
    pendingImage: "",
    pendingDeleteId: null
  };

  function formatCompactNumber(value) {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return String(value);
  }

  function formatCurrency(value) {
    return `${new Intl.NumberFormat("fr-BJ", { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  function scrollToElement(element, offset = 90) {
    if (!element) {
      return;
    }

    const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({
      top,
      behavior: "smooth"
    });
  }

  function setGlobalMessage(type, text) {
    if (!globalMessage) {
      return;
    }

    globalMessage.className = `admin-message ${type}`;
    globalMessage.textContent = text || "";
    globalMessage.hidden = !text;

    if (text) {
      requestAnimationFrame(() => scrollToElement(globalMessage, 90));
    }
  }

  function getDashboardAnalytics(products) {
    const categories = {};
    products.forEach((product) => {
      const name = String(product.category || product.cats?.[0] || "Divers").trim() || "Divers";
      categories[name] = (categories[name] || 0) + 1;
    });

    const categoryData = Object.entries(categories).map(([label, count]) => ({ label, count }));
    const metrics = store.getDashboardMetrics ? store.getDashboardMetrics() : { visitors: 300, orders: 50, revenue: 100000, conversion: 1.7 };
    const visitorsTotal = Math.max(0, Number(metrics.visitors) || 300);
    const ordersTotal = Math.max(0, Number(metrics.orders) || 50);
    const revenueTotal = Math.max(0, Number(metrics.revenue) || 100000);
    const conversionRate = Number(metrics.conversion) || ((ordersTotal / visitorsTotal) * 100 || 0);

    const visitorSeries = [0.82, 0.94, 0.88, 1.08, 1.15, 1.02, 1.2].map((factor) => {
      const value = Math.round(visitorsTotal * factor);
      return Math.max(30, value);
    });

    const ordersSeries = [0.56, 0.72, 0.7, 0.92, 1.04, 1.22, 1.38].map((factor) => {
      const value = Math.round(ordersTotal * factor);
      return Math.max(8, value);
    });

    const revenueSeries = [0.62, 0.76, 0.74, 0.98, 1.18, 1.3, 1.5].map((factor) => {
      const value = Math.round(revenueTotal * factor);
      return Math.max(15000, value);
    });

    return {
      visitorSeries,
      ordersSeries,
      revenueSeries,
      categoryData,
      visitorsTotal,
      ordersTotal,
      revenueTotal,
      conversionRate,
      labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    };
  }

  function drawLineChart(svg, visitors, revenue) {
    if (!svg) {
      return;
    }

    const width = 620;
    const height = 220;
    const padding = { top: 20, right: 30, bottom: 28, left: 30 };
    const maxValue = Math.max(...visitors, ...revenue, 1);
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const pointFromValue = (value, index) => {
      const x = padding.left + (index / (visitors.length - 1)) * innerWidth;
      const y = height - padding.bottom - ((value / maxValue) * innerHeight);
      return { x, y };
    };

    const visitorPoints = visitors.map((value, index) => pointFromValue(value, index));
    const revenuePoints = revenue.map((value, index) => pointFromValue(value, index));

    const visitorPath = visitorPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
    const revenuePath = revenuePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

    const gridLines = Array.from({ length: 4 }, (_, index) => {
      const y = padding.top + (index / 3) * innerHeight;
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(20,35,67,.08)" stroke-width="1" />`;
    }).join("");

    const xLabels = visitors.map((_, index) => {
      const x = padding.left + (index / (visitors.length - 1)) * innerWidth;
      return `<text x="${x}" y="${height - 8}" text-anchor="middle" fill="#6A6E7D" font-size="10">${["L", "M", "M", "J", "V", "S", "D"][index]}</text>`;
    }).join("");

    svg.innerHTML = `
      <defs>
        <linearGradient id="visitorGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(230,0,126,0.3)" />
          <stop offset="100%" stop-color="rgba(230,0,126,0)" />
        </linearGradient>
        <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(20,35,67,0.22)" />
          <stop offset="100%" stop-color="rgba(20,35,67,0)" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${revenuePath} L ${width - padding.right} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z" fill="url(#revenueGradient)" opacity="0.7"></path>
      <path d="${visitorPath}" fill="none" stroke="#E6007E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="${revenuePath}" fill="none" stroke="#142343" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${visitorPoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#E6007E" />`).join("")}
      ${revenuePoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#142343" />`).join("")}
      ${xLabels}
    `;
  }

  function renderOrdersBars(values) {
    const container = document.getElementById("ordersBars");
    if (!container) {
      return;
    }

    const maxValue = Math.max(...values, 1);
    container.innerHTML = values.map((value, index) => {
      const height = Math.max((value / maxValue) * 100, 10);
      return `
        <div class="bar-column">
          <span class="bar-value">${value}</span>
          <span class="bar-track"><span class="bar-fill" style="height:${height}%"></span></span>
          <span class="bar-label">${["L", "M", "M", "J", "V", "S", "D"][index]}</span>
        </div>
      `;
    }).join("");
  }

  function renderProductGauge(containerId, title, value, color) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="goal-gauge">
        <div class="gauge-ring" style="--gauge-color:${color}; --angle:${value};">
          <span>${value}%</span>
        </div>
        <small>${title}</small>
      </div>
    `;
  }

  function renderCategoryBars(categoryData) {
    const container = document.getElementById("categoryBars");
    if (!container) {
      return;
    }

    const maxCount = Math.max(...categoryData.map((item) => item.count), 1);
    container.innerHTML = categoryData.map((item, index) => {
      const width = (item.count / maxCount) * 100;
      const palette = ["#E6007E", "#142343", "#FF6A00", "#14A56B", "#FFD400"];
      return `
        <div class="category-item">
          <div class="category-meta">
            <span>${item.label}</span>
            <strong>${item.count}</strong>
          </div>
          <div class="category-track">
            <span class="category-fill" style="width:${width}%; background:${palette[index % palette.length]};"></span>
          </div>
        </div>
      `;
    }).join("");
  }

  function getDecisionInsights(products) {
    const productScores = products.map((product) => {
      const numericPrice = Number(String(product.price || "").replace(/[^\d]/g, "")) || 1200;
      const badgeWeight = String(product.badge || "").trim() ? 1.35 : 1;
      const freshWeight = store.isRecentProduct && store.isRecentProduct(product, 30) ? 1.25 : 1;
      const sales = Math.max(4, Math.round((numericPrice / 140) * badgeWeight * freshWeight * 1.6));
      const revenue = sales * Math.max(900, numericPrice * 0.82);
      return {
        name: product.name,
        category: product.category || product.cats?.[0] || "Divers",
        sales,
        revenue,
        score: sales + Math.round(revenue / 1000)
      };
    });

    const topProducts = [...productScores].sort((a, b) => b.score - a.score).slice(0, 5);
    const watchlist = [...productScores].sort((a, b) => a.score - b.score).slice(0, 4);
    const recommendations = [
      { label: "Mettre en avant", value: topProducts[0]?.name || "Produit phare", detail: "Le produit qui convertit le mieux" },
      { label: "Relancer", value: watchlist[0]?.name || "Produit faible", detail: "À remettre en promotion pour réactiver les ventes" },
      { label: "Segmenter", value: "Promotions", detail: "Cibler les catégories à forte affluence" }
    ];

    return { topProducts, watchlist, recommendations };
  }

  function renderDecisionInsights() {
    const products = store.getCatalogProducts();
    const insights = getDecisionInsights(products);

    const topProductsList = document.getElementById("topProductsList");
    const watchlistProducts = document.getElementById("watchlistProducts");
    const decisionRecommendations = document.getElementById("decisionRecommendations");

    if (topProductsList) {
      topProductsList.innerHTML = insights.topProducts.map((item, index) => `
        <li class="decision-item">
          <div class="decision-copy">
            <span class="decision-label">${index + 1}. ${item.name}</span>
            <span class="decision-meta">${item.category}</span>
          </div>
          <strong class="decision-value">${item.sales} ventes</strong>
        </li>
      `).join("");
    }

    if (watchlistProducts) {
      watchlistProducts.innerHTML = insights.watchlist.map((item) => `
        <li class="decision-item">
          <div class="decision-copy">
            <span class="decision-label">${item.name}</span>
            <span class="decision-meta">${item.category}</span>
          </div>
          <strong class="decision-value">${item.sales}</strong>
        </li>
      `).join("");
    }

    if (decisionRecommendations) {
      decisionRecommendations.innerHTML = insights.recommendations.map((item) => `
        <li class="recommendation-item">
          <div class="recommendation-copy">
            <span class="recommendation-label">${item.label}</span>
            <span class="recommendation-detail">${item.detail}</span>
          </div>
          <span class="recommendation-pill">${item.value}</span>
        </li>
      `).join("");
    }
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

    const analytics = getDashboardAnalytics(products);
    const conversionRate = document.getElementById("conversionRate");
    const metricVisitors = document.getElementById("metricVisitors");
    const metricOrders = document.getElementById("metricOrders");
    const metricRevenue = document.getElementById("metricRevenue");
    const conversionDonut = document.getElementById("conversionDonut");

    if (conversionRate) {
      conversionRate.textContent = `${analytics.conversionRate.toFixed(1)}%`;
    }

    if (conversionDonut) {
      conversionDonut.style.background = `conic-gradient(#E6007E 0 ${Math.min(analytics.conversionRate, 100)}%, #F2E8D9 ${Math.min(analytics.conversionRate, 100)}% 100%)`;
    }

    if (metricVisitors) {
      metricVisitors.textContent = formatCompactNumber(analytics.visitorsTotal);
    }

    if (metricOrders) {
      metricOrders.textContent = String(analytics.ordersTotal);
    }

    if (metricRevenue) {
      metricRevenue.textContent = formatCurrency(analytics.revenueTotal);
    }

    drawLineChart(document.getElementById("revenueChartSvg"), analytics.visitorSeries, analytics.revenueSeries);
    renderOrdersBars(analytics.ordersSeries);
    renderCategoryBars(analytics.categoryData);
    renderProductGauge("topProductGauge", "Produit phare", 91, "#E6007E");
    renderProductGauge("followUpGauge", "Suivi actif", 74, "#142343");
    renderDecisionInsights();
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
      if (confirmDeleteBtn) {
        confirmDeleteBtn.focus();
      }
    }
  }

  function closeDeleteConfirmation() {
    if (confirmBackdrop) {
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
      if (store.recordDashboardEvent) {
        store.recordDashboardEvent("product_deleted", { visitors: -6, orders: -1, revenue: -3500 });
      }
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
      if (store.recordDashboardEvent) {
        store.recordDashboardEvent("product_updated", { visitors: 6, orders: 0, revenue: 1500 });
      }
      setGlobalMessage("success", "Produit modifié avec succès.");
      renderProducts();
      resetForm();
      setTimeout(() => {
        setGlobalMessage("success", "Produit modifié avec succès.");
      }, 100);
      return;
    }

    await store.createProduct(payload);
    if (store.recordDashboardEvent) {
      store.recordDashboardEvent("product_created", { visitors: 12, orders: 1, revenue: 2600 });
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

  renderProducts();
})();
