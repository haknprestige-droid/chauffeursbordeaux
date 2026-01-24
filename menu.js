// Mobile menu (drawer) - HAKNPRESTIGE
(function () {
  const body = document.body;

  // ✅ Fix: adapte automatiquement l'espace en haut (padding-top) à la hauteur réelle du header
  // évite que le texte du haut soit recouvert par le header fixe sur certaines pages.
  function setHeaderHeightVar() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const h = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-h', `${h}px`);
  }
  window.addEventListener('load', setHeaderHeightVar);
  window.addEventListener('resize', setHeaderHeightVar);
  setHeaderHeightVar();

  const btn = document.querySelector('.menu-btn');
  const overlay = document.getElementById('menuOverlay');
  // Compat: certains fichiers avaient "mobileDrawer" au lieu de "mobileMenu"
  const drawer = document.getElementById('mobileMenu') || document.getElementById('mobileDrawer');
  const closeBtn = drawer ? drawer.querySelector('.drawer-close') : null;

  if (!btn || !overlay || !drawer) return;

  let scrollY = 0;
  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  function unlockScroll() {
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  function openMenu() {
    lockScroll();
    body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    unlockScroll();
  }

  btn.addEventListener('click', function () {
    if (body.classList.contains('menu-open')) closeMenu();
    else openMenu();
  });

  overlay.addEventListener('click', closeMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
})();