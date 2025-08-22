/* ================== CONFIG ================== */
const API = "https://backend-wapmarket-production.up.railway.app/api";

/* Si tus rutas difieren, edítalas aquí en un solo sitio */
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

const TOKEN_KEY = "wap_token";
const USER_KEY  = "wap_user";

/* ================== HELPERS & STATE ================== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let productsCache = [];

/* Fetch con token si existe */
function authHeaders(extra = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)||"null"); }
  catch { return null; }
}

/* ================== HOME / CATÁLOGO ================== */
// index.html contiene contenedores para negocios, filtros, productos y el drawer de carrito. :contentReference[oaicite:4]{index=4}
async function loadBusinesses() {
  const box = $("#businessesSection");
  if (!box) return;
  try {
    const res = await fetch(`${API}${PATHS.businesses}`);
    const data = await res.json();
    box.innerHTML = `<h3>Negocios</h3>
      <div class="business-list">
        ${data.map(b=>`
          <div class="business-item">
            <img src="${b.logo_url || ""}" alt="">
            <div>
              <div class="business-name">${b.name || "Tienda"}</div>
              <div class="business-category">${b.category || ""}</div>
            </div>
          </div>`).join("")}
      </div>`;
  } catch (e) {
    console.error("Businesses error:", e);
    box.innerHTML = "<p>No se pudieron cargar los negocios.</p>";
  }
}

async function loadProducts() {
  const list = $("#productsList");
  if (!list) return;
  try {
    const res = await fetch(`${API}${PATHS.products}`);
    const data = await res.json();
    productsCache = Array.isArray(data) ? data : (data.items || []);
    renderProducts(productsCache);
    loadCategories(productsCache);
  } catch (e) {
    console.error("Products error:", e);
    list.innerHTML = "<p>No se pudieron cargar los productos.</p>";
  }
}

function renderProducts(arr) {
  const list = $("#productsList");
  if (!list) return;
  if (!arr?.length) {
    list.innerHTML = "<p>No hay productos disponibles.</p>";
    return;
  }
  list.innerHTML = arr.map(p => `
    <div class="product-card">
      <img src="${p.image_url || p.image || ""}" alt="">
      <div class="product-info">
        <div class="product-title">${p.name || p.title || "Producto"}</div>
        <div class="product-price">${(p.price_xaf ?? p.price ?? 0)} XAF</div>
        <button class="product-btn" data-id="${p.id}">Agregar al carrito</button>
      </div>
    </div>
  `).join("");

  // Listeners Agregar al carrito
  $$("#productsList .product-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const prod = productsCache.find(x => String(x.id) === String(id));
      if (prod) addToCart(prod);
    });
  });
}

function loadCategories(products) {
  const select = $("#categoryFilter");
  if (!select) return;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
  select.innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}
function applyFilters() {
  const q   = ($("#searchInput")?.value || "").toLowerCase();
  const cat = $("#categoryFilter")?.value || "";
  const min = parseInt($("#minPriceFilter")?.value || "0", 10);
  const max = parseInt($("#maxPriceFilter")?.value || "100000000", 10);
  const filtered = productsCache.filter(p => {
    const name = (p.name || p.title || "").toLowerCase();
    const price = (p.price_xaf ?? p.price ?? 0);
    return (!q || name.includes(q))
        && (!cat || p.category === cat)
        && price >= min && price <= max;
  });
  renderProducts(filtered);
}

