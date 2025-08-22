/* app.js — WapMarket (frontend conectado al backend)
   Coloca este archivo en la raíz del repo (junto a index.html, login.html, seller.html, admin.html, styles.css)
*/

const API_BASE = "https://backend-wapmarket-production.up.railway.app/api";

// ---------------------- Utilidades básicas ----------------------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function getAuth() {
  const token = localStorage.getItem("wap_token");
  const userRaw = localStorage.getItem("wap_user");
  let user = null;
  try { user = JSON.parse(userRaw || "null"); } catch {}
  return { token, user };
}

function authHeaders(extra = {}) {
  const { token } = getAuth();
  const headers = { "Content-Type": "application/json", ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function tryFetch(url, opts = {}, fallbacks = []) {
  // Intenta url y, si falla, prueba rutas alternativas
  const sequence = [url, ...fallbacks];
  let lastErr;
  for (const u of sequence) {
    try {
      const res = await fetch(u, opts);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json().catch(() => ({}));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------------------- Carrito (guest-friendly) ----------------------
function loadCart() {
  try { return JSON.parse(localStorage.getItem("wap_cart") || "[]"); } catch { return []; }
}
function saveCart(items) {
  localStorage.setItem("wap_cart", JSON.stringify(items));
  updateCartCount();
}
function clearCart() { saveCart([]); }
function addToCart(product) {
  const cart = loadCart();
  const idx = cart.findIndex(i => i.id === product.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id: product.id, title: product.title || product.name, price_xaf: product.price_xaf ?? product.price, image_url: product.image_url, qty: 1 });
  saveCart(cart);
}
function updateCartCount() {
  const el = $("#cartCount");
  if (el) el.textContent = loadCart().reduce((s, i) => s + i.qty, 0);
}
function cartSubtotalXAF() {
  return loadCart().reduce((s, i) => s + (Number(i.price_xaf || 0) * Number(i.qty || 0)), 0);
}

// ---------------------- API helpers ----------------------
const api = {
  // Productos listados públicamente
  async products() {
    const data = await tryFetch(`${API_BASE}/products`, { headers: authHeaders() });
    // backend devuelve {products:[...]} según tu ejemplo
    return Array.isArray(data) ? data : (data.products || []);
  },

  // Tiendas/negocios (sidebar). Si no existe endpoint, simplemente no se muestra.
  async stores() {
    try {
      const data = await tryFetch(`${API_BASE}/stores`, { headers: authHeaders() }, [
        `${API_BASE}/businesses`,
        `${API_BASE}/shops`
      ]);
      return Array.isArray(data) ? data : (data.stores || data.businesses || data.shops || []);
    } catch {
      return [];
    }
  },

  // Pedido (sin login permitido)
  async createOrder(payload) {
    return await tryFetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }, [
      `${API_BASE}/checkout`
    ]);
  },

  // Auth
  async login(email, password) {
    const data = await tryFetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    }, [
      `${API_BASE}/login`
    ]);
    return data;
  },
  async register(user) {
    const data = await tryFetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(user)
    }, [
      `${API_BASE}/register`
    ]);
    return data;
  },

  // Seller
  seller: {
    async myProducts() {
      const data = await tryFetch(`${API_BASE}/seller/products`, { headers: authHeaders() }, [
        `${API_BASE}/products?mine=1`
      ]);
      return Array.isArray(data) ? data : (data.products || []);
    },
    async newProduct(p) {
      return await tryFetch(`${API_BASE}/seller/products`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(p)
      }, [
        `${API_BASE}/products`
      ]);
    },
    async myOrders() {
      const data = await tryFetch(`${API_BASE}/seller/orders`, { headers: authHeaders() }, [
        `${API_BASE}/orders?mine=1`
      ]);
      return Array.isArray(data) ? data : (data.orders || []);
    }
  },

  // Admin
  admin: {
    async createSeller(payload) {
      return await tryFetch(`${API_BASE}/admin/create-seller`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      }, [
        `${API_BASE}/admin/sellers`
      ]);
    },
    async users() {
      const data = await tryFetch(`${API_BASE}/admin/users`, { headers: authHeaders() }, [
        `${API_BASE}/users`
      ]);
      return Array.isArray(data) ? data : (data.users || []);
    }
  }
};

