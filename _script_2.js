

    // ==========================
    // Promo codes (Netlify Functions)
    // ==========================
    function promoNormalize(code){
      return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);
    }

function promoNotice(text, isError){
      const el = document.getElementById('promo-msg');
      if (!el) return;
      el.textContent = text || '';
      el.style.color = isError ? '#b71c1c' : '#2e7d32';
    }


    async function promoApi(path, method, body){
      const pwd = document.getElementById("password")?.value || "";
      const headers = { "content-type": "application/json; charset=utf-8", "x-admin-key": pwd };
      const opts = { method, headers, cache: "no-store" };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || (`HTTP ${res.status}`));
      return json;
    }

    function promoRow(item){
      const code = item.code;
      const percent = item.percent;
      const active = item.active !== false;

      const shareUrl = `${location.origin}/?promo=${encodeURIComponent(code)}`;

      return `
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid #e6e6e6;border-radius:10px;margin:8px 0;background:#fff;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:700;letter-spacing:.02em;">${code} <span style="font-weight:600;color:#666;">- ${percent}%</span></div>
            <div style="font-size:13px;color:${active ? "#2e7d32" : "#b71c1c"};">${active ? "Actif" : "Désactivé"}</div>
            <div style="font-size:12px;color:#777;word-break:break-all;">Lien : ${shareUrl}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="secondary" type="button" onclick="promoCopy('${code}')">Copier lien</button>
            <button class="secondary" type="button" onclick="promoToggle('${code}', ${active ? "false" : "true"}, ${percent})">${active ? "Désactiver" : "Activer"}</button>
            <button class="secondary" type="button" onclick="promoDelete('${code}')">Supprimer</button>
          </div>
        </div>
      `;
    }

    async function promoRefresh(){
      try{
        const data = await promoApi('/.netlify/functions/promo-admin', 'GET');
        const list = (data.codes || []);
        const box = document.getElementById('promo-list');
        if (!box) return;
        if (!list.length){
          box.innerHTML = '<div style="color:#777;font-size:14px;">Aucun code promo pour le moment.</div>';
          return;
        }
        box.innerHTML = list.map(promoRow).join('');
      }catch(e){
        promoNotice("Impossible de charger la liste des codes promo (mot de passe/ADMIN_CODE ou Functions).", true);
        alert("Impossible de charger la liste des codes promo. Vérifiez votre mot de passe et la variable Netlify ADMIN_CODE.");
      }
    }

    async function promoUpsert(){
      const codeEl = document.getElementById('promo-code');
      const pctEl  = document.getElementById('promo-percent');
      const actEl  = document.getElementById('promo-active');
      const code = promoNormalize(codeEl?.value || "");
      const percent = Number(pctEl?.value || 0);
      const active = (actEl?.value !== "false");

      if (!code || !percent){
        alert("Veuillez saisir un code promo et un pourcentage.");
        return;
      }
      try{
        promoNotice('Enregistrement du code…', false);
        await promoApi('/.netlify/functions/promo-admin', 'POST', { code, percent, active });
        if (codeEl) codeEl.value = code;
        await promoRefresh();
        promoNotice('Code promo enregistré.', false);
        alert("Code promo enregistré.");
      }catch(e){
        promoNotice('Erreur : ' + (e && e.message ? e.message : 'enregistrement impossible'), true);
        alert("Erreur lors de l'enregistrement du code promo.");
      }
    }

    async function promoDelete(code){
      if (!confirm("Supprimer le code " + code + " ?")) return;
      try{
        await promoApi('/.netlify/functions/promo-admin', 'POST', { action:'delete', code });
        await promoRefresh();
      }catch(e){
        alert("Erreur : " + (e && e.message ? e.message : "suppression impossible"));
      }
    }

    async function promoToggle(code, active, percent){
      try{
        promoNotice('Enregistrement du code…', false);
        await promoApi('/.netlify/functions/promo-admin', 'POST', { code, percent, active });
        await promoRefresh();
      }catch(e){
        alert("Erreur : " + (e && e.message ? e.message : "mise à jour impossible"));
      }
    }

    async function promoCopy(code){
      const url = `${location.origin}/?promo=${encodeURIComponent(code)}`;
      try{
        await navigator.clipboard.writeText(url);
        alert("Lien copié : " + url);
      }catch(_){
        prompt("Copiez le lien :", url);
      }
    }

