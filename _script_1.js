
    function checkPassword() {
      const pwd = document.getElementById("password").value;
      if (pwd === "Abarkan10") {
        document.getElementById("admin-panel").style.display = "block";
        // Remplir les champs avec les valeurs enregistrées
        document.getElementById('prix-min').value        = localStorage.getItem('prixMinEco')       || '';
        document.getElementById('prix-km-eco').value     = localStorage.getItem('prixKmEco')        || '';
        document.getElementById('prix-min-eco').value    = localStorage.getItem('prixMinEcoCoef')   || '';
        document.getElementById('prix-min-van').value    = localStorage.getItem('prixMinVan')       || '';
        document.getElementById('prix-km-van').value     = localStorage.getItem('prixKmVan')        || '';
        document.getElementById('prix-min-van-coef').value = localStorage.getItem('prixMinVanCoef') || '';
        document.getElementById('cap-pax').value         = localStorage.getItem('capPax')           || '';
        document.getElementById('cap-bags').value        = localStorage.getItem('capBags')          || '';
        document.getElementById('default-vehicle').value = localStorage.getItem('defaultVehicle')   || 'eco';

        document.getElementById('night-start').value     = localStorage.getItem('nightStart')       || '21:00';
        document.getElementById('night-end').value       = localStorage.getItem('nightEnd')         || '07:00';
        document.getElementById('night-percent').value   = localStorage.getItem('nightPercent')     || '0';
        document.getElementById('dist-threshold').value  = localStorage.getItem('distThresholdKm')  || '35';
        document.getElementById('dist-percent').value    = localStorage.getItem('distPercent')      || '0';
      

        // Charger la liste des codes promo (serveur)
        if (typeof promoRefresh === 'function') { promoRefresh(); }
} else {
        alert("Mot de passe incorrect");
      }
    }

    function saveSettings() {
      localStorage.setItem("prixMinEco",       document.getElementById("prix-min").value);
      localStorage.setItem("prixKmEco",        document.getElementById("prix-km-eco").value);
      localStorage.setItem("prixMinEcoCoef",   document.getElementById("prix-min-eco").value);
      localStorage.setItem("prixMinVan",       document.getElementById("prix-min-van").value);
      localStorage.setItem("prixKmVan",        document.getElementById("prix-km-van").value);
      localStorage.setItem("prixMinVanCoef",   document.getElementById("prix-min-van-coef").value);
      localStorage.setItem("capPax",           document.getElementById("cap-pax").value);
      localStorage.setItem("capBags",          document.getElementById("cap-bags").value);
      localStorage.setItem("defaultVehicle",   document.getElementById("default-vehicle").value);

      localStorage.setItem("nightStart",       document.getElementById("night-start").value);
      localStorage.setItem("nightEnd",         document.getElementById("night-end").value);
      localStorage.setItem("nightPercent",     document.getElementById("night-percent").value);
      localStorage.setItem("distThresholdKm",  document.getElementById("dist-threshold").value);
      localStorage.setItem("distPercent",      document.getElementById("dist-percent").value);

      alert("Paramètres enregistrés !");
    }

    function resetSettings() {
      ["prixMinEco","prixKmEco","prixMinEcoCoef","prixMinVan","prixKmVan","prixMinVanCoef",
       "capPax","capBags","defaultVehicle","nightStart","nightEnd","nightPercent",
       "distThresholdKm","distPercent"].forEach(k => localStorage.removeItem(k));
      alert("Paramètres réinitialisés.");
    }
  