// ---------------------- Render helpers (Index) ----------------------
function renderProducts(list, container) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div style="color:#666">No hay productos disponibles.</div>`;
    return;
  }
  for (const p of list) {
    const title = p.title || p.name || "Producto";
    const price = Number(p.price_xaf ?? p.price ?? 0);
    const img = p.image_url || "https://via.placeholder.com/300x200?text=Producto";
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${img}" alt="${title}"/>
      <div class="product-info">
        <div class="product-title">${title}</div>
        <div class="product-price">${price.toLocaleString()} XAF</div>
        <button class="product-btn">Añadir</button>
      </div>
    `;
    $("button", card).addEventListener("click", () => {
      addToCart({ id: p.id, title, price_xaf: price, image_url: img });
    });
    container.appendChild(card);
  }
}

function renderBusinesses(list, container) {
  // Estructura simple, solo si hay endpoint
  if (!container) return;
  container.innerHTML = `
    <h3>Negocios</h3>
    <div class="business-list"></div>
  `;
  const wrap = $(".business-list", container);
  if (!list.length) {
    wrap.innerHTML = `<div style="color:#666">Sin negocios</div>`;
    return;
  }
  for (const s of list) {
    const item = document.createElement("div");
    item.className = "business-item";
    const logo = s.logo_url || "https://via.placeholder.com/64?text=tienda";
    item.innerHTML = `
      <img src="${logo}" alt="${s.name || "Tienda"}"/>
      <div>
        <div class="business-name">${s.name || "Tienda"}</div>
        <div class="business-category">${s.category || ""}</div>
      </div>
    `;
    wrap.appendChild(item);
  }
}

function renderCart() {
  const drawer = $("#cartDrawer"); // :contentReference[oaicite:5]{index=5}
  const list = $("#cartItems");
  const subtotalEl = $("#subtotalXAF");
  const items = loadCart();

  list.innerHTML = "";
  for (const it of items) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = ".5rem";
    row.style.margin = ".35rem 0";
    row.innerHTML = `
      <img src="${it.image_url || "https://via.placeholder.com/64"}" alt="" style="width:48px;height:48px;object-fit:cover;background:#eee"/>
      <div style="flex:1">
        <div style="font-weight:600">${it.title}</div>
        <div style="font-size:.9rem;color:#555">${Number(it.price_xaf).toLocaleString()} XAF × ${it.qty}</div>
      </div>
      <div style="display:flex;gap:.35rem;align-items:center">
        <button class="minus">−</button>
        <span>${it.qty}</span>
        <button class="plus">+</button>
        <button class="remove" title="Quitar">✕</button>
      </div>
    `;
    $(".minus", row).addEventListener("click", () => { it.qty = Math.max(1, it.qty - 1); saveCart(items); renderCart(); });
    $(".plus", row).addEventListener("click", () => { it.qty += 1; saveCart(items); renderCart(); });
    $(".remove", row).addEventListener("click", () => {
      const left = items.filter(x => x.id !== it.id);
      saveCart(left); renderCart();
    });
    list.appendChild(row);
  }
  if (subtotalEl) subtotalEl.textContent = cartSubtotalXAF().toLocaleString();
  updateCheckoutSummary();
  if (drawer && drawer.classList.contains("hidden")) {
    // no auto abrir
  }
}

function updateCheckoutSummary() {
  const subtotal = cartSubtotalXAF();
  const typeSel = $("#fulfillmentType"); // :contentReference[oaicite:6]{index=6}
  const deliveryFee = (typeSel && typeSel.value === "delivery") ? 2000 : 0;
  const coSubtotal = $("#coSubtotal");
  const coDelivery = $("#coDelivery");
  const coTotal = $("#coTotal");
  if (coSubtotal) coSubtotal.textContent = subtotal.toLocaleString();
  if (coDelivery) coDelivery.textContent = deliveryFee.toLocaleString();
  if (coTotal) coTotal.textContent = (subtotal + deliveryFee).toLocaleString();
}

// ---------------------- Pages bootstrap ----------------------
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();

  const isIndex = !!$("#productsList");               // :contentReference[oaicite:7]{index=7}
  const isLogin = !!$("#loginForm") || !!$("#signupForm"); // :contentReference[oaicite:8]{index=8}
  const isSeller = !!$("#newProductForm");            // :contentReference[oaicite:9]{index=9}
  const isAdmin = !!$("#createSellerForm");           // :contentReference[oaicite:10]{index=10}

  if (isIndex) bootIndex();
  if (isLogin) bootLogin();
  if (isSeller) bootSeller();
  if (isAdmin) bootAdmin();
});

