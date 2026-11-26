(() => {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { alert('Configurez config.js'); return; }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let currentUser = null, allCollections = [], allItems = [], isSignUpMode = false, currentDetailItem = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const CATS = {
    bd: { icon: '📚', label: 'BD', num: 'Tome', author: 'Auteur(s)', editor: 'Éditeur', ref: 'ISBN / Code-barres' },
    lego: { icon: '🧱', label: 'LEGO', num: 'N° de set', author: 'Thème', editor: 'Marque', ref: 'Code-barres EAN' },
    santon: { icon: '🏺', label: 'Santon', num: 'Taille', author: 'Santonnier', editor: 'Finition', ref: 'Référence' },
    vehicule: { icon: '🚗', label: 'Véhicule', num: 'Échelle', author: 'Fabricant', editor: 'Marque', ref: 'Référence' }
  };

  async function initAuth() {
    const { data: { session } } = await sb.auth.getSession();
    onAuth(session);
    sb.auth.onAuthStateChange((_e, s) => onAuth(s));
  }

  function onAuth(session) {
    currentUser = session?.user || null;
    $('auth-screen').style.display = currentUser ? 'none' : 'flex';
    $('app-screen').style.display = currentUser ? 'block' : 'none';
    if (currentUser) loadData();
  }

  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('auth-email').value.trim(), password = $('auth-password').value, err = $('auth-error');
    err.style.display = 'none';
    const { error } = isSignUpMode ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (error) { err.textContent = error.message; err.style.display = 'block'; }
    else if (isSignUpMode) { err.style.background = '#d4edda'; err.style.color = '#155724'; err.textContent = 'Compte créé ! Connectez-vous.'; err.style.display = 'block'; }
  });

  $('toggle-auth-mode').addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    $('auth-title').textContent = isSignUpMode ? 'Créer un compte' : 'Connexion';
    $('auth-submit-btn').textContent = isSignUpMode ? "S'inscrire" : 'Se connecter';
    e.target.textContent = isSignUpMode ? 'Se connecter' : 'Créer un compte';
  });

  $('btn-logout').addEventListener('click', () => sb.auth.signOut());

  async function loadData() {
    const [cRes, iRes] = await Promise.all([
      Promise.resolve({ data: [] }),
      sb.from('items').select('*').order('created_at', { ascending: false })
    ]);
    allCollections = cRes.data || [];
    allItems = iRes.data || [];
    const savedP = JSON.parse(localStorage.getItem("custom_personnes") || "[]"); const personnes = [...new Set(["Moi", ...savedP, ...allItems.map(i => i.personne)].filter(Boolean))];
    const selP = $('active-personne'), prevP = selP.value;
    selP.innerHTML = '<option value="all">👤 Toutes personnes</option>' + personnes.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if ([...selP.options].some(o => o.value === prevP)) selP.value = prevP; selP.onchange = () => { localStorage.setItem("selected_personne", selP.value); updateColFilter(); renderItems(); };
    updateColFilter();
    renderItems();
  }

  function updateColFilter() {}

  function renderItems() {
    const cat = $('filter-categorie').value, pers = $('active-personne').value, colId = 'all', q = $('search-input').value.toLowerCase().trim();
    const list = allItems.filter(i => {
      if (cat !== 'all' && i.categorie !== cat) return false;
      if (pers !== 'all' && i.personne !== pers) return false;
      
      if (q && ![i.titre, i.serie, i.numero, i.auteur_marque, i.editeur, i.code_barre, i.notes].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    const box = $('items-container');
    if (!list.length) { box.innerHTML = '<div class="empty-state"><p style="font-size:36px;">📦</p><p>Aucun objet trouvé. Appuyez sur <strong>+</strong> !</p></div>'; return; }
    const groups = {};
    list.forEach(i => {
      
      const name = (CATS[i.categorie]?.icon || "") + " " + (CATS[i.categorie]?.label || i.categorie) + " — " + (i.personne || "Moi");
      (groups[name] = groups[name] || []).push(i);
    });
    box.innerHTML = Object.entries(groups).map(([title, items]) => `
      <div class="collection-group">
        <div class="collection-header"><h2>${esc(title)}</h2><span class="collection-count">${items.length}</span></div>
        ${items.map(i => {
          const m = CATS[i.categorie] || CATS.bd;
          const img = i.photo_url ? `<img src="${esc(i.photo_url)}" class="item-photo" alt="">` : `<div class="item-photo-placeholder">${m.icon}</div>`;
          const sub = [i.serie, i.numero ? `#${i.numero}` : '', i.auteur_marque].filter(Boolean).join(' • ');
          return `<div class="item-card" data-id="${i.id}">${img}<div class="item-info"><span class="type-badge ${i.categorie}">${m.label}</span><h3>${esc(i.titre)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}${i.code_barre ? `<p>Réf : ${esc(i.code_barre)}</p>` : ''}</div></div>`;
        }).join('')}
      </div>`).join('');
    box.querySelectorAll('.item-card').forEach(c => c.addEventListener('click', () => openDetail(c.dataset.id)));
  }

  ['filter-categorie', 'active-personne'].forEach(id => $(id).addEventListener('change', () => { updateColFilter(); renderItems(); }));
  
  $('search-input').addEventListener('input', renderItems);

  $("btn-add-personne").addEventListener("click", () => { const nom = prompt("Nom de la personne :"); if (nom && nom.trim()) { const n = nom.trim(); const sel = $("active-personne"); if (![...sel.options].some(o => o.value === n)) sel.add(new Option(n, n)); sel.value = n; localStorage.setItem("selected_personne", n); renderItems(); } });

  $('btn-fab-add').addEventListener('click', () => {
    $('form-add-item').reset();
    $('search-results').innerHTML = '';
    $('item-photo-preview').style.display = 'none';
    $('item-photo-url').value = '';
    ScannerModule.stopCamera();
    $('scan-status').className = 'scan-status';
    const activeCat = $('filter-categorie').value; const activePers = $('active-personne').value; if (activePers !== 'all') $('item-personne').value = activePers;
    if (activeCat !== 'all') $('item-categorie').value = activeCat;
    adaptForm();
    $('modal-add').classList.add('active');
  });

  $('item-categorie').addEventListener('change', adaptForm);
  function adaptForm() {
    const cat = $('item-categorie').value, m = CATS[cat] || CATS.bd;
    $('label-numero').textContent = m.num;
    $('label-auteur').textContent = m.author;
    $('label-editeur').textContent = m.editor;
    $('label-ref').textContent = m.ref;
    const isScan = (cat === 'bd' || cat === 'lego');
    if (!isScan) ScannerModule.stopCamera();
    $('scanner-box').style.display = isScan ? 'block' : 'none';
    $('web-link-box').style.display = isScan ? 'none' : 'block';
    $('api-query-input').placeholder = cat === 'bd' ? 'ISBN ou titre de BD...' : 'N° set LEGO (ex: 75192) ou EAN...';
    const cols = allCollections.filter(c => c.categorie === cat);
    
  }

  $('btn-fetch-url').addEventListener('click', async () => {
    const res = await WebScraperModule.extractFromUrl($('web-url-input').value.trim());
    if (res) fillForm(res);
  });

  $('item-photo-url').addEventListener('input', (e) => {
    const v = e.target.value.trim(), p = $('item-photo-preview');
    p.src = v; p.style.display = v ? 'block' : 'none';
  });

  $('btn-start-scan').addEventListener('click', () => {
    ScannerModule.startCamera((code) => { $('item-code-barre').value = code; $('api-query-input').value = code; runLookup(code); });
  });
  $('btn-stop-scan').addEventListener('click', () => ScannerModule.stopCamera());
  $('btn-scan-photo').addEventListener('click', () => $('input-scan-photo').click());
  $('input-scan-photo').addEventListener('change', (e) => {
    const file = e.target.files ? e.target.files.item(0) : null;
    if (!file) return;
    const cat = $('item-categorie').value;
    ScannerModule.scanFromFile(file,
      (code) => { $('item-code-barre').value = code; $('api-query-input').value = code; runLookup(code); },
cat === 'lego' ? (f) => LegoModule.extractSetNumberFromPhoto(f, (n) => { $('item-numero').value = n; $('api-query-input').value = n; runLookup(n); }) : null
);
e.target.value = '';
});
$('btn-api-search').addEventListener('click', () => runLookup($('api-query-input').value.trim()));
async function runLookup(q) {
if (!q) return;
const cat = $('item-categorie').value, div = $('search-results');
div.innerHTML = '';
let res = [];
if (cat === 'bd') {
const clean = BDModule.cleanIsbn(q);
res = (clean.length === 10 || clean.length === 13) ? await BDModule.lookupByIsbn(clean) : await BDModule.lookupByTitle(q);
} else if (cat === 'lego') {
res = await LegoModule.searchBrickset(q);
}
if (!res.length) { ScannerModule.setStatus('Aucun résultat trouvé.', 'error'); return; }
ScannerModule.setStatus(res.length + " résultat(s) — cliquez pour remplir :", "success");
div.innerHTML = res.map(function(r, i) { var img = r.photo_url ? "<img src=\"" + esc(r.photo_url) + "\" alt=\"\">" : ""; var tag = r.source.toLowerCase().replace(/\s+/g, ""); var sub = [r.serie, r.numero ? "#" + r.numero : "", r.auteur_marque, r.annee].filter(Boolean).join(" • "); return "<div class=\"search-result-item\" data-i=\"" + i + "\">" + img + "<div style=\"flex:1;min-width:0;\"><span class=\"source-tag source-" + tag + "\">" + esc(r.source) + "</span><strong style=\"display:block;font-size:14px;\">" + esc(r.titre) + "</strong><small style=\"color:#636366;\">" + esc(sub) + "</small></div></div>"; }).join("");
div.querySelectorAll('.search-result-item').forEach(el => el.addEventListener('click', () => {
const chosen = res.at(Number(el.dataset.i));
if (chosen) fillForm(chosen);
div.innerHTML = '';
}));
}
function fillForm(r) {
if (r.titre) $('item-titre').value = r.titre;
if (r.serie) $('item-serie').value = r.serie;
if (r.numero) $('item-numero').value = r.numero;
if (r.auteur_marque) $('item-auteur').value = r.auteur_marque;
if (r.editeur) $('item-editeur').value = r.editeur;
if (r.annee) $('item-annee').value = r.annee;
if (r.code_barre) $('item-code-barre').value = r.code_barre;
if (r.notes) $('item-notes').value = r.notes;
if (r.photo_url) { $('item-photo-url').value = r.photo_url; const p = $('item-photo-preview'); p.src = r.photo_url; p.style.display = 'block'; }
}
$('item-photo-file').addEventListener('change', (e) => {
const file = e.target.files ? e.target.files.item(0) : null;
if (!file) return;
const reader = new FileReader();
reader.onload = (ev) => {
const img = new Image();
img.onload = () => {
const c = document.createElement('canvas'), s = img.width > 800 ? 800 / img.width : 1;
c.width = img.width * s; c.height = img.height * s;
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
const url = c.toDataURL('image/jpeg', 0.78);
$('item-photo-url').value = url;
const p = $('item-photo-preview'); p.src = url; p.style.display = 'block';
};
img.src = ev.target.result;
};
reader.readAsDataURL(file);
});
$('form-add-item').addEventListener('submit', async (e) => {
e.preventDefault();
const { error } = await sb.from('items').insert([{
user_id: currentUser.id, categorie: $('item-categorie').value, personne: $('item-personne').value.trim() || 'Moi',
 titre: $('item-titre').value.trim(), serie: $('item-serie').value.trim(),
numero: $('item-numero').value.trim(), auteur_marque: $('item-auteur').value.trim(), editeur: $('item-editeur').value.trim(),
annee: $('item-annee').value.trim(), code_barre: $('item-code-barre').value.trim(), photo_url: $('item-photo-url').value.trim(),
notes: $('item-notes').value.trim()
}]);
if (error) { alert('Erreur : ' + error.message); return; }
await ScannerModule.stopCamera();
$('modal-add').classList.remove('active');
await loadData();
});
function openDetail(id) {
const i = allItems.find(x => x.id === id);
if (!i) return;
currentDetailItem = i;
const m = CATS[i.categorie] || CATS.bd, col = allCollections.find(c => c.id === i.collection_id);
  $('detail-body').innerHTML = '<p>Catégorie : ' + m.label + '</p><p>Collection : ' + esc(col ? col.nom : 'Aucune') + '</p><p>Notes : ' + esc(i.notes) + '</p>';
  $('modal-detail').classList.add('active');
}
$('btn-delete-item').addEventListener('click', async () => {
  if (!currentDetailItem || !confirm('Supprimer ?')) return;
  await sb.from('items').delete().eq('id', currentDetailItem.id);
  $('modal-detail').classList.remove('active');
  await loadData();
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { ScannerModule.stopCamera(); $(b.dataset.close).classList.remove('active'); }));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

  
  const btnAddP = document.getElementById("btn-add-personne");
  if (btnAddP) {
    btnAddP.onclick = function() {
      const inp = document.getElementById("new-personne-input");
      const n = (inp ? inp.value : "").trim();
      if (!n) { if (inp) inp.focus(); return; }
      const saved = JSON.parse(localStorage.getItem("custom_personnes") || "[]");
      if (!saved.includes(n)) { saved.push(n); localStorage.setItem("custom_personnes", JSON.stringify(saved)); }
      const sel = document.getElementById("active-personne");
      if (sel) {
        if (!Array.from(sel.options).some(o => o.value === n)) sel.add(new Option(n, n));
        sel.value = n;
      }
      localStorage.setItem("selected_personne", n);
      if (inp) inp.value = "";
      if (typeof renderItems === "function") renderItems();
    };
  }
  initAuth();

})();
