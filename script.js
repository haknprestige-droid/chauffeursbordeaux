// =======================================================
// Google Maps loader (clé dans config.js)
// =======================================================
(function loadGoogleMaps() {
  // Si Google Maps est déjà chargé, on ne fait rien.
  if (typeof window.google === "object" && window.google.maps) return;

  const KEY = (window.GOOGLE_MAPS_API_KEY || "").trim();
  if (!KEY || KEY.includes("PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE")) {
    console.warn("[HAKNPRESTIGE] Clé Google Maps manquante. Ouvrez config.js et collez votre clé API.");
    // On laisse le formulaire utilisable en saisie libre.
    return;
  }

  // Évite les doublons si le script est déjà en cours de chargement.
  if (document.querySelector('script[data-haknprestige-maps="1"]')) return;

  const s = document.createElement("script");
  s.setAttribute("data-haknprestige-maps", "1");
  s.src =
    "https://maps.googleapis.com/maps/api/js" +
    "?key=" + encodeURIComponent(KEY) +
    "&libraries=places,geometry" +
    "&callback=initMap";
  s.async = true;
  s.defer = true;

  s.onerror = () => {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    const alert = document.createElement("div");
    alert.style.cssText =
      "background:#fff3cd;color:#856404;padding:12px;border:1px solid #ffeeba;border-radius:10px;margin:12px 0;font-size:14px;line-height:1.35;";
    alert.innerHTML =
      "<strong>Google Maps n'a pas pu se charger.</strong><br>" +
      "Vérifiez : <em>clé API</em>, <em>facturation activée</em>, et <em>restrictions de domaine</em> (HTTP referrers).";
    mapEl.parentElement.insertBefore(alert, mapEl);
  };

  document.head.appendChild(s);
})();


// 1) Formatteur date/heure en français
function formatDateTime(val) {
  const d = new Date(val);
  if (isNaN(d)) return '';
  const date = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  return `${date} à ${time}`;
}

// 2) Récupération des réglages depuis Admin (localStorage)
function loadSettings() {
  return {
    // Tarifs
    prixMinEco:       parseFloat(localStorage.getItem('prixMinEco'))      || 5,
    prixKmEco:        parseFloat(localStorage.getItem('prixKmEco'))       || 2,
    prixMinEcoCoef:   parseFloat(localStorage.getItem('prixMinEcoCoef'))  || 0.5,

    prixMinVan:       parseFloat(localStorage.getItem('prixMinVan'))      || 10,
    prixKmVan:        parseFloat(localStorage.getItem('prixKmVan'))       || 3,
    prixMinVanCoef:   parseFloat(localStorage.getItem('prixMinVanCoef'))  || 1,

    // Capacités max (pax / valises) pour forcer Van si dépassé
    capPax:           parseInt(localStorage.getItem('capPax'), 10)        || 3,
    capBags:          parseInt(localStorage.getItem('capBags'), 10)       || 3,

    // Par défaut
    defaultVehicle:   localStorage.getItem('defaultVehicle')              || 'eco',

    // Majoration nuit
    nightStart:       localStorage.getItem('nightStart')                  || '21:00',
    nightEnd:         localStorage.getItem('nightEnd')                    || '07:00',
    nightPercent:     parseFloat(localStorage.getItem('nightPercent'))    || 0,

    // Majoration hors-zone (rayon depuis le centre de Bordeaux) — DÉPART uniquement
    distThresholdKm:  parseFloat(localStorage.getItem('distThresholdKm')) || 35,
    distPercent:      parseFloat(localStorage.getItem('distPercent'))     || 0
  };
}

// Haversine (km) entre deux LatLng
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat() - a.lat()) * Math.PI / 180;
  const dLng = (b.lng() - a.lng()) * Math.PI / 180;
  const lat1 = a.lat() * Math.PI / 180;
  const lat2 = b.lat() * Math.PI / 180;
  const s = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Plage horaire (hh:mm) -> minutes jour