// ---------------------- Index ----------------------
async function bootIndex() {
  // Cargar productos
  const productsContainer = $("#productsList"); // :contentReference[oaicite:11]{index=11}
  const businessesSection = $("#businessesSection"); // :contentReference[oaicite:12]{index=12}

  try {
    const [prods, stores] = await Promise.all([api.products(), api.stores()]);
    renderProducts(prods, productsContainer);
    renderBusinesses(stores, businessesSection);
  } catch (e) {
    productsContainer.innerHTML = `<div style="color:#c00">Error cargando productos</div>`;
    console.error(e);
  }

  // Búsqueda y filtros (locales)
  const searchInput = $("#searchInput");
  const searchBtn = $("#searchBtn");
  let currentProducts = [];
  try { currentProducts = await api.products(); } catch {}

  const applyFilters = () => {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const min = Number($("#minPriceFilter")?.value || 0);
    const max = Number($("#maxPriceFilter")?.value || 999999999);
    const cat = $("#categoryFilter")?.value || "";

    const filtered = currentProducts.filter(p => {
      const t = (p.title || p.name || "").toLowerCase();
      const price = Number(p.price_xaf ?? p.price ?? 0);
      const c = (p.category || "").toLowerCase();
      return (!q || t.includes(q)) && price >= min && price <= max && (!cat || c === cat.toLowerCase());
    });
    renderProducts(filtered, productsContainer);
  };
  if (searchBtn) searchBtn.addEventListener("click", applyFilters);
  if (searchInput) searchInput.addEventListener("keydown", e => { if (e.key === "Enter") applyFilters(); });

  // Drawer carrito
  const cartBtn = $("#cartBtn");
  const cartDrawer = $("#cartDrawer");
  const closeCart = $("#closeCart");
  if (cartBtn) cartBtn.addEventListener("click", () => { renderCart(); cartDrawer?.classList.remove("hidden"); });
  if (closeCart) closeCart.addEventListener("click", () => cartDrawer?.classList.add("hidden"));

  // Checkout modal
  const checkoutOpen = $("#checkoutOpen");
  const checkoutModal = $("#checkoutModal");
  const closeCheckout = $("#closeCheckout");
  const fulfillmentType = $("#fulfillmentType");
  if (checkoutOpen) checkoutOpen.addEventListener("click", () => { renderCart(); checkoutModal?.classList.remove("hidden"); });
  if (closeCheckout) closeCheckout.addEventListener("click", () => checkoutModal?.classList.add("hidden"));
  if (fulfillmentType) fulfillmentType.addEventListener("change", updateCheckoutSummary);

  const checkoutForm = $("#checkoutForm"); // :contentReference[oaicite:13]{index=13}
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const items = loadCart();
      if (!items.length) { alert("Tu carrito está vacío"); return; }

      const fd = new FormData(checkoutForm);
      const payload = {
        items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
        fulfillment_type: fd.get("fulfillment_type") || "pickup",
        address: fd.get("address") || null,
        guest_name: fd.get("guest_name") || null,
        guest_phone: fd.get("guest_phone") || null,
      };

      try {
        await api.createOrder(payload); // sin necesidad de token
        alert("¡Pedido enviado con éxito!");
        clearCart();
        checkoutModal?.classList.add("hidden");
        renderCart();
      } catch (err) {
        console.error(err);
        alert("No se pudo enviar el pedido.");
      }
    });
  }
}

// ---------------------- Login/Registro ----------------------
function bootLogin() {
  const loginForm = $("#loginForm");   // :contentReference[oaicite:14]{index=14}
  const signupForm = $("#signupForm"); // :contentReference[oaicite:15]{index=15}

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = fd.get("email");
      const password = fd.get("password");
      try {
        const data = await api.login(email, password);
        // Se guardan token y usuario devueltos por el backend
        if (data?.token) localStorage.setItem("wap_token", data.token);
        if (data?.user) localStorage.setItem("wap_user", JSON.stringify(data.user));

        // Redirección por rol:
        const role = data?.user?.role || "user";
        if (role === "seller") window.location.href = "seller.html";
        else if (role === "admin") window.location.href = "admin.html";
        else window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        alert("Credenciales inválidas");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(signupForm);
      const payload = {
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        phone: fd.get("phone")
      };
      try {
        const data = await api.register(payload);
        if (data?.token) localStorage.setItem("wap_token", data.token);
        if (data?.user) localStorage.setItem("wap_user", JSON.stringify(data.user));
        const role = data?.user?.role || "user";
        if (role === "seller") window.location.href = "seller.html";
        else if (role === "admin") window.location.href = "admin.html";
        else window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        alert("No se pudo crear la cuenta");
      }
    });
  }
}

