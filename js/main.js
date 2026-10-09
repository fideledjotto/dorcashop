(function(){
  "use strict";

  const WHATSAPP_NUMBER = "22947136292"; // 01 47 13 62 92 au format international
  const CART_KEY = "dorcashop_cart_v1";
  const VISITOR_ID_KEY = "dorcashop_visitor_id_v1";

  /* ---------------------------------------------------------
     Icones sobres (remplacent une photo quand aucune n'a ete fournie)
     --------------------------------------------------------- */
  const ICONS = {
    sketch: `<svg viewBox="0 0 48 48" fill="none" stroke="#142343" stroke-width="2"><rect x="9" y="6" width="30" height="36" rx="2"/><path d="M15 16h18M15 23h18M15 30h11" stroke-linecap="round"/><path d="M31 30l4 4-2 5-5-2 3-7z" fill="#FFD400" stroke="#142343"/></svg>`,
    sewing: `<svg viewBox="0 0 48 48" fill="none" stroke="#142343" stroke-width="2"><rect x="7" y="14" width="34" height="24" rx="3"/><path d="M7 22h34" /><circle cx="24" cy="17.5" r="1.6" fill="#E6007E" stroke="none"/><path d="M15 28c2-3 5-3 6 0s4 3 6 0 5-3 6 0" stroke-linecap="round"/></svg>`,
    reader: `<svg viewBox="0 0 48 48" fill="none" stroke="#142343" stroke-width="2"><path d="M24 12c-4-3-10-3-15-1v25c5-2 11-2 15 1 4-3 10-3 15-1V11c-5-2-11-2-15 1z"/><path d="M24 12v25" /></svg>`,
    abc: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="28" rx="3" stroke="#142343" stroke-width="2" fill="none"/><text x="24" y="30" font-family="Montserrat, sans-serif" font-weight="800" font-size="14" text-anchor="middle" fill="#E6007E">ABC</text></svg>`,
    notebook: `<svg viewBox="0 0 48 48" fill="none" stroke="#142343" stroke-width="2"><rect x="10" y="6" width="28" height="36" rx="2"/><path d="M10 6v36" stroke="#FFD400" stroke-width="3"/><path d="M18 16h16M18 23h16M18 30h10" stroke-linecap="round"/></svg>`
  };

  const CAT_COLORS = {
    fournitures: "#E6007E",
    etudiants: "#FF6A00",
    enfants: "#14A56B",
    maison: "#142343",
    gros: "#FFD400"
  };

  /* ---------------------------------------------------------
     Etat
     --------------------------------------------------------- */
  let cart = loadCart();
  let activeFilter = "tous";
  let searchTerm = "";

  const grid = document.getElementById("productGrid");
  const noResults = document.getElementById("noResults");
  const catalogProducts = () => window.DORCASHOPStore ? window.DORCASHOPStore.getCatalogProducts() : PRODUCTS;
  const familyCarouselRefreshers = [];

  function newestFamilyPhoto(family) {
    return catalogProducts()
      .filter(product => product.img && (product.cats || [product.category]).includes(family))
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0] || null;
  }

  function loadCart(){
    try{
      const raw = localStorageSafeGet(CART_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
  }
  function saveCart(){
    localStorageSafeSet(CART_KEY, JSON.stringify(cart));
  }
  // Artifacts-safe wrapper: localStorage may be unavailable in some previews.
  function localStorageSafeGet(k){ try{ return window.localStorage.getItem(k); }catch(e){ return null; } }
  function localStorageSafeSet(k,v){ try{ window.localStorage.setItem(k,v); }catch(e){ /* silencieux */ } }

  function getVisitorId(){
    let visitorId = localStorageSafeGet(VISITOR_ID_KEY);
    if (visitorId) return visitorId;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      visitorId = window.crypto.randomUUID();
    } else {
      visitorId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
        const random = Math.random() * 16 | 0;
        return (char === "x" ? random : (random & 3 | 8)).toString(16);
      });
    }
    localStorageSafeSet(VISITOR_ID_KEY, visitorId);
    return visitorId;
  }

  async function syncCatalogFromServer(){
    if (!window.DORCASHOPStore || typeof window.DORCASHOPStore.loadProductsFromServer !== "function") {
      return;
    }

    try {
      await window.DORCASHOPStore.loadProductsFromServer();
    } catch (error) {
      // ignore server sync failures and keep the local catalog as fallback
    }
  }

  /* ---------------------------------------------------------
     Rendu des cartes produit
     --------------------------------------------------------- */
  function badgeClass(b){ return "badge-" + b.replace(" ", ""); }

  function cardMedia(p){
    if(p.img){
      return `<img src="${p.img}" alt="${p.name}" loading="lazy">`;
    }
    return ICONS[p.icon] || "";
  }

  function productCardHTML(p){
    return window.DORCASHOPStore ? window.DORCASHOPStore.buildProductCardMarkup(p) : `
    <article class="product-card" data-id="${p.id}" data-cats="${p.cats.join(" ")}" data-name="${p.name.toLowerCase()}">
      <div class="card-cat-bar" style="background:${CAT_COLORS[p.cats[0]] || "#142343"}"></div>
      <div class="card-media">
        ${p.badge ? `<span class="card-badge badge-${p.badge.replace(/\s+/g, "")}">${p.badge}</span>` : ""}
        ${p.details ? `<button class="details-btn" data-id="${p.id}" aria-label="Voir les tarifs détaillés de ${p.name}">+</button>` : ""}
        ${cardMedia(p)}
      </div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="card-desc">${p.desc}</p>
        <div class="card-price-row">
          <div>
            ${p.oldPrice ? `<div class="card-old-price">${p.oldPrice}</div>` : ""}
            <span class="card-price">${p.price}</span>
            <small>${p.priceNote || ""}</small>
          </div>
        </div>
        ${p.priceGros ? `<div class="card-gros">Gros : ${p.priceGros}</div>` : ""}
        <button class="card-order-btn" data-id="${p.id}">Commander</button>
      </div>
    </article>`;
  }

  function renderGrid(){
    const products = catalogProducts();
    grid.innerHTML = products.map(productCardHTML).join("");
    applyFilters();
    bindCardEvents();
  }

  function renderPromoGrid(){
    const promoGrid = document.getElementById("promoGrid");
    if(!promoGrid) return;
    const picks = catalogProducts().filter(p=>p.badge).slice(0,4);
    promoGrid.innerHTML = picks.map(productCardHTML).join("");
    promoGrid.querySelectorAll(".card-order-btn").forEach(btn=>{
      btn.addEventListener("click", ()=> addToCart(btn.dataset.id));
    });
    promoGrid.querySelectorAll(".details-btn").forEach(btn=>{
      btn.addEventListener("click", ()=> openDetails(btn.dataset.id));
    });
  }

  function applyFilters(){
    const cards = grid.querySelectorAll(".product-card");
    let visible = 0;
    cards.forEach(card => {
      const cats = card.dataset.cats.split(" ");
      const name = card.dataset.name;
      const matchesCat = activeFilter === "tous" || cats.includes(activeFilter);
      const matchesSearch = !searchTerm || name.includes(searchTerm);
      const show = matchesCat && matchesSearch;
      card.classList.toggle("hidden", !show);
      if(show) visible++;
    });
    noResults.classList.toggle("show", visible === 0);
  }

  function bindCardEvents(){
    grid.querySelectorAll(".card-order-btn").forEach(btn=>{
      btn.addEventListener("click", ()=> addToCart(btn.dataset.id));
    });
    grid.querySelectorAll(".details-btn").forEach(btn=>{
      btn.addEventListener("click", ()=> openDetails(btn.dataset.id));
    });
  }

  /* ---------------------------------------------------------
     Filtres + recherche
     --------------------------------------------------------- */
  function refreshCatalogUI(){
    renderGrid();
    renderPromoGrid();
    renderCart();
    refreshFamilyFeaturedImages();
  }

  function refreshFamilyFeaturedImages(){
    familyCarouselRefreshers.forEach(refresh => refresh());
  }

  window.addEventListener("dorcashop:catalog-updated", refreshCatalogUI);
  window.addEventListener("storage", (event) => {
    if (event.key === "dorcashop_catalog_changed_v1") {
      refreshCatalogUI();
    }
  });

  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      filterBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  document.querySelectorAll("[data-jump-filter]").forEach(el=>{
    el.addEventListener("click", (e)=>{
      const target = el.getAttribute("data-jump-filter");
      const targetBtn = document.querySelector(`.filter-btn[data-filter="${target}"]`);
      if(targetBtn){
        filterBtns.forEach(b=>b.classList.remove("active"));
        targetBtn.classList.add("active");
        activeFilter = target;
        applyFilters();
      }
    });
  });

  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", ()=>{
    searchTerm = searchInput.value.trim().toLowerCase();
    applyFilters();
  });

  const accountBackdrop = document.getElementById("accountBackdrop");
  const accountLoginTab = document.getElementById("accountLoginTab");
  const accountRegisterTab = document.getElementById("accountRegisterTab");
  const accountLoginForm = document.getElementById("accountLoginForm");
  const accountRegisterForm = document.getElementById("accountRegisterForm");
  const accountDialogTitle = document.getElementById("accountDialogTitle");
  const accountLink = document.getElementById("accountLink");
  const accountPromptKey = "dorcashop_account_prompt_seen_v1";

  function setAccountMode(mode){
    const isRegister = mode === "register";
    accountLoginForm.hidden = isRegister;
    accountRegisterForm.hidden = !isRegister;
    accountLoginTab.classList.toggle("active", !isRegister);
    accountRegisterTab.classList.toggle("active", isRegister);
    accountLoginTab.setAttribute("aria-selected", String(!isRegister));
    accountRegisterTab.setAttribute("aria-selected", String(isRegister));
    accountDialogTitle.textContent = isRegister ? "Créer un compte" : "Se connecter";
  }

  function openAccountDialog(mode = "login"){
    setAccountMode(mode);
    accountBackdrop.classList.add("open");
    accountBackdrop.setAttribute("aria-hidden", "false");
    try { sessionStorage.setItem(accountPromptKey, "1"); } catch (error) {}
    requestAnimationFrame(() => (mode === "register" ? document.getElementById("accountName") : document.getElementById("accountIdentifier")).focus());
  }

  function closeAccountDialog(){
    accountBackdrop.classList.remove("open");
    accountBackdrop.setAttribute("aria-hidden", "true");
    if (window.location.hash === "#connexion" || window.location.hash === "#inscription") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function updateAccountLink(isAuthenticated){
    accountSessionAuthenticated = Boolean(isAuthenticated);
    accountLink.textContent = accountSessionAuthenticated ? "Se déconnecter" : "Se connecter";
    accountLink.href = accountSessionAuthenticated ? "#deconnexion" : "#connexion";
    accountLink.setAttribute("aria-label", accountLink.textContent);
  }

  accountLink.addEventListener("click", async event => {
    event.preventDefault();
    if (!accountSessionReady) {
      const session = await window.DORCASHOPStore.getAccountSession();
      accountSessionReady = true;
      updateAccountLink(session.authenticated);
    }

    if (!accountSessionAuthenticated) {
      openAccountDialog();
      return;
    }

    accountLink.setAttribute("aria-busy", "true");
    const loggedOut = await window.DORCASHOPStore.logoutAccount();
    accountLink.removeAttribute("aria-busy");
    if (loggedOut) updateAccountLink(false);
  });
  document.getElementById("closeAccountDialog").addEventListener("click", closeAccountDialog);
  accountLoginTab.addEventListener("click", () => setAccountMode("login"));
  accountRegisterTab.addEventListener("click", () => setAccountMode("register"));
  accountBackdrop.addEventListener("click", event => {
    if (event.target === accountBackdrop) closeAccountDialog();
  });
  accountBackdrop.querySelectorAll(".password-toggle").forEach(toggle => {
    toggle.addEventListener("click", () => {
      const input = toggle.closest(".password-field").querySelector("input");
      const isVisible = input.type === "password";
      input.type = isVisible ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(isVisible));
      toggle.setAttribute("aria-label", `${isVisible ? "Masquer" : "Afficher"} le mot de passe`);
      toggle.title = `${isVisible ? "Masquer" : "Afficher"} le mot de passe`;
    });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && accountBackdrop.classList.contains("open")) closeAccountDialog();
  });

  accountLoginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const errorBox = document.getElementById("accountLoginError");
    const submitButton = accountLoginForm.querySelector("[type='submit']");
    errorBox.hidden = true;
    submitButton.disabled = true;
    const result = await window.DORCASHOPStore.authenticateAccount(
      document.getElementById("accountIdentifier").value,
      document.getElementById("accountPassword").value
    );
    submitButton.disabled = false;
    if (!result.success) {
      errorBox.textContent = result.message || "Identifiants incorrects.";
      errorBox.hidden = false;
      return;
    }
    window.location.href = result.role === "admin" ? "administration.html" : "client.html";
  });

  accountRegisterForm.addEventListener("submit", async event => {
    event.preventDefault();
    const errorBox = document.getElementById("accountRegisterError");
    const submitButton = accountRegisterForm.querySelector("[type='submit']");
    const password = document.getElementById("accountNewPassword").value;
    const passwordConfirm = document.getElementById("accountPasswordConfirm").value;
    errorBox.hidden = true;
    if (password !== passwordConfirm) {
      errorBox.textContent = "Les mots de passe ne correspondent pas.";
      errorBox.hidden = false;
      return;
    }

    submitButton.disabled = true;
    const result = await window.DORCASHOPStore.registerAccount({
      name: document.getElementById("accountName").value,
      email: document.getElementById("accountEmail").value,
      password
    });
    submitButton.disabled = false;
    if (!result.success) {
      errorBox.textContent = result.message || "La création du compte a échoué.";
      errorBox.hidden = false;
      return;
    }
    window.location.href = "client.html";
  });

  document.getElementById("accountLoginError").hidden = true;
  document.getElementById("accountRegisterError").hidden = true;
  if (window.location.hash === "#connexion" || window.location.hash === "#inscription") {
    openAccountDialog(window.location.hash === "#inscription" ? "register" : "login");
  }

  let accountPromptShown = false;
  let accountSessionReady = false;
  let accountSessionAuthenticated = false;

  function maybePromptForAccount(){
    if (accountPromptShown || !accountSessionReady || accountSessionAuthenticated || window.scrollY < 140) return;
    try {
      if (sessionStorage.getItem(accountPromptKey)) return;
    } catch (error) {}
    accountPromptShown = true;
    openAccountDialog();
  }

  window.addEventListener("scroll", maybePromptForAccount, { passive: true });
  window.DORCASHOPStore.getAccountSession().then(session => {
    accountSessionReady = true;
    updateAccountLink(session.authenticated);
    maybePromptForAccount();
    if (session.account?.role !== "admin") {
      window.DORCASHOPStore.trackSiteVisit(getVisitorId());
    }
  });

  /* ---------------------------------------------------------
     Images de famille défilables manuellement par balayage
     --------------------------------------------------------- */
  document.querySelectorAll(".cat-card[data-images]").forEach((card)=>{
    const baseImages = (card.dataset.images || "").split("|").map(s => s.trim()).filter(Boolean);
    const familyName = card.querySelector("h3")?.textContent || "";
    const featuredProduct = newestFamilyPhoto(card.dataset.jumpFilter);
    const images = featuredProduct
      ? [featuredProduct.img, ...baseImages.filter(src => src !== featuredProduct.img)]
      : baseImages;
    if (images.length < 2) return;

    const imgWrap = card.querySelector(".img-wrap");
    if (!imgWrap) return;

    const existingImg = imgWrap.querySelector("img");
    if (existingImg) existingImg.remove();

    const slides = images.map((src, index)=>{
      const img = new Image();
      img.loading = index === 0 ? "eager" : "lazy";
      img.decoding = "async";
      img.src = src;
      img.alt = index === 0 && featuredProduct ? featuredProduct.name : familyName;
      img.className = index === 0 ? "active" : "";
      img.style.opacity = index === 0 ? "1" : "0";
      img.style.transform = index === 0 ? "none" : "translateX(18px)";
      imgWrap.appendChild(img);
      return img;
    });

    let activeIndex = 0;
    let touchStartX = 0;
    let hasMovedEnough = false;

    const showSlide = (index) => {
      slides.forEach((img, i) => {
        const isActive = i === index;
        img.classList.toggle("active", isActive);
        img.style.opacity = isActive ? "1" : "0";
        img.style.transform = isActive ? "none" : "translateX(18px)";
      });
      activeIndex = index;
    };

    familyCarouselRefreshers.push(() => {
      const latestProduct = newestFamilyPhoto(card.dataset.jumpFilter);
      slides[0].src = latestProduct ? latestProduct.img : baseImages[0];
      slides[0].alt = latestProduct ? latestProduct.name : familyName;
      showSlide(0);
    });

    const handleSwipe = (startX, endX) => {
      const deltaX = endX - startX;
      if (Math.abs(deltaX) < 40) return false;
      if (deltaX < 0) showSlide((activeIndex + 1) % slides.length);
      if (deltaX > 0) showSlide((activeIndex - 1 + slides.length) % slides.length);
      return true;
    };

    card.addEventListener("touchstart", (event) => {
      touchStartX = event.touches[0].clientX;
      hasMovedEnough = false;
    }, { passive: true });

    card.addEventListener("touchmove", (event) => {
      const deltaX = event.touches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 30) hasMovedEnough = true;
    }, { passive: true });

    card.addEventListener("touchend", (event) => {
      const touchEndX = event.changedTouches[0].clientX;
      const swiped = handleSwipe(touchStartX, touchEndX);
      if (swiped) {
        event.preventDefault();
      }
      hasMovedEnough = false;
    }, { passive: false });

    card.addEventListener("pointerdown", (event) => {
      touchStartX = event.clientX;
      hasMovedEnough = false;
    });

    card.addEventListener("pointermove", (event) => {
      if (Math.abs(event.clientX - touchStartX) > 30) hasMovedEnough = true;
    });

    card.addEventListener("pointerup", (event) => {
      const swiped = handleSwipe(touchStartX, event.clientX);
      if (swiped) {
        event.preventDefault();
      }
      hasMovedEnough = false;
    });

    card.addEventListener("click", (event) => {
      if (hasMovedEnough) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  });

  /* ---------------------------------------------------------
     Boucle infinie du hero : échange des deux affiches en continu
     --------------------------------------------------------- */
  const heroGallery = document.querySelector(".hero-gallery");
  if (heroGallery && window.matchMedia("(max-width: 860px)").matches) {
    const triggerHeroSwap = () => {
      heroGallery.classList.remove("is-swapping");
      void heroGallery.offsetWidth;
      heroGallery.classList.add("is-swapping");
      window.setTimeout(() => {
        heroGallery.classList.remove("is-swapping");
      }, 1200);
    };

    triggerHeroSwap();
    window.setInterval(triggerHeroSwap, 8000);
  }

  /* ---------------------------------------------------------
     Modal détails tarifaires
     --------------------------------------------------------- */
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalBody = document.getElementById("modalBody");

  function openDetails(id){
    const p = catalogProducts().find(x=>x.id===id);
    if(!p || !p.details) return;
    const groups = p.details.groups.map(g => `
      <div class="modal-group">
        <h4>${g.h}</h4>
        <table class="price-table">
          ${g.rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}
        </table>
      </div>`).join("");
    modalBody.innerHTML = `
      <div class="m-head">
        <h3>${p.details.title}</h3>
        <button class="modal-close" aria-label="Fermer">&times;</button>
      </div>
      ${groups}`;
    modalBackdrop.classList.add("open");
    modalBody.querySelector(".modal-close").addEventListener("click", closeDetails);
  }
  function closeDetails(){ modalBackdrop.classList.remove("open"); }
  modalBackdrop.addEventListener("click", (e)=>{ if(e.target === modalBackdrop) closeDetails(); });
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape"){ closeDetails(); closeCart(); } });

  /* ---------------------------------------------------------
     Panier
     --------------------------------------------------------- */
  const cartDrawer = document.getElementById("cartDrawer");
  const cartBackdrop = document.getElementById("cartBackdrop");
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const cartCountEls = document.querySelectorAll(".cart-count");
  const cartEmptyState = document.getElementById("cartEmpty");
  const cartFoot = document.getElementById("cartFoot");

  function priceToNumber(str){
    const digits = str.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function addToCart(id){
    const product = catalogProducts().find(p=>p.id===id);
    if(!product) return;
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    renderCart();
    showToast(`${product.name} ajouté au panier`);
    openCart();
  }

  function changeQty(id, delta){
    if(!cart[id]) return;
    cart[id] += delta;
    if(cart[id] <= 0) delete cart[id];
    saveCart();
    renderCart();
  }

  function removeItem(id){
    delete cart[id];
    saveCart();
    renderCart();
  }

  function cartTotal(){
    let total = 0;
    const products = catalogProducts();
    Object.keys(cart).forEach(id=>{
      const p = products.find(x=>x.id===id);
      if(p) total += priceToNumber(p.price) * cart[id];
    });
    return total;
  }

  function cartCount(){
    return Object.values(cart).reduce((a,b)=>a+b,0);
  }

  function renderCart(){
    const ids = Object.keys(cart);
    cartCountEls.forEach(el=> el.textContent = cartCount());

    if(ids.length === 0){
      cartItemsEl.innerHTML = "";
      cartEmptyState.style.display = "block";
      cartFoot.style.display = "none";
      return;
    }
    cartEmptyState.style.display = "none";
    cartFoot.style.display = "block";

    cartItemsEl.innerHTML = ids.map(id=>{
      const p = catalogProducts().find(x=>x.id===id);
      if(!p) return "";
      const media = p.img ? `<img src="${p.img}" alt="${p.name}" loading="lazy">` : ICONS[p.icon];
      return `
      <div class="cart-item" data-id="${id}">
        <div class="thumb">${media}</div>
        <div class="info">
          <h4>${p.name}</h4>
          <span>${p.price}</span>
          <div class="qty-stepper">
            <button class="qty-minus" aria-label="Diminuer la quantité">&minus;</button>
            <span class="qty-val">${cart[id]}</span>
            <button class="qty-plus" aria-label="Augmenter la quantité">+</button>
            <button class="remove-item">retirer</button>
          </div>
        </div>
      </div>`;
    }).join("");

    cartItemsEl.querySelectorAll(".cart-item").forEach(item=>{
      const id = item.dataset.id;
      item.querySelector(".qty-plus").addEventListener("click", ()=>changeQty(id, 1));
      item.querySelector(".qty-minus").addEventListener("click", ()=>changeQty(id, -1));
      item.querySelector(".remove-item").addEventListener("click", ()=>removeItem(id));
    });

    cartTotalEl.textContent = cartTotal().toLocaleString("fr-FR") + " F";
  }

  function openCart(){
    cartDrawer.classList.add("open");
    cartBackdrop.classList.add("open");
  }
  function closeCart(){
    cartDrawer.classList.remove("open");
    cartBackdrop.classList.remove("open");
  }

  document.querySelectorAll("[data-open-cart]").forEach(el=> el.addEventListener("click", openCart));
  document.getElementById("cartClose").addEventListener("click", closeCart);
  cartBackdrop.addEventListener("click", closeCart);

  document.getElementById("whatsappOrderBtn").addEventListener("click", ()=>{
    const ids = Object.keys(cart);
    const products = catalogProducts();
    if(ids.length === 0) return;
    let lines = ["Bonjour DORCASHOP, je souhaite commander :"];
    ids.forEach(id=>{
      const p = products.find(x=>x.id===id);
      if(p) lines.push(`- ${p.name} x${cart[id]} (${p.price})`);
    });
    const estimatedTotal = cartTotal();
    lines.push(`Total estimé : ${estimatedTotal.toLocaleString("fr-FR")} F`);
    const message = encodeURIComponent(lines.join("\n"));
    if (window.DORCASHOPStore.trackOrderIntent) {
      window.DORCASHOPStore.trackOrderIntent(getVisitorId(), cartCount(), estimatedTotal);
    }
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  });

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(msg){
    toast.querySelector("span").textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toast.classList.remove("show"), 2400);
  }

  function showStoredToastIfAny(){
    try {
      const message = window.localStorage.getItem("dorcashop_admin_toast_v1");
      if (!message) return;
      window.localStorage.removeItem("dorcashop_admin_toast_v1");
      showToast(message);
    } catch (error) {
      // ignore storage restrictions
    }
  }

  /* ---------------------------------------------------------
     Menu mobile
     --------------------------------------------------------- */
  const hamburger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("mobileNav");
  hamburger.addEventListener("click", ()=>{
    const open = hamburger.classList.toggle("open");
    mobileNav.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  mobileNav.querySelectorAll("a").forEach(a=>{
    a.addEventListener("click", ()=>{
      hamburger.classList.remove("open");
      mobileNav.classList.remove("open");
      document.body.style.overflow = "";
    });
  });

  /* ---------------------------------------------------------
     Retour en haut
     --------------------------------------------------------- */
  const toTopBtn = document.getElementById("toTop");
  window.addEventListener("scroll", ()=>{
    toTopBtn.classList.toggle("show", window.scrollY > 600);
  }, { passive:true });
  toTopBtn.addEventListener("click", ()=> window.scrollTo({ top:0, behavior:"smooth" }));

  /* ---------------------------------------------------------
     Apparition immédiate
     --------------------------------------------------------- */
  document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */
  syncCatalogFromServer();
  renderGrid();
  renderPromoGrid();
  renderCart();
  showStoredToastIfAny();
})();
