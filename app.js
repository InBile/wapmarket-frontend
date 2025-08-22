// ================== CONFIG ==================
const API = "https://backend-wapmarket-production.up.railway.app";
const PATHS = {
  products: "/api/products",
  stores: "/api/stores",
  orders: "/api/orders",
};

// ================== ESTADO ==================
let productsCache = [];
let cart = JSON.parse(localStorage.getItem("wap_cart") || "[]");

// ================== HELPERS ==================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function saveCart() {
  localStorage.setItem("wap_cart", JSON.stringify(cart));
  updateCartUI();
}

// ================== PRODUCTOS ==================
async function loadProducts(storeId = null) {
  const list = $("#productsList");
  if (!list) return;
  list.innerHTML = "<p>Cargando productos...</p>";
  try {
    const url = storeId
      ? `${API}${PATHS.products}?store_id=${storeId}`
      : `${API}${PATHS.products}`;
    const res = await fetch(url);
    const data = await res.json();
    productsCache = data.products || [];
    renderProducts(productsCache);
    loadCategories(productsCache);
  } catch (err) {
    console.error("Error productos:", err);
    list.innerHTML = "<p>No se pudieron cargar productos.</p>";
  }
}

function renderProducts(products) {
  const list = $("#productsList");
  if (!list) return;
  if (!products.length) {
    list.innerHTML = "<p>No hay productos disponibles</p>";
    return;
  }
  list.innerHTML = products
    .map(
      (p) => `
      <div class="product-card">
        <h4>${p.name}</h4>
        <p>${p.price_xaf} XAF</p>
        <button data-id="${p.id}" class="addCartBtn">Añadir</button>
      </div>`
    )
    .join("");
  $$(".addCartBtn").forEach((btn) =>
    btn.addEventListener("click", () => addToCart(btn.dataset.id))
  );
}

// ================== NEGOCIOS ==================
async function loadStores() {
  const sec = $("#businessesSection");
  if (!sec) return;
  sec.innerHTML = "<p>Cargando negocios...</p>";
  try {
    const res = await fetch(`${API}${PATHS.stores}`);
    const data = await res.json();
    const stores = data.stores || [];
    if (!stores.length) {
      sec.innerHTML = "<p>No hay negocios registrados.</p>";
      return;
    }
    sec.innerHTML = stores
      .map(
        (s) => `
        <div class="store-card">
          <button class="storeBtn" data-id="${s.id}">
            ${s.name} (${s.product_count})
          </button>
        </div>`
      )
      .join("");
    $$(".storeBtn").forEach((btn) =>
      btn.addEventListener("click", () => {
        $("#productsTitle").textContent = `Productos de ${btn.textContent}`;
        loadProducts(btn.dataset.id);
      })
    );
  } catch (e) {
    sec.innerHTML = "<p>Error al cargar negocios</p>";
  }
}

// ================== CARRITO ==================
function addToCart(productId) {
  const p = productsCache.find((x) => x.id == productId);
  if (!p) return;
  const existing = cart.find((c) => c.id == productId);
  if (existing) existing.qty++;
  else cart.push({ id: p.id, title: p.name, price_xaf: p.price_xaf, qty: 1 });
  saveCart();
}

function removeFromCart(productId) {
  cart = cart.filter((c) => c.id != productId);
  saveCart();
}

function updateCartUI() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  const itemsDiv = $("#cartItems");
  if (!itemsDiv) return;
  if (!cart.length) {
    itemsDiv.innerHTML = "<p>Carrito vacío</p>";
    $("#subtotalXAF").textContent = "0";
    return;
  }
  itemsDiv.innerHTML = cart
    .map(
      (c) => `
    <div class="cart-item">
      ${c.title} (${c.qty}) - ${c.price_xaf * c.qty} XAF
      <button class="removeBtn" data-id="${c.id}">Quitar</button>
    </div>`
    )
    .join("");
  $$(".removeBtn").forEach((b) =>
    b.addEventListener("click", () => removeFromCart(b.dataset.id))
  );
  const subtotal = cart.reduce((s, i) => s + i.price_xaf * i.qty, 0);
  $("#subtotalXAF").textContent = subtotal;
}
updateCartUI();

// ================== DRAWER CARRITO ==================
const cartDrawer = $("#cartDrawer");
$("#cartBtn")?.addEventListener("click", () => {
  cartDrawer.classList.remove("hidden");
});
$("#closeCart")?.addEventListener("click", () =>
  cartDrawer.classList.add("hidden")
);
cartDrawer?.addEventListener("click", (e) => {
  if (e.target.id === "cartDrawer") cartDrawer.classList.add("hidden");
});

// ================== CHECKOUT ==================
$("#checkoutOpen")?.addEventListener("click", () => {
  $("#checkoutModal").classList.remove("hidden");
  updateCheckoutSummary();
});
$("#closeCheckout")?.addEventListener("click", () =>
  $("#checkoutModal").classList.add("hidden")
);

function updateCheckoutSummary() {
  const subtotal = cart.reduce((s, i) => s + i.price_xaf * i.qty, 0);
  const delivery =
    $("#fulfillmentType")?.value === "delivery" ? 2000 : 0;
  $("#coSubtotal").textContent = subtotal;
  $("#coDelivery").textContent = delivery;
  $("#coTotal").textContent = subtotal + delivery;
}

$("#fulfillmentType")?.addEventListener("change", updateCheckoutSummary);

$("#checkoutForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!cart.length) return alert("Carrito vacío");
  const form = new FormData(e.target);
  const payload = {
    items: cart.map((c) => ({ productId: c.id, quantity: c.qty })),
    fulfillment_type: form.get("fulfillment_type"),
    guest_name: form.get("guest_name"),
    guest_phone: form.get("guest_phone"),
    address: form.get("address"),
  };
  try {
    const res = await fetch(`${API}${PATHS.orders}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Error en pedido");
    alert("✅ Pedido realizado con ID: " + data.order_id);
    generateInvoicePDF(data.order);
    cart = [];
    saveCart();
    $("#checkoutModal").classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Error creando pedido");
  }
});

// ================== FACTURA PDF ==================
function generateInvoicePDF(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Factura WapMarket", 10, 10);
  doc.text("Pedido #" + order.id, 10, 20);
  doc.text("Total: " + order.total_xaf + " XAF", 10, 30);
  doc.text("Estado: " + order.status, 10, 40);
  doc.save("factura_" + order.id + ".pdf");
}

// ================== FILTROS ==================
function applyFilters() {
  let filtered = [...productsCache];
  const cat = $("#categoryFilter")?.value;
  const min = Number($("#minPriceFilter")?.value) || 0;
  const max = Number($("#maxPriceFilter")?.value) || Infinity;
  const q = $("#searchInput")?.value.toLowerCase();
  if (cat) filtered = filtered.filter((p) => p.category === cat);
  filtered = filtered.filter(
    (p) => p.price_xaf >= min && p.price_xaf <= max
  );
  if (q) filtered = filtered.filter((p) =>
    p.name.toLowerCase().includes(q)
  );
  renderProducts(filtered);
}
$("#searchBtn")?.addEventListener("click", applyFilters);
$("#categoryFilter")?.addEventListener("change", applyFilters);
$("#minPriceFilter")?.addEventListener("input", applyFilters);
$("#maxPriceFilter")?.addEventListener("input", applyFilters);

// ================== CATEGORÍAS ==================
function loadCategories(products) {
  const sel = $("#categoryFilter");
  if (!sel) return;
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  sel.innerHTML =
    '<option value="">Todas las categorías</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join("");
}

// ================== INIT ==================
loadStores();
loadProducts();