// ---------------------- Seller Dashboard ----------------------
async function bootSeller() {
  const productsGrid = $("#sellerProducts"); // :contentReference[oaicite:16]{index=16}
  const ordersBox = $("#sellerOrders");      // :contentReference[oaicite:17]{index=17}
  const form = $("#newProductForm");         // :contentReference[oaicite:18]{index=18}

  async function refresh() {
    try {
      const [myProds, myOrders] = await Promise.all([api.seller.myProducts(), api.seller.myOrders()]);
      // Productos
      productsGrid.innerHTML = "";
      for (const p of myProds) {
        const card = document.createElement("div");
        card.className = "product";
        const title = p.title || p.name || "Producto";
        const price = Number(p.price_xaf ?? p.price ?? 0);
        const img = p.image_url || "https://via.placeholder.com/300x200?text=Producto";
        card.innerHTML = `
          <img src="${img}" alt="${title}"/>
          <div class="title">${title}</div>
          <div class="price">${price.toLocaleString()} XAF</div>
        `;
        productsGrid.appendChild(card);
      }
      // Pedidos
      ordersBox.innerHTML = "";
      if (!myOrders.length) {
        ordersBox.innerHTML = `<div style="color:#666">Sin pedidos por ahora.</div>`;
      } else {
        const tbl = document.createElement("table");
        tbl.innerHTML = `
          <thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th></tr></thead>
          <tbody></tbody>
        `;
        for (const o of myOrders) {
          const tr = document.createElement("tr");
          const total = Number(o.total_xaf ?? o.total ?? 0);
          const when = (o.created_at || "").replace("T"," ").slice(0,16);
          const buyer = o.buyer_name || o.customer_name || o.guest_name || "";
          const itemsTxt = (o.items || []).map(i => `${i.title || i.name} × ${i.quantity}`).join(", ");
          tr.innerHTML = `<td>${o.id || ""}</td><td>${when}</td><td>${buyer}</td><td>${itemsTxt}</td><td>${total.toLocaleString()} XAF</td>`;
          $("tbody", tbl).appendChild(tr);
        }
        ordersBox.appendChild(tbl);
      }
    } catch (e) {
      console.error(e);
      productsGrid.innerHTML = `<div style="color:#c00">Error cargando tus productos</div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get("title"),
        price_xaf: Number(fd.get("price_xaf") || 0),
        stock: Number(fd.get("stock") || 0),
        image_url: fd.get("image_url") || null,
        description: fd.get("description") || null
      };
      try {
        await api.seller.newProduct(payload);
        form.reset();
        await refresh();
        alert("Producto añadido");
      } catch (err) {
        console.error(err);
        alert("No se pudo crear el producto");
      }
    });
  }

  refresh();
}

// ---------------------- Admin ----------------------
function bootAdmin() {
  const form = $("#createSellerForm"); // :contentReference[oaicite:19]{index=19}
  const refreshBtn = $("#refreshUsers");  // :contentReference[oaicite:20]{index=20}
  const usersWrap = $("#usersTable");     // :contentReference[oaicite:21]{index=21}

  async function renderUsers() {
    usersWrap.innerHTML = "Cargando...";
    try {
      const list = await api.admin.users();
      const tbl = document.createElement("table");
      tbl.innerHTML = `<thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Tienda</th></tr></thead><tbody></tbody>`;
      for (const u of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.name || ""}</td>
          <td>${u.email || ""}</td>
          <td>${u.role || ""}</td>
          <td>${u.store?.name || u.store_name || ""}</td>
        `;
        $("tbody", tbl).appendChild(tr);
      }
      usersWrap.innerHTML = "";
      usersWrap.appendChild(tbl);
    } catch (e) {
      console.error(e);
      usersWrap.innerHTML = `<div style="color:#c00">No se pudieron cargar los usuarios</div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        store_name: fd.get("store_name"),
        city: fd.get("city"),
        description: fd.get("description")
      };
      try {
        await api.admin.createSeller(payload);
        alert("Vendedor creado");
        form.reset();
        renderUsers();
      } catch (e1) {
        console.error(e1);
        alert("No se pudo crear el vendedor");
      }
    });
  }

  if (refreshBtn) refreshBtn.addEventListener("click", renderUsers);
  renderUsers();
}
