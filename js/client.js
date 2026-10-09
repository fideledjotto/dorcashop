(async function () {
  "use strict";

  const store = window.DORCASHOPStore;
  const session = await store.getAccountSession();
  if (!session.authenticated || !session.account) {
    window.location.replace("index.html#connexion");
    return;
  }
  if (session.account.role === "admin") {
    window.location.replace("administration.html");
    return;
  }

  document.getElementById("clientLoading").hidden = true;
  document.getElementById("clientContent").hidden = false;
  document.getElementById("clientName").textContent = session.account.name;
  document.getElementById("clientProfileName").textContent = session.account.name;
  document.getElementById("clientEmail").textContent = session.account.email;

  document.getElementById("clientLogout").addEventListener("click", async () => {
    await store.logoutAccount();
    window.location.replace("index.html");
  });
})();