/* ================== CARRITO & CHECKOUT ================== */
// index.html define #cartBtn, #cartDrawer, #checkoutForm, etc. :contentReference[oaicite:5]{index=5}
function persistCart() { localStorage.setItem("cart", JSON.stringify(cart)); }
function updateCartUI() {
  const countEl = $("#cartCount");
  if (countEl) countEl.textContent = cart.length;

  const items = $("#cartItems");
  if (!items) return;

  let subtotal = 0;
  items.innerHTML = cart.map((p, i) => {
    const price = (p.price_xaf ?? p.price ?? 0);
    subtotal += price;
    return `<div class="cart-item">
      <span>${p.name || p.title} — ${price} XAF</span>
      <button data-index="${i}">❌</button>
    </div>`;
  }).join("");

  // remove
  $$("#cartItems button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = +btn.getAttribute("data-index");
      cart.splice(i,1); persistCart(); updateCartUI();
    });
  });

  const coSub = $("#coSubtotal"), subX = $("#subtotalXAF");
  if (coSub) coSub.textContent = subtotal;
  if (subX) subX.textContent = subtotal;
  calcCheckoutTotal();
}
function addToCart(p) {
  cart.push({
    id: p.id,
    name: p.name || p.title,
    price: (p.price_xaf ?? p.price ?? 0),
    image_url: p.image_url || p.image || ""
  });
  persistCart(); updateCartUI();
}
function calcCheckoutTotal() {
  const subtotal = parseInt($("#coSubtotal")?.textContent || "0",10);
  const type = $("#fulfillmentType")?.value || "pickup";
  const delivery = type === "delivery" ? 2000 : 0;
  if ($("#coDelivery")) $("#coDelivery").textContent = delivery;
  if ($("#coTotal")) $("#coTotal").textContent = subtotal + delivery;
}

/* Envío de pedido (con o sin sesión) */
async function submitCheckout(e) {
  e?.preventDefault?.();
  if (!cart.length) return alert("El carrito está vacío");

  const form = $("#checkoutForm");
  const payload = form ? Object.fromEntries(new FormData(form).entries()) : {};
  payload.items = cart.map(p => ({ product_id: p.id, qty: 1, price_xaf: p.price }));
  try {
    const res = await fetch(`${API}${PATHS.orders}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`Pedido rechazado: ${t || res.status}`);
    }
    alert("✅ Pedido enviado");
    cart = []; persistCart(); updateCartUI();
    $("#checkoutModal")?.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("No se pudo procesar el pedido");
  }
}

/* ================== LOGIN / SIGNUP (login.html) ================== */
// login.html ya incluye #loginForm y #signupForm. :contentReference[oaicite:6]{index=6}
function attachAuthHandlers() {
  const lf = $("#loginForm");
  if (lf) {
    lf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(lf).entries());
      try {
        const res = await fetch(`${API}${PATHS.login}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const out = await res.json();
        if (!res.ok || !out.token) throw new Error(out.message || "Login inválido");
        setSession(out.token, out.user);
        window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        alert("Credenciales inválidas");
      }
    });
  }

  const sf = $("#signupForm");
  if (sf) {
    sf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(sf).entries());
      try {
        const res = await fetch(`${API}${PATHS.signup}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out.message || "Registro falló");
        // login directo si backend lo retorna
        if (out.token) setSession(out.token, out.user);
        alert("Cuenta creada");
        window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        alert("No se pudo crear la cuenta");
      }
    });
  }
}

/* ================== ADMIN (admin.html) ================== */
// admin.html contiene #createSellerForm, #refreshUsers, #usersTable. :contentReference[oaicite:7]{index=7}
function attachAdminHandlers() {
  const form = $("#createSellerForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch(`${API}${PATHS.adminCreateSeller}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("No se pudo crear el vendedor");
        alert("Vendedor creado");
        form.reset();
      } catch (err) {
        console.error(err);
        alert("Error creando vendedor");
      }
    });
  }

  const btn = $("#refreshUsers");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API}${PATHS.adminUsers}`, { headers: authHeaders() });
        const data = await res.json();
        const table = `
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
            <tbody>${data.map(u=>`
              <tr><td>${u.name||""}</td><td>${u.email||""}</td><td>${u.role||""}</td></tr>
            `).join("")}</tbody>
          </table>`;
        $("#usersTable").innerHTML = table;
      } catch (e) {
        console.error(e);
        $("#usersTable").innerHTML = "<p>No se pudieron cargar los usuarios.</p>";
      }
    });
  }
}

/* ================== SELLER (seller.html) ================== */
// seller.html contiene #newProductForm, #sellerProducts, #sellerOrders. :contentReference[oaicite:8]{index=8}
function attachSellerHandlers() {
  const form = $("#newProductForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      // normalizar nombres esperados por backend
      const payload = {
        name: data.title || data.name,
        price_xaf: parseInt(data.price_xaf || data.price || "0",10),
        image_url: data.image_url || "",
        stock: parseInt(data.stock || "0",10),
        description: data.description || "",
      };
      try {
        const res = await fetch(`${API}${PATHS.sellerProducts}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("No se pudo crear el producto");
        alert("Producto creado");
        form.reset();
        loadSellerProducts();
      } catch (err) {
        console.error(err);
        alert("Error creando producto");
      }
    });
  }

  async function loadSellerProducts() {
    const box = $("#sellerProducts");
    if (!box) return;
    try {
      const res = await fetch(`${API}${PATHS.sellerProducts}`, { headers: authHeaders() });
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      box.innerHTML = items.map(p => `
        <div class="card product">
          <img src="${p.image_url || ""}" alt="">
          <div class="title">${p.name}</div>
          <div class="price">${p.price_xaf} XAF</div>
        </div>
      `).join("");
    } catch (e) {
      console.error(e);
      $("#sellerProducts").innerHTML = "<p>No se pudieron cargar tus productos.</p>";
    }
  }

  async function loadSellerOrders() {
    const box = $("#sellerOrders");
    if (!box) return;
    try {
      const res = await fetch(`${API}${PATHS.sellerOrders}`, { headers: authHeaders() });
      const data = await res.json();
      box.innerHTML = `
        <table>
          <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>${data.map(o=>`
            <tr><td>${o.id}</td><td>${o.customer_name||o.user?.name||""}</td><td>${o.total_xaf||o.total||0}</td><td>${o.status||""}</td></tr>
          `).join("")}</tbody>
        </table>`;
    } catch (e) {
      console.error(e);
      box.innerHTML = "<p>No se pudieron cargar tus pedidos.</p>";
    }
  }

  // Llamadas iniciales si estamos en seller.html
  if ($("#sellerProducts")) loadSellerProducts();
  if ($("#sellerOrders")) loadSellerOrders();
}