function toMinutes(hhmm) {
  const [h,m] = (hhmm || '00:00').split(':').map(n => parseInt(n,10));
  return (h*60 + (m||0)) % (24*60);
}

// 3) Fonction initMap exposée pour Google Maps
window.initMap = function() {
  if (!window.google || !google.maps) return;

  // Centre Bordeaux
  const bdx = new google.maps.LatLng(44.8378, -0.5792);

  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: bdx
  });
  const ds = new google.maps.DirectionsService();
  const dr = new google.maps.DirectionsRenderer({ map });

  // Autocomplete (avec geometry pour les lat/lng)
  const elPickup  = document.getElementById('pickup');
  const elDropoff = document.getElementById('dropoff');
  const autoPickup  = new google.maps.places.Autocomplete(elPickup);
  const autoDropoff = new google.maps.places.Autocomplete(elDropoff);
  if (autoPickup.setFields)  autoPickup.setFields(['formatted_address','geometry']);
  if (autoDropoff.setFields) autoDropoff.setFields(['formatted_address','geometry']);

  // Éléments du DOM
  const elems = {
    distance:   document.getElementById('distance'),
    estimation: document.getElementById('estimation'),
    vehicle:    document.querySelector('select[name="vehicle"]') || document.querySelector('select[name="vehicule"]'),
    passager:   document.querySelector('input[name="passager"]'),
    valise:     document.querySelector('input[name="valise"]'),
    priceField: document.getElementById('price'),
    dateTime:   document.getElementById('datetime'),
    promoInput: document.querySelector('input[name="promo_code"]'),
    promoStatus: document.getElementById('promo_status'),
    priceBaseField: document.getElementById('price_base'),
    promoPercentField: document.getElementById('promo_percent')
  };

  // Met à jour les labels Éco/Van avec capacités + force Éco par défaut
  function refreshVehicleLabels() {
    const S = loadSettings();
    if (!elems.vehicle) return;
    const ecoOpt = elems.vehicle.querySelector('option[value="eco"]');
    const vanOpt = elems.vehicle.querySelector('option[value="van"]');
    if (ecoOpt) ecoOpt.textContent = `Éco (max ${S.capPax} pax)`;
    if (vanOpt) vanOpt.textContent = `Van (max 7 pax)`;
    if (!elems.vehicle.value) elems.vehicle.value = S.defaultVehicle || 'eco';
  }

  // Test si heure dans la plage nuit (gère le passage minuit)
  function isNight(dt, S) {
    if (!dt) return false;
    const cur = dt.getHours()*60 + dt.getMinutes();
    const start = toMinutes(S.nightStart);
    const end   = toMinutes(S.nightEnd);
    return (start <= end) ? (cur >= start && cur < end)
                          : (cur >= start || cur < end);
  }


  // --- Promo codes (validation côté serveur Netlify Function) ---
  let lastPromoReqId = 0;
  let lastPromoCode  = '';
  let lastPromoRes   = { valid:false };

  function normalizePromo(code){
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);
  }

  function setPromoStatus(text, isError){
    if (!elems.promoStatus) return;
    elems.promoStatus.textContent = text || '';
    elems.promoStatus.classList.toggle('is-error', !!isError);
  }

  function validatePromoCode(code){
    const c = normalizePromo(code);
    if (!c) return Promise.resolve({ valid:false });

    // évite de spammer le serveur si même code
    if (c === lastPromoCode && lastPromoRes && typeof lastPromoRes.valid === 'boolean') {
      return Promise.resolve(lastPromoRes);
    }

    const reqId = ++lastPromoReqId;
    return fetch('/.netlify/functions/promo-validate?code=' + encodeURIComponent(c), { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (reqId !== lastPromoReqId) return lastPromoRes; // réponse obsolète
        lastPromoCode = c;
        lastPromoRes = res || { valid:false };
        return lastPromoRes;
      })
      .catch(() => ({ valid:false }));
  }
  // -------------------------------------------------------------

  // Calcul de l’itinéraire + tarification
  function calculate() {
    const origin      = autoPickup.getPlace()?.formatted_address  || elPickup.value;
    const destination = autoDropoff.getPlace()?.formatted_address || elDropoff.value;

    if (!origin || !destination) {
      if (elems.distance)   elems.distance.textContent = '';
      if (elems.estimation) elems.estimation.textContent = '';
      if (elems.priceField) elems.priceField.value = '';
      return;
    }

    ds.route({ origin, destination, travelMode: google.maps.TravelMode.DRIVING }, (res, status) => {
      if (status !== 'OK') return;
      dr.setDirections(res);

      const leg = res.routes[0].legs[0];
      const km  = leg.distance.value / 1000;
      const mn  = leg.duration.value / 60;

      const S   = loadSettings();

      // Type choisi + Éco par défaut
      let type = (elems.vehicle && elems.vehicle.value) ? elems.vehicle.value : (S.defaultVehicle || 'eco');

      // Bascule auto en Van si dépassement des capacités
      const nbP = parseInt(elems.passager?.value || '0', 10) || 0;
      const nbV = parseInt(elems.valise?.value   || '0', 10) || 0;
      if (nbP > S.capPax || nbV > S.capBags) {
        type = 'van';
        if (elems.vehicle) elems.vehicle.value = 'van';
      }

      // Prix de base
      let price = (type === 'eco')
        ? S.prixMinEco + km * S.prixKmEco + mn * S.prixMinEcoCoef
        : S.prixMinVan + km * S.prixKmVan + mn * S.prixMinVanCoef;

      // Majoration nuit
      let d = null;
      if (elems.dateTime && elems.dateTime.value) d = new Date(elems.dateTime.value);
      if (isNight(d, S) && S.nightPercent > 0) {
        price *= (1 + S.nightPercent/100);
      }

      // Majoration hors-zone : DÉPART uniquement (depuis Bordeaux)
      const startLL  = leg.start_location; // LatLng
      const farStart = haversineKm(bdx, startLL);
      if (farStart > S.distThresholdKm && S.distPercent > 0) {
        price *= (1 + S.distPercent/100);
      }      // Affichage (pas de détails de majoration)
      const basePrice = isFinite(price) ? price : 0;

      if (elems.distance) elems.distance.textContent = `Distance : ${km.toFixed(2)} km`;

      const promoRaw  = elems.promoInput ? elems.promoInput.value : '';
      const promoCode = normalizePromo(promoRaw);

      // Pas de code promo : on affiche le prix de base
      if (!promoCode) {
        if (elems.estimation) elems.estimation.textContent = `Estimation : ${basePrice.toFixed(2)} €`;
        if (elems.priceField) elems.priceField.value = basePrice.toFixed(2);
        if (elems.priceBaseField) elems.priceBaseField.value = basePrice.toFixed(2);
        if (elems.promoPercentField) elems.promoPercentField.value = '';
        setPromoStatus('', false);
        return;
      }

      // Code promo présent : validation serveur
      setPromoStatus('Vérification du code promo…', false);

      validatePromoCode(promoCode).then(res => {
        // Si le client a changé le champ depuis, on recalcule plus tard
        const current = normalizePromo(elems.promoInput ? elems.promoInput.value : '');
        if (current !== promoCode) return;

        if (res && res.valid) {
          const percent = Number(res.percent) || 0;
          const discounted = basePrice * (1 - percent / 100);

          if (elems.estimation) elems.estimation.textContent = `Estimation : ${discounted.toFixed(2)} € (Promo -${percent}%)`;
          if (elems.priceField) elems.priceField.value = discounted.toFixed(2);
          if (elems.priceBaseField) elems.priceBaseField.value = basePrice.toFixed(2);
          if (elems.promoPercentField) elems.promoPercentField.value = String(percent);

          setPromoStatus(`Code ${promoCode} appliqué : -${percent}%`, false);
        } else {
          // Code invalide : pas de réduction
          if (elems.estimation) elems.estimation.textContent = `Estimation : ${basePrice.toFixed(2)} €`;
          if (elems.priceField) elems.priceField.value = basePrice.toFixed(2);
          if (elems.priceBaseField) elems.priceBaseField.value = basePrice.toFixed(2);
          if (elems.promoPercentField) elems.promoPercentField.value = '';

          setPromoStatus('Code promo invalide', true);
        }
      });
});
  }

  // Lancement initial
  refreshVehicleLabels();

  // Écoutes
  autoPickup.addListener('place_changed', () => { refreshVehicleLabels(); calculate(); });
  autoDropoff.addListener('place_changed', calculate);
  if (elems.vehicle)  elems.vehicle .addEventListener('change',  calculate);
  if (elems.passager) elems.passager.addEventListener('input',   calculate);
  if (elems.valise)   elems.valise  .addEventListener('input',   calculate);
  if (elems.dateTime) {
    elems.dateTime.addEventListener('change', calculate);
    elems.dateTime.addEventListener('input',  calculate);
  }
};

