/* WapMarket — Frontend glue code (robusto a varias formas de respuesta)
   Conecta index.html, login.html, seller.html y admin.html al backend.
   Adaptado para endpoints que devuelven { products: [...] }, { data: [...] }, { items: [...] } o arrays.  */

/* =========================
   Config
========================== */
const API = "https://backend-wapmarket-production.up.railway.app/api";

const PATHS = {
  login: "/auth/login",
  signup: "/auth/signup",
  businesses: "/businesses",
  products: "/products",
  orders: "/orders",
  adminCreateSeller: "/admin/sellers",
  adminUsers: "/admin/users",
  sellerProducts: "/seller/products",
  sellerOrders: "/seller/orders",
};

/* =========================
   Utilidades
========================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getArray(payload, keys = []) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const k of keys) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  // fallback comunes
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch (_) {}
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  // Algunos endpoints pueden devolver 204
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("wap_token");
  const base = { "Content-Type": "application/json", ...extra };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("wap_user") || "null");
  } catch {
    return null;
  }
}

function saveUser(user, token) {
  localStorage.setItem("wap_user", JSON.stringify(user || null));
  if (token) localStorage.setItem("wap_token", token);
}

function logout() {
  localStorage.removeItem("wap_user");
  localStorage.removeItem("wap_token");
  window.location.href = "index.html";
}

/* =========================
   Estado
========================== */
let productsCache = [];
let cart = loadCart();

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("wap_cart") || "[]");
  } catch {
    return [];
  }
}
function saveCart() {
  localStorage.setItem("wap_cart", JSON.stringify(cart));
  updateCartBadge();
}

/* =========================
   Render en la barra (usuario)
========================== */
function renderUserInNav() {
  const nav = $(".nav");
  if (!nav) return;
  const user = readUser();

  // Encontrar el enlace "Entrar" si existe
  const loginLink = Array.from(nav.querySelectorAll("a")).find(a =>
    (a.getAttribute("href") || "").toLowerCase().includes("login.html")
  );

  if (user) {
    // Reemplazar por saludo + salir
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = ".6rem";
    wrapper.style.alignItems = "center";

    const hello = document.createElement("span");
    hello.textContent = `Hola, ${user.name || user.email || "usuario"}`;

    const dashLinks = document.createElement("div");
    dashLinks.style.display = "flex";
    dashLinks.style.gap = ".5rem";

    // Accesos rápidos según rol
    if (user.role === "admin") {
      const a = document.createElement("a");
      a.href = "admin.html";
      a.textContent = "Admin";
      dashLinks.appendChild(a);
    }
    if (user.role === "seller") {
      const a = document.createElement("a");
      a.href = "seller.html";
      a.textContent = "Vendedor";
      dashLinks.appendChild(a);
    }

    const outBtn = document.createElement("button");
    outBtn.textContent = "Salir";
    outBtn.onclick = logout;

    wrapper.appendChild(hello);
    if (dashLinks.children.length) wrapper.appendChild(dashLinks);
    wrapper.appendChild(outBtn);

    if (loginLink) {
      loginLink.replaceWith(wrapper);
    } else {
      nav.appendChild(wrapper);
    }
  } else {
    // Si no hay usuario, aseguramos que exista "Entrar"
    if (!loginLink) {
      const a = document.createElement("a");
      a.href = "login.html";
      a.textContent = "Entrar";
      nav.insertBefore(a, nav.firstChild);
    }
  }
}

/* =========================
   Productos + Negocios (Home)
========================== */
async function loadProducts() {
  const list = $("#productsList");
  if (!list) return;
  try {
    const data = await fetchJson(`${API}${PATHS.products}`);
    // Adaptado a {products: [...]}, {data: [...]}, {items: [...]}, o array directo
    productsCache = getArray(data, ["products"]);
    // Normalizar campos mínimos
    productsCache = productsCache.map(p => ({
      id: p.id,
      title: p.title || p.name || "Producto",
      price_xaf: p.price_xaf ?? p.price ?? 0,
      image_url: p.image_url || "",
      stock: p.stock ?? 0,
      category: p.category || "",
      raw: p,
    }));
    renderProducts(productsCache);
    loadCategories(productsCache);
  } catch (e) {
    console.error("Products error:", e);
    list.innerHTML = "<p>No se pudieron cargar los productos.</p>";
  }
}