/* ================== NAV & EVENTOS GLOBALES ================== */
function wireGlobalUI() {
  // Drawer carrito
  $("#cartBtn")?.addEventListener("click", ()=> $("#cartDrawer")?.classList.remove("hidden"));
  $("#closeCart")?.addEventListener("click", ()=> $("#cartDrawer")?.classList.add("hidden"));

  // Checkout modal
  $("#checkoutOpen")?.addEventListener("click", ()=> $("#checkoutModal")?.classList.remove("hidden"));
  $("#closeCheckout")?.addEventListener("click", ()=> $("#checkoutModal")?.classList.add("hidden"));
  $("#checkoutForm")?.addEventListener("submit", submitCheckout);
  $("#fulfillmentType")?.addEventListener("change", calcCheckoutTotal);

  // Filtros
  $("#searchBtn")?.addEventListener("click", applyFilters);
  $("#searchInput")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") applyFilters(); });
  $("#categoryFilter")?.addEventListener("change", applyFilters);
  $("#minPriceFilter")?.addEventListener("input", applyFilters);
  $("#maxPriceFilter")?.addEventListener("input", applyFilters);
}

/* ================== INIT (por página) ================== */
(function init() {
  wireGlobalUI();
  updateCartUI();

  // home
  if ($("#productsList")) {
    loadBusinesses();
    loadProducts();
  }

  // login & signup
  if ($("#loginForm") || $("#signupForm")) {
    attachAuthHandlers();
  }

  // admin
  if ($("#createSellerForm") || $("#refreshUsers")) {
    attachAdminHandlers();
  }

  // seller
  if ($("#newProductForm") || $("#sellerProducts") || $("#sellerOrders")) {
    attachSellerHandlers();
  }
})();
