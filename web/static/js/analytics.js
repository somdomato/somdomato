// Heartbeat de "online agora" para o painel de estatísticas do admin — só
// mantém o visitante marcado como online enquanto a aba fica aberta (um
// pageview sozinho não cobre alguém parado ouvindo rádio por horas na
// mesma página). Fire-and-forget via sendBeacon, sem resposta esperada.
(function () {
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