function renderProducts(items) {
  const list = $("#productsList");
  if (!list) return;
  if (!items?.length) {
    list.innerHTML = "<p>No hay productos para mostrar.</p>";
    return;
  }
  list.innerHTML = items
    .map(
      (p) => `
      <div class="product-card">
        <img src="${p.image_url || "https://via.placeholder.com/220x160?text=Producto"}" alt="${escapeHtml(p.title)}"/>
        <div class="product-info">
          <div class="product-title">${escapeHtml(p.title)}</div>
          <div class="product-price">${fmtXAF(p.price_xaf)} XAF</div>
          <button class="product-btn" data-id="${p.id}">Añadir</button>
        </div>
      </div>
    `
    )
    .join("");

  // Bind botones "Añadir"
  $$("#productsList .product-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const prod = productsCache.find((x) => x.id === id);
      if (!prod) return;
      addToCart(prod);
      openCart();
    });
  });
}

async function loadBusinesses() {
  const container = $("#businessesSection");
  if (!container) return;
  try {
    const data = await fetchJson(`${API}${PATHS.businesses}`);
    const businesses = getArray(data, ["businesses", "stores"]);
    if (!businesses.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <h3>Negocios</h3>
      <div class="business-list">
        ${businesses
          .map(
            (b) => `
          <div class="business-item">
            <img src="${b.logo_url || "https://via.placeholder.com/32"}" alt="">
            <div class="business-name">${escapeHtml(b.name || "Tienda")}</div>
            <div class="business-category">${escapeHtml(b.category || "")}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  } catch (e) {
    // Si el endpoint no existe o es privado, no rompemos la UI.
    console.warn("Businesses error (no bloqueante):", e.message);
    container.innerHTML = "";
  }
}

function loadCategories(list) {
  const sel = $("#categoryFilter");
  if (!sel) return;
  const cats = Array.from(
    new Set(list.map((p) => (p.category || "").trim()).filter(Boolean))
  );
  sel.innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

/* =========================
   Filtros + Búsqueda (Home)
========================== */
function setupFilters() {
  const searchInput = $("#searchInput");
  const searchBtn = $("#searchBtn");
  const cat = $("#categoryFilter");
  const min = $("#minPriceFilter");
  const max = $("#maxPriceFilter");
  if (!$("#productsList")) return;

  function apply() {
    let q = (searchInput?.value || "").toLowerCase().trim();
    let c = (cat?.value || "").toLowerCase();
    let minV = Number(min?.value || 0) || 0;
    let maxV = Number(max?.value || 0) || Number.MAX_SAFE_INTEGER;

    let filtered = productsCache.filter((p) => {
      const okQ =
        !q ||
        (p.title || "").toLowerCase().includes(q);
      const okC = !c || (p.category || "").toLowerCase() === c;
      const okPrice = p.price_xaf >= minV && p.price_xaf <= maxV;
      return okQ && okC && okPrice;
    });
    renderProducts(filtered);
  }

  searchBtn?.addEventListener("click", apply);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") apply();
  });
  cat?.addEventListener("change", apply);
  min?.addEventListener("input", apply);
  max?.addEventListener("input", apply);
}

/* =========================
   Carrito + Checkout (Home)
========================== */
function updateCartBadge() {
  const el = $("#cartCount");
  if (el) el.textContent = String(cart.reduce((a, c) => a + c.qty, 0));
}

function addToCart(prod) {
  const idx = cart.findIndex((c) => c.id === prod.id);
  if (idx >= 0) {
    cart[idx].qty++;
  } else {
    cart.push({ id: prod.id, title: prod.title, price: prod.price_xaf, qty: 1 });
  }
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((c) => c.id !== id);
  saveCart();
  renderCart();
}

function setQty(id, qty) {
  const it = cart.find((c) => c.id === id);
  if (!it) return;
  it.qty = Math.max(1, Number(qty) || 1);
  saveCart();
  renderCart();
}

function cartSubtotal() {
  return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

function renderCart() {
  const itemsEl = $("#cartItems");
  const sub = $("#subtotalXAF");
  if (!itemsEl) return;
  if (!cart.length) {
    itemsEl.innerHTML = "<p>Tu carrito está vacío.</p>";
  } else {
    itemsEl.innerHTML = cart
      .map(
        (c) => `
      <div class="cart-row">
        <div class="cart-title">${escapeHtml(c.title)}</div>
        <div class="cart-controls">
          <input type="number" min="1" value="${c.qty}" data-id="${c.id}" class="qty-input" />
          <div class="cart-price">${fmtXAF(c.price * c.qty)} XAF</div>
          <button class="remove-item" data-id="${c.id}">Eliminar</button>
        </div>
      </div>
    `
      )
      .join("");
    // Bind
    $$("#cartItems .qty-input").forEach((inp) => {
      inp.addEventListener("input", () => {
        setQty(Number(inp.dataset.id), Number(inp.value));
      });
    });
    $$("#cartItems .remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeFromCart(Number(btn.dataset.id));
      });
    });
  }
  if (sub) sub.textContent = fmtXAF(cartSubtotal());
  updateCheckoutSummary();
}

function openCart() {
  $("#cartDrawer")?.classList.remove("hidden");
}
function closeCart() {
  $("#cartDrawer")?.classList.add("hidden");
}
function openCheckout() {
  $("#checkoutModal")?.classList.remove("hidden");
  updateCheckoutSummary();
}
function closeCheckout() {
  $("#checkoutModal")?.classList.add("hidden");
}

function setupCartUI() {
  $("#cartBtn")?.addEventListener("click", openCart);
  $("#closeCart")?.addEventListener("click", closeCart);
  $("#checkoutOpen")?.addEventListener("click", () => {
    closeCart();
    openCheckout();
  });
  $("#closeCheckout")?.addEventListener("click", closeCheckout);
  renderCart();
}

/* ===== Checkout ===== */
function deliveryFee() {
  const sel = $("#fulfillmentType");
  const type = sel?.value || "pickup";
  return type === "delivery" ? 2000 : 0;
}

function updateCheckoutSummary() {
  const sub = cartSubtotal();
  const del = deliveryFee();
  const total = sub + del;
  const eSub = $("#coSubtotal");
  const eDel = $("#coDelivery");
  const eTot = $("#coTotal");
  if (eSub) eSub.textContent = fmtXAF(sub);
  if (eDel) eDel.textContent = fmtXAF(del);
  if (eTot) eTot.textContent = fmtXAF(total);
}

function setupCheckoutForm() {
  if (!$("#checkoutForm")) return;
  $("#fulfillmentType")?.addEventListener("change", updateCheckoutSummary);

  $("#checkoutForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cart.length) {
      alert("Tu carrito está vacío.");
      return;
    }
    const fd = new FormData(e.target);
    const user = readUser();

    const payload = {
      items: cart.map((c) => ({ product_id: c.id, quantity: c.qty })),
      fulfillment_type: fd.get("fulfillment_type") || "pickup",
      address: fd.get("address") || "",
      contact_name: (fd.get("guest_name") || user?.name || "").toString(),
      contact_phone: (fd.get("guest_phone") || user?.phone || "").toString(),
      // En caso de que el backend espere totales, los incluimos:
      subtotal_xaf: cartSubtotal(),
      delivery_xaf: deliveryFee(),
      total_xaf: cartSubtotal() + deliveryFee(),
    };

    try {
      const res = await fetchJson(`${API}${PATHS.orders}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      alert("¡Pedido confirmado! Gracias por tu compra.");
      cart = [];
      saveCart();
      renderCart();
      closeCheckout();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el pedido. Revisa tus datos e inténtalo de nuevo.");
    }
  });
}

/* =========================
   Login / Signup (login.html)
========================== */
function setupAuth() {
  const loginForm = $("#loginForm");
  const signupForm = $("#signupForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const body = {
        email: (fd.get("email") || "").toString().trim(),
        password: (fd.get("password") || "").toString(),
      };
      try {
        const data = await fetchJson(`${API}${PATHS.login}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        // Esperamos { token, user }
        const token = data?.token;
        const user = data?.user || null;
        if (!token || !user) throw new Error("Respuesta de login inesperada.");
        saveUser(user, token);
        window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        alert("No se pudo iniciar sesión. Verifica tus credenciales.");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(signupForm);
      const body = {
        name: (fd.get("name") || "").toString().trim(),
        phone: (fd.get("phone") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        password: (fd.get("password") || "").toString(),
      };
      try {
        const data = await fetchJson(`${API}${PATHS.signup}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        // Si el backend devuelve {token, user} tras registrarse:
        if (data?.token && data?.user) {
          saveUser(data.user, data.token);
          window.location.href = "index.html";
          return;
        }
        // si no devuelve token, pedimos hacer login
        alert("Registro correcto. Ahora puedes iniciar sesión.");
        window.location.href = "login.html";
      } catch (err) {
        console.error(err);
        alert("No se pudo registrar. Revisa los datos.");
      }
    });
  }
}

