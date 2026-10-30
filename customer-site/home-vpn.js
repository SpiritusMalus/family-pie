(() => {
  'use strict';
  const isHome = () => location.pathname === '/' || location.pathname === '/index.html';
  if (!isHome()) return;
  const legacyHashes = new Set(['#vpn-features', '#vpn-pricing']);
  const followLegacyAnchor = () => {
    if (isHome() && legacyHashes.has(location.hash)) {
      location.replace('/vpn/' + location.search + location.hash);
    }
  };
  window.addEventListener('hashchange', followLegacyAnchor);
  followLegacyAnchor();
})();
