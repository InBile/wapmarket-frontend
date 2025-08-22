// ================== CONFIG ==================
const API = "https://backend-wapmarket-production.up.railway.app/api";
const TOKEN_KEY = "wap_token";
const USER_KEY = "wap_user";

// Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ================== ESTADO ==================
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let productsCache = [];

// ================== AUTENTICACIÓN ==================
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getUser() {
  return JSON.parse(localStorage.getItem(USER_KEY));
}
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.reload();
}

// ================== CARGAR NEGOCIOS ==================
async function loadBusinesses() {
  try {
    const res = await fetch(`${API}/businesses`);
    const businesses = await res.json();
    renderBusinesses(businesses);
  } catch (err) {
    console.error("Error cargando negocios:", err);
  }
}

function renderBusinesses(businesses) {
  const container = $("#businessesSection");
  container.innerHTML = "";
  businesses.forEach((b) => {
    const div = document.createElement("div");
    div.className = "business-card";
    div.innerHTML = `<h4>${b.name}</h4><p>${b.description || ""}</p>`;
    container.appendChild(div);
  });
}

// ================== CARGAR PRODUCTOS ==================
async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`);
    const products = await res.json();
    productsCache = products;
    renderProducts(products);
    loadCategories(products);
  } catch (err) {
    console.error("Error cargando productos:", err);
  }
}

function renderProducts(products) {
  const list = $("#productsList");
  list.innerHTML = "";
  if (!products.length) {
    list.innerHTML = "<p>No hay productos disponibles.</p>";
    return;
  }

  products.forEach((p) => {
    const div = document.createElement("div");
    div.className = "product-card";
    div.innerHTML = `
      <h4>${p.name}</h4>
      <p>${p.description || ""}</p>
      <p><strong>${p.price} XAF</strong></p>
      <button data-id="${p.id}">Agregar al carrito</button>
    `;
    div.querySelector("button").addEventListener("click", () => addToCart(p));
    list.appendChild(div);
  });
}

// ================== FILTROS ==================
function loadCategories(products) {
  const select = $("#categoryFilter");
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

function applyFilters() {
  const search = $("#searchInput").value.toLowerCase();
  const cat = $("#categoryFilter").value;
  const min = parseInt($("#minPriceFilter").value) || 0;
  const max = parseInt($("#maxPriceFilter").value) || 1000000;

  const filtered = productsCache.filter((p) => {
    return (
      (!cat || p.category === cat) &&
      p.price >= min &&
      p.price <= max &&
      (!search || p.name.toLowerCase().includes(search))
    );
  });
  renderProducts(filtered);
}

// ================== CARRITO ==================
function addToCart(product) {
  cart.push(product);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  $("#cartCount").textContent = cart.length;
  const items = $("#cartItems");
  items.innerHTML = "";

  let subtotal = 0;
  cart.forEach((p, i) => {
    subtotal += p.price;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${p.name} - ${p.price} XAF</span>
      <button data-index="${i}">❌</button>
    `;
    div.querySelector("button").addEventListener("click", () =>
      removeFromCart(i)
    );
    items.appendChild(div);
  });

  $("#subtotalXAF").textContent = subtotal;
  $("#coSubtotal").textContent = subtotal;
  calcCheckoutTotal();
}

// ================== CHECKOUT ==================
function calcCheckoutTotal() {
  const subtotal = parseInt($("#coSubtotal").textContent) || 0;
  const type = $("#fulfillmentType").value;
  const delivery = type === "delivery" ? 2000 : 0;
  $("#coDelivery").textContent = delivery;
  $("#coTotal").textContent = subtotal + delivery;
}

$("#checkoutForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!cart.length) return alert("El carrito está vacío");

  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());
  payload.items = cart;

  try {
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken() ? `Bearer ${getToken()}` : "",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Error en el pedido");
    alert("Pedido realizado con éxito");
    cart = [];
    localStorage.removeItem("cart");
    updateCartUI();
    $("#checkoutModal").classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("No se pudo procesar el pedido");
  }
});

// ================== EVENTOS UI ==================
$("#searchBtn")?.addEventListener("click", applyFilters);
$("#categoryFilter")?.addEventListener("change", applyFilters);
$("#minPriceFilter")?.addEventListener("input", applyFilters);
$("#maxPriceFilter")?.addEventListener("input", applyFilters);
$("#fulfillmentType")?.addEventListener("change", calcCheckoutTotal);

$("#cartBtn")?.addEventListener("click", () =>
  $("#cartDrawer").classList.remove("hidden")
);
$("#closeCart")?.addEventListener("click", () =>
  $("#cartDrawer").classList.add("hidden")
);

$("#checkoutOpen")?.addEventListener("click", () =>
  $("#checkoutModal").classList.remove("hidden")
);
$("#closeCheckout")?.addEventListener("click", () =>
  $("#checkoutModal").classList.add("hidden")
);

// ================== INIT ==================
loadBusinesses();
loadProducts();
updateCartUI();