/* =========================
   Vendedor (seller.html)
========================== */
async function sellerLoadProducts() {
  const box = $("#sellerProducts");
  if (!box) return;
  try {
    const data = await fetchJson(`${API}${PATHS.sellerProducts}`, {
      headers: authHeaders(),
    });
    const arr = getArray(data, ["products"]);
    if (!arr.length) {
      box.innerHTML = "<p>No tienes productos aún.</p>";
      return;
    }
    box.innerHTML = arr
      .map((p) => {
        const price = p.price_xaf ?? p.price ?? 0;
        return `
        <div class="product-card">
          <img src="${p.image_url || "https://via.placeholder.com/220x160"}" />
          <div class="product-info">
            <div class="product-title">${escapeHtml(p.title || p.name || "Producto")}</div>
            <div class="product-price">${fmtXAF(price)} XAF</div>
            <div>Stock: ${p.stock ?? 0}</div>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (e) {
    console.error("seller products:", e);
    $("#sellerProducts").innerHTML = "<p>Error al cargar productos.</p>";
  }
}

async function sellerLoadOrders() {
  const box = $("#sellerOrders");
  if (!box) return;
  try {
    const data = await fetchJson(`${API}${PATHS.sellerOrders}`, {
      headers: authHeaders(),
    });
    const arr = getArray(data, ["orders"]);
    if (!arr.length) {
      box.innerHTML = "<p>No tienes pedidos aún.</p>";
      return;
    }
    box.innerHTML = `
      <table>
        <thead>
          <tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Total</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${arr
            .map(
              (o) => `
            <tr>
              <td>${o.id ?? ""}</td>
              <td>${escapeHtml(o.contact_name || "")}</td>
              <td>${escapeHtml(o.contact_phone || "")}</td>
              <td>${fmtXAF(o.total_xaf ?? 0)} XAF</td>
              <td>${escapeHtml(o.status || "")}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error("seller orders:", e);
    box.innerHTML = "<p>Error al cargar pedidos.</p>";
  }
}

function setupSellerForm() {
  const form = $("#newProductForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      title: (fd.get("title") || "").toString().trim(),
      price_xaf: Number(fd.get("price_xaf") || 0),
      image_url: (fd.get("image_url") || "").toString().trim(),
      stock: Number(fd.get("stock") || 0),
      description: (fd.get("description") || "").toString().trim(),
    };
    try {
      await fetchJson(`${API}${PATHS.sellerProducts}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      form.reset();
      await sellerLoadProducts();
      alert("Producto añadido.");
    } catch (e2) {
      console.error(e2);
      alert("No se pudo añadir el producto.");
    }
  });
}

/* =========================
   Admin (admin.html)
========================== */
function setupAdmin() {
  const form = $("#createSellerForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        password: (fd.get("password") || "").toString(),
        store_name: (fd.get("store_name") || "").toString().trim(),
        city: (fd.get("city") || "").toString().trim(),
        description: (fd.get("description") || "").toString().trim(),
      };
      try {
        await fetchJson(`${API}${PATHS.adminCreateSeller}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        alert("Vendedor creado con su tienda.");
        form.reset();
      } catch (e2) {
        console.error(e2);
        alert("No se pudo crear el vendedor.");
      }
    });
  }

  $("#refreshUsers")?.addEventListener("click", loadUsersAdmin);
}

async function loadUsersAdmin() {
  const box = $("#usersTable");
  if (!box) return;
  try {
    const data = await fetchJson(`${API}${PATHS.adminUsers}`, {
      headers: authHeaders(),
    });
    const users = getArray(data, ["users"]);
    if (!users.length) {
      box.innerHTML = "<p>Sin usuarios.</p>";
      return;
    }
    box.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
        <tbody>
          ${users
            .map(
              (u) => `
            <tr>
              <td>${u.id ?? ""}</td>
              <td>${escapeHtml(u.name || "")}</td>
              <td>${escapeHtml(u.email || "")}</td>
              <td>${escapeHtml(u.role || "")}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error(e);
    box.innerHTML = "<p>Error al cargar usuarios.</p>";
  }
}

/* =========================
   Helpers varios
========================== */
function fmtXAF(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-GQ");
}
function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

/* =========================
   Boot
========================== */
document.addEventListener("DOMContentLoaded", () => {
  renderUserInNav();

  // Home (index.html) — IDs presentes en el archivo
  if ($("#productsList")) { // products grid existe -> estamos en Home
    loadProducts();        // lee {products:[...]} del backend
    loadBusinesses();      // silencioso si falla
    setupFilters();
    setupCartUI();
    setupCheckoutForm();
  }

  // Login page
  if ($("#loginForm") || $("#signupForm")) {
    setupAuth();
  }

  // Seller page
  if ($("#newProductForm") || $("#sellerProducts") || $("#sellerOrders")) {
    setupSellerForm();
    sellerLoadProducts();
    sellerLoadOrders();
  }

  // Admin page
  if ($("#createSellerForm")) {
    setupAdmin();
    loadUsersAdmin();
  }
});
