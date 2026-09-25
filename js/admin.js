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

    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        errorBox.hidden = false;
        errorBox.textContent = "Veuillez renseigner votre username et votre mot de passe.";
        return;
      }

      if (store.loginAdmin(username, password)) {
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
  const logoutBtn = document.getElementById("logoutBtn");
  const confirmBackdrop = document.getElementById("adminConfirmBackdrop");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

  const state = {
    editingId: null,
    pendingImage: "",
    pendingDeleteId: null
  };

  function setGlobalMessage(type, text) {
    if (!globalMessage) {
      return;
    }

    globalMessage.className = `admin-message ${type}`;
    globalMessage.textContent = text || "";
    globalMessage.hidden = !text;
  }

  function renderProducts() {
    const products = store.getCatalogProducts();
    if (!existingProductsList) {
      return;
    }

    if (productCountBadge) {
      productCountBadge.textContent = `${products.length} produit(s)`;
    }

    existingProductsList.innerHTML = products.map((product) => {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    confirmBackdrop.hidden = false;
  }

  function closeDeleteConfirmation() {
    confirmBackdrop.hidden = true;
    state.pendingDeleteId = null;
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
      store.updateProduct(state.editingId, payload);
      setGlobalMessage("success", "Produit modifié avec succès.");
      renderProducts();
      resetForm();
      setTimeout(() => {
        setGlobalMessage("success", "Produit modifié avec succès.");
      }, 100);
      return;
    }

    store.createProduct(payload);
    setGlobalMessage("success", "Produit ajouté avec succès.");
    renderProducts();
    resetForm();
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  });

  cancelEditBtn.addEventListener("click", resetForm);

  confirmDeleteBtn.addEventListener("click", () => {
    const id = state.pendingDeleteId;
    if (!id) {
      closeDeleteConfirmation();
      return;
    }

    store.deleteProduct(id);
    renderProducts();
    closeDeleteConfirmation();
    setGlobalMessage("success", "Produit supprimé avec succès.");
  });

  cancelDeleteBtn.addEventListener("click", closeDeleteConfirmation);
  confirmBackdrop.addEventListener("click", (event) => {
    if (event.target === confirmBackdrop) {
      closeDeleteConfirmation();
    }
  });

  logoutBtn.addEventListener("click", () => {
    store.logoutAdmin();
    window.location.href = "admin-login.html";
  });

  renderProducts();
})();
