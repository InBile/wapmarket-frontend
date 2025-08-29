function headers(extra){
  return Object.assign({'Content-Type':'application/json'}, extra||{});
}

// Home search
const searchForm = document.getElementById('searchForm');
if (searchForm){
  async function load(){
    const q = document.getElementById('q').value.trim();
    const cat = document.getElementById('category').value;
    const loc = document.getElementById('location').value.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    if (loc) params.set('location', loc);
    const res = await fetch(`${window.API_BASE}/public/products?`+params.toString());
    const data = await res.json();
    const el = document.getElementById('results');
    el.innerHTML = '';
    (data.items||[]).forEach(p=>{
      const d = document.createElement('div');
      d.className = 'item';
      d.innerHTML = `
        <img src="${p.image_url || 'https://placehold.co/640x360?text=wapmarket'}" alt="">
        <div class="body">
          <div class="badge">${p.business_type === 'verified' ? '✔ Verificado' : 'No verificado'}</div>
          <h4>${p.title}</h4>
          <p>${(p.description||'').slice(0,120)}</p>
          <small>${p.category || ''} • ${p.location || ''}</small>
          <strong>${p.price_xaf ? (p.price_xaf.toLocaleString() + ' XAF') : ''}</strong>
          <a class="small" href="tel:${p.phone||''}">${p.phone ? 'Llamar' : ''}</a>
          <a class="small" href="https://wa.me/${p.phone? p.phone.replace(/[^0-9]/g,''):''}" target="_blank">${p.phone ? 'WhatsApp' : ''}</a>
        </div>
      `;
      el.appendChild(d);
    })
  }
  searchForm.addEventListener('submit', (e)=>{ e.preventDefault(); load(); });
  load();
}

// Admin
const bizForm = document.getElementById('bizForm');
if (bizForm){
  bizForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      location: document.getElementById('location').value,
      business_type: document.getElementById('business_type').value
    };
    const secret = document.getElementById('adminSecret').value;
    const res = await fetch(`${window.API_BASE}/admin/businesses`, {
      method:'POST',
      headers: headers({ Authorization: 'Bearer ' + secret }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Error');
    alert('Negocio creado. Ahora emite una API Key en la lista de abajo.');
    loadBusinesses();
  });

  async function loadBusinesses(){
    const secret = document.getElementById('adminSecret').value;
    const res = await fetch(`${window.API_BASE}/admin/businesses`, {
      headers: headers({ Authorization: 'Bearer ' + secret })
    });
    const data = await res.json();
    const list = document.getElementById('bizList');
    list.innerHTML = '';
    (data.items||[]).forEach(b=>{
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div class="body">
          <div class="badge">${b.business_type}</div>
          <h4>${b.name}</h4>
          <p>${b.email||''} ${b.phone? '• '+b.phone:''} ${b.location? '• '+b.location:''}</p>
          <button data-id="${b.id}" class="issue">Emitir / Rotar API Key</button>
        </div>
      `;
      list.appendChild(el);
    });
    list.addEventListener('click', async (e)=>{
      const btn = e.target.closest('button.issue');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const res2 = await fetch(`${window.API_BASE}/admin/businesses/${id}/issue-key`, {
        method:'POST',
        headers: headers({ Authorization: 'Bearer ' + document.getElementById('adminSecret').value })
      });
      const data2 = await res2.json();
      if (!res2.ok) return alert(data2.error || 'Error');
      prompt('API Key (cópiala y compártela con el negocio, se muestra solo una vez):', data2.api_key);
    }, { once: true });
  }

  document.getElementById('adminSecret').addEventListener('change', ()=>{
    if (document.getElementById('adminSecret').value.trim()) loadBusinesses();
  });
}

// Business panel
const bizAuth = document.getElementById('bizAuth');
if (bizAuth){
  let creds = null;
  bizAuth.addEventListener('submit', (e)=>{
    e.preventDefault();
    creds = {
      id: Number(document.getElementById('bid').value),
      key: document.getElementById('apiKey').value
    };
    alert('Autenticado. Ya puedes publicar productos.');
  });

  const prodForm = document.getElementById('prodForm');
  prodForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if (!creds) return alert('Primero autentícate');
    const payload = {
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      category: document.getElementById('category').value,
      price_xaf: Number(document.getElementById('price').value || 0),
      image_url: document.getElementById('image_url').value
    };
    const res = await fetch(`${window.API_BASE}/products`, {
      method:'POST',
      headers: headers({ Authorization: 'Bearer ' + creds.key, 'X-Business-Id': String(creds.id) }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Error');
    alert('Producto publicado');
    prodForm.reset();
  });
}
