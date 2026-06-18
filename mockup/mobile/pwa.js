// Enregistrement du service worker + invite/aide à l'installation.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

(function () {
  // Déjà installée (mode standalone) → aucune invite.
  var standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (standalone) return;

  // Desktop (pointeur précis) → on garde la maquette propre, pas de bandeau.
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  var ua = navigator.userAgent;
  var isIOS = /iphone|ipad|ipod/i.test(ua);
  var isChromeIOS = /crios/i.test(ua); // Chrome sur iOS

  // Glyphe « Partager » iOS (carré + flèche vers le haut) pour repérage visuel.
  var SHARE =
    '<svg class="pwa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  function banner(html) {
    var b = document.createElement('div');
    b.className = 'pwa-banner';
    b.innerHTML = html + '<button class="x" aria-label="Fermer">✕</button>';
    document.body.appendChild(b);
    b.querySelector('.x').onclick = function () {
      b.remove();
    };
    return b;
  }

  // Android / Chrome : vraie invite native déclenchable.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    var b = banner(
      '<span>Installer <b>Relvo</b> sur votre écran d’accueil</span><button class="go">Installer</button>'
    );
    b.querySelector('.go').onclick = async function () {
      e.prompt();
      await e.userChoice;
      b.remove();
    };
  });

  // iOS : pas d'invite possible → aide au geste manuel, adaptée au navigateur.
  if (isIOS) {
    var steps = isChromeIOS
      ? 'touchez ' + SHARE + ' (en haut à droite) → <b>Plus</b> ••• → <b>Sur l’écran d’accueil</b>'
      : 'touchez ' + SHARE + ' (en bas) → <b>Sur l’écran d’accueil</b>';
    banner('<span>Installer <b>Relvo</b> : ' + steps + '</span>');
  }
})();