// 4) Appel automatique si l’API Maps est déjà prête
window.addEventListener('load', () => {
  if (window.google && window.google.maps) window.initMap();
});

// 5) EmailJS – double envoi admin & client
function sendBoth(serviceID, templateAdmin, adminParams, templateClient, clientParams) {
  return emailjs
    .send(serviceID, templateAdmin, adminParams)
    .then(() => emailjs.send(serviceID, templateClient, clientParams));
}

// 6) Initialisation formulaire (sans PayPal)
document.addEventListener('DOMContentLoaded', () => {
  // autosize
  if (window.autosize) autosize(document.querySelectorAll('textarea.autosize'));

  // EmailJS
  if (window.emailjs && typeof emailjs.init === 'function') {
    emailjs.init('qkf9-Ozros2UPN4vV'); // clé publique EmailJS
  }

  const form = document.getElementById('reservation-form');
  if (!form) return;

  // Pré-remplissage promo via URL (?promo=CODE)
  try {
    const params = new URLSearchParams(window.location.search || '');
    const promo = params.get('promo') || params.get('code');
    const promoInput = form.querySelector('input[name="promo_code"]');
    if (promoInput && promo) {
      promoInput.value = String(promo).trim();
    }
  } catch(_) {}

  // Empêche d'attacher plusieurs fois notre listener
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async function(e) {
    // --- Mode Netlify Forms : laisse le formulaire se soumettre normalement ---
    const isNetlify = this.hasAttribute('data-netlify') || this.getAttribute('data-netlify') === 'true';
    if (isNetlify) {
      // Anti double-envoi (double clic)
      if (this.dataset.sending === '1') { e.preventDefault(); return; }
      this.dataset.sending = '1';

      // Remplir date/heure formatées + séparées avant envoi
      const raw = this.datetime?.value || '';
      const d = new Date(raw);
      const dateOnly = isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      const timeOnly = isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

      if (this.formatted_datetime) this.formatted_datetime.value = formatDateTime(raw);
      const dateField = document.getElementById('date_only');
      const timeField = document.getElementById('time_only');
      if (dateField) dateField.value = dateOnly;
      if (timeField) timeField.value = timeOnly;

      // Valide côté navigateur (required, email, etc.)
      if (typeof this.checkValidity === 'function' && !this.checkValidity()) {
        e.preventDefault();

        // Sur mobile, on "scroll" jusqu'au premier champ invalide
        const firstInvalid = this.querySelector(':invalid');
        if (firstInvalid && typeof firstInvalid.scrollIntoView === 'function') {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          try { firstInvalid.focus({ preventScroll: true }); } catch(_) { try { firstInvalid.focus(); } catch(__) {} }
        }

        if (typeof this.reportValidity === 'function') this.reportValidity();
        this.dataset.sending = '0';
        return;
      }

      // Laisse Netlify soumettre le formulaire (ne pas preventDefault)
      // (reset sécurité si jamais la page ne navigue pas)
      setTimeout(() => { this.dataset.sending = '0'; }, 3000);
      return;
    }

    e.preventDefault();
    // --- Anti double-envoi (double clic / double écouteur externe) ---
    if (this.dataset.sending === '1') return; // déjà en cours
    this.dataset.sending = '1';
    // -----------------------------------------------------------------

    // Remplir date/heure formatées + séparées AVANT la création du FormData
    const raw = this.datetime.value;
    const d = new Date(raw);
    const dateOnly = isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const timeOnly = isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    this.formatted_datetime.value = formatDateTime(raw);
    const dateField = document.getElementById('date_only');
    const timeField = document.getElementById('time_only');
    if (dateField) dateField.value = dateOnly;
    if (timeField) timeField.value = timeOnly;

    // Force paiement à bord si le champ n'existe pas en HTML
    const paiement = (this.paiement && this.paiement.value) ? this.paiement.value : 'bord';

    // Crée l'objet à partir des champs (inclut formatted_datetime / date / heure)
    const data = Object.fromEntries(new FormData(this));

    // Params pour l'admin (inclut datetime + date + heure)
    const adminParams = {
      prenom: data.prenom, nom: data.nom, telephone: data.telephone, email: data.email,
      pickup: data.pickup, dropoff: data.dropoff,
      datetime: data.formatted_datetime, date: data.date, heure: data.heure,
      passager: data.passager, valise: data.valise, vehicle: data.vehicle,
      price: data.price, price_base: data.price_base, promo_code: data.promo_code, promo_percent: data.promo_percent, paiement: paiement, comment: data.comment
    };

    // Params pour le client (idem)
    const clientParams = {
      prenom: data.prenom, email: data.email,
      pickup: data.pickup, dropoff: data.dropoff,
      datetime: data.formatted_datetime, date: data.date, heure: data.heure,
      passager: data.passager, valise: data.valise, vehicle: data.vehicle,
      price: data.price, price_base: data.price_base, promo_code: data.promo_code, promo_percent: data.promo_percent, paiement: paiement, comment: data.comment
    };

    sendBoth('service_t6wbumm', 'pfmq1db', adminParams, 'zm78zvv', clientParams)
      .then(() => {
        alert('Réservation envoyée avec succès.');
        this.reset();

        const promoField = this.querySelector('input[name="promo_code"]');
        if (promoField) promoField.value = '';
        const ps = document.getElementById('promo_status');
        if (ps) ps.textContent = '';


        // Remet Éco par défaut + nettoie les estimations
        const selVeh = this.querySelector('select[name="vehicle"]');
        if (selVeh) selVeh.value = 'eco';
        const dist = document.getElementById('distance');
        const est  = document.getElementById('estimation');
        if (dist) dist.textContent = '';
        if (est)  est.textContent  = '';
      })
      .catch(err => {
        console.error('Erreur EmailJS :', err);
        alert('Erreur lors de l’envoi. Veuillez réessayer.');
      })
      .finally(() => {
        // réautorise une nouvelle réservation plus tard
        this.dataset.sending = '0';
      });
  });
});

// ========================================
// ✅ Auto offset body padding for fixed header
// (Fixes pages where H1 is hidden behind header)
// ========================================
(function () {
  function setHeaderOffset() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var h = header.offsetHeight || 0;
    // keep a minimum in case fonts not loaded yet
    if (h < 80) h = 120;
    document.documentElement.style.setProperty('--header-offset', h + 'px');
  }

  var t;
  function schedule() {
    if (t) clearTimeout(t);
    t = setTimeout(setHeaderOffset, 50);
  }

  document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
})();

