(function(){
  "use strict";

  const WHATSAPP_NUMBER = "22947136292"; // 01 47 13 62 92 au format international
  const CART_KEY = "dorcashop_cart_v1";

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
    const barColor = CAT_COLORS[p.cats[0]] || "#142343";
    const badge = p.badge ? `<span class="card-badge ${badgeClass(p.badge)}">${p.badge}</span>` : "";
    const detailsBtn = p.details ? `<button class="details-btn" data-id="${p.id}" aria-label="Voir les tarifs détaillés de ${p.name}">+</button>` : "";
    const gros = p.priceGros ? `<div class="card-gros">Gros : ${p.priceGros}</div>` : "";
    const isPromo = Boolean(p.badge);
    const priceClass = '';
    return `
    <article class="product-card" data-id="${p.id}" data-cats="${p.cats.join(" ")}" data-name="${p.name.toLowerCase()}">
      <div class="card-cat-bar" style="background:${barColor}"></div>
      <div class="card-media">
        ${badge}
        ${detailsBtn}
        ${cardMedia(p)}
      </div>
      <div class="card-body">
        <h4>${p.name}</h4>
        <p class="card-desc">${p.desc}</p>
        <div class="card-price-row">
          <div>
            <span class="card-price ${priceClass}">${p.price}</span>
            <small>${p.priceNote || ""}</small>
          </div>
        </div>
        ${gros}
        <button class="card-order-btn" data-id="${p.id}">Commander</button>
      </div>
    </article>`;
  }

  function renderGrid(){
    grid.innerHTML = PRODUCTS.map(productCardHTML).join("");
    applyFilters();
    bindCardEvents();
  }

  function renderPromoGrid(){
    const promoGrid = document.getElementById("promoGrid");
    if(!promoGrid) return;
    const picks = PRODUCTS.filter(p=>p.badge).slice(0,4);
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

  /* ---------------------------------------------------------
     Images de famille défilables manuellement par balayage
     --------------------------------------------------------- */
  document.querySelectorAll(".cat-card[data-images]").forEach((card)=>{
    const images = (card.dataset.images || "").split("|").map(s => s.trim()).filter(Boolean);
    if (images.length < 2) return;

    const imgWrap = card.querySelector(".img-wrap");
    if (!imgWrap) return;

    const existingImg = imgWrap.querySelector("img");
    if (existingImg) existingImg.remove();

    const slides = images.map((src, index)=>{
      const img = new Image();
      img.src = src;
      img.alt = card.querySelector("h3")?.textContent || "";
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
    const p = PRODUCTS.find(x=>x.id===id);
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
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    renderCart();
    showToast(`${PRODUCTS.find(p=>p.id===id).name} ajouté au panier`);
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
    Object.keys(cart).forEach(id=>{
      const p = PRODUCTS.find(x=>x.id===id);
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
      const p = PRODUCTS.find(x=>x.id===id);
      if(!p) return "";
      const media = p.img ? `<img src="${p.img}" alt="${p.name}">` : ICONS[p.icon];
      return `
      <div class="cart-item" data-id="${id}">
        <div class="thumb">${media}</div>
        <div class="info">
          <h5>${p.name}</h5>
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
    if(ids.length === 0) return;
    let lines = ["Bonjour DORCASHOP, je souhaite commander :"];
    ids.forEach(id=>{
      const p = PRODUCTS.find(x=>x.id===id);
      if(p) lines.push(`- ${p.name} x${cart[id]} (${p.price})`);
    });
    lines.push(`Total estimé : ${cartTotal().toLocaleString("fr-FR")} F`);
    const message = encodeURIComponent(lines.join("\n"));
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
  renderGrid();
  renderPromoGrid();
  renderCart();
})();
