<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — WapMarket</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="header">
  <div class="row wrapper">
    <div class="logo">WapMarket</div>
  </div>
</header>

<main class="wrapper">
  <!-- LOGIN -->
  <div class="card" style="max-width:760px;padding:16px" id="loginBox">
    <h3>Login de administrador</h3>
    <form id="loginForm" onsubmit="return false;">
      <label>Email <input id="email" type="email" value="admin@wapmarket.com" required></label>
      <label>Contraseña <input id="password" type="password" value="admin123" required></label>
      <button class="btn" id="btnLogin">Entrar</button>
    </form>
  </div>

  <!-- PANEL -->
  <div id="panel" style="display:none">
    <h2>Panel Admin</h2>
    <div class="card" style="max-width:760px;padding:16px">
      <h3>Crear negocio</h3>
      <form id="bizForm" onsubmit="return false;">
        <label>Nombre <input id="name" required></label>
        <label>Email <input id="bemail" type="email"></label>
        <label>Teléfono <input id="phone"></label>
        <label>Ubicación <input id="location"></label>
        <label>Tipo
          <select id="business_type">
            <option value="verified">Verificado</option>
            <option value="unverified">No verificado</option>
          </select>
        </label>
        <label>Login vendedor (email) <input id="login_email" type="email" required></label>
        <label>Contraseña vendedor <input id="bpass" type="password" required></label>
        <button class="btn" id="btnCrear">Crear negocio</button>
      </form>
    </div>

    <h3>Negocios</h3>
    <div id="bizList" class="grid"></div>
  </div>
</main>

<script>
const API_BASE = "https://wapmarket-backend-production.up.railway.app/api";
let token = null;
function authHeaders(){
  return token ? { 'Authorization':'Bearer '+token, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
}

// LOGIN ADMIN
document.getElementById('btnLogin').addEventListener('click', async ()=>{
  const res = await fetch(`${API_BASE}/admin/login`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ email: email.value, password: password.value })
  });
  const data = await res.json();
  if (!res.ok){ alert(data.error || 'Error de login'); return; }
  token = data.token; 
  localStorage.setItem('adminToken', token);
  document.getElementById('panel').style.display = 'block';
  document.getElementById('loginBox').style.display = 'none';
  loadBusinesses();
});

// Auto-login si ya hay token guardado
token = localStorage.getItem('adminToken'); 
if (token){ 
  document.getElementById('panel').style.display = 'block'; 
  document.getElementById('loginBox').style.display = 'none'; 
  loadBusinesses(); 
}

// CREAR NEGOCIO
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await fetch(`${API_URL}/api/admin/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`, // 👈 token admin obligatorio
      },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        location: form.location,
        business_type: form.business_type || "unverified",
        login_email: form.login_email,
        password: form.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error creando negocio");
    alert("Negocio creado con éxito ✅");
  } catch (err) {
    alert("❌ " + err.message);
  }
};

});

// LISTAR NEGOCIOS
async function loadBusinesses(){
  const res = await fetch(`${API_BASE}/admin/businesses`, {
    headers: authHeaders()
  });
  const data = await res.json();
  const grid = document.getElementById('bizList'); 
  grid.innerHTML = '';
  (data.items||[]).forEach(b=>{
    const el = document.createElement('div'); 
    el.className='card';
    el.innerHTML = `<div class="body">
      <div class="badge">${b.business_type}</div>
      <h4>${b.name}</h4>
      <div>${b.login_email||''}</div>
      <div>${b.email||''} ${b.phone? '• '+b.phone:''} ${b.location? '• '+b.location:''}</div>
    </div>`;
    grid.appendChild(el);
  });
}
</script>
</body>
</html>
