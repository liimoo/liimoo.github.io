/* Record which public entry led to City Blade; never block navigation. */
(() => {
  'use strict';
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[data-blade-placement]') : null;
    if (!link || link.origin !== location.origin || link.pathname !== '/blade/' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'blade_entry_click', {
      page_path: location.pathname,
      placement: link.dataset.bladePlacement,
      transport_type: 'beacon'
    });
  }, true);
})();
