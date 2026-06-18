// Enregistrement du service worker + invite/aide à l'installation.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

(function () {
  // Déjà installée (mode standalone) → aucune invite.
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;

  // Desktop (pointeur précis) → on garde la maquette propre, pas de bandeau.
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  function banner(html) {
    var b = document.createElement('div');
    b.className = 'pwa-banner';
    b.innerHTML = html + '<button class="x" aria-label="Fermer">✕</button>';
    document.body.appendChild(b);
    b.querySelector('.x').onclick = function () { b.remove(); };
    return b;
  }

  // Android / Chrome : vraie invite native déclenchable.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    var b = banner('<span>Installer <b>Relvo</b> sur votre écran d’accueil</span><button class="go">Installer</button>');
    b.querySelector('.go').onclick = async function () {
      e.prompt();
      await e.userChoice;
      b.remove();
    };
  });

  // iOS / Safari : pas d'invite possible → bandeau d'aide au geste manuel.
  if (isIOS) {
    banner('<span>Pour installer : <b>Partager</b> ↑ puis <b>« Sur l’écran d’accueil »</b></span>');
  }
})();
