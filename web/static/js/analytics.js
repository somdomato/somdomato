// Heartbeat de "online agora" para o painel de estatísticas do admin — só
// mantém o visitante marcado como online enquanto a aba fica aberta (um
// pageview sozinho não cobre alguém parado ouvindo rádio por horas na
// mesma página). Fire-and-forget via sendBeacon, sem resposta esperada.
(function () {
  // Reexecutado a cada navegação via hx-boost (ver player.js): sem a guarda,
  // cada navegação somava mais um setInterval e mais um listener.
  if (window.sdmAnalyticsInit) return;
  window.sdmAnalyticsInit = true;

  function ping() {
    var url = "/track/ping?path=" + encodeURIComponent(location.pathname);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { method: "POST", keepalive: true }).catch(function () {});
    }
  }

  ping();
  setInterval(ping, 20000);
  document.body.addEventListener("htmx:afterSwap", ping);
})();
