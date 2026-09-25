"use strict";

function render() {
  detachCampaignMap();
  if (!state) {
    $("#app").innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#aec4d1;background:#0d1821;"><h1>Aguardando Criação da Dinastia...</h1></div>';
    return;
  }
  const resourceRates = rates();
  const king = state.people.find((person) => person.id === state.king);
  const debuts = alive().filter((person) => person.debut).length;
  const resources = [
    ["wood", "Madeira Real", "♧"],
    ["iron", "Ferro Real", "◆"],
    ["food", "Alimento Real", "♨"],
    ["gold", "Tesouro Real", "◉"],
  ].map(([key, name, icon]) =>
    '<div class="resource" title="' + name + ': cofre real da Coroa"><span class="res-icon">' + icon + '</span><div><small>' + name + '</small><b>' + Math.floor(state[key] || 0) + '</b><em title="Saldo econômico do último dia: produção e tributos menos consumo. Construções e recrutamento não entram neste saldo." class="' + (resourceRates[key] < 0 ? "bad" : "good") + '">' + (resourceRates[key] >= 0 ? "+" : "") + resourceRates[key].toFixed(1) + '</em></div></div>',
  ).join("");
  const tabs = NAV.map(([key, icon, name]) =>
    '<button data-view="' + key + '" class="' + (view === key ? "active" : "") + '"><span>' + icon + '</span>' + name + (key === "people" && debuts ? '<em class="badge">' + debuts + '</em>' : "") + '</button>',
  ).join("");
  const speedButtons = [
    [0, "Ⅱ", "Pausar"],
    [1, "▶", "Velocidade normal"],
    [3, "3×", "Velocidade tripla"],
  ].map(([value, label, aria]) =>
    '<button data-speed="' + value + '" aria-label="' + aria + '" class="' + (speed === value ? "active" : "") + '">' + label + '</button>',
  ).join("");
  const views = {
    map: mapView,
    people: peopleView,
    build: buildView,
    economy: economyView,
    dynasty: dynastyView,
    army: armyView,
    hierarchy: typeof hierarchyView === "function" ? hierarchyView : () => "",
  };
  const migration = state.legacy
    ? '<div class="migration">Seu império anterior foi preservado. Para começar com um pioneiro sozinho, escolha <button data-action="reset">Nova campanha</button>. <button data-action="dismiss-legacy" aria-label="Ocultar aviso">×</button></div>'
    : !alive().length
      ? '<div class="migration">Sua linhagem terminou. <button data-action="reset">Iniciar nova campanha</button></div>'
      : "";
  $("#app").innerHTML =
    '<header class="topbar"><button class="brand" data-view="map" aria-label="Voltar ao mapa"><span class="crest">♜</span><span>IMPÉRIO<br><b>DOS PIXELS</b></span></button><div class="resources">' + resources + '<div class="resource population"><span class="res-icon">♙</span><div><small>Moradores</small><b>' + alive().length + '<span class="muted">/' + capacity() + '</span></b></div></div></div><button data-action="menu" class="menu-button" aria-label="Menu e progresso">☰</button></header><nav class="tabs" aria-label="Gerenciamento do império">' + tabs + '</nav><main class="' + (view === "map" ? "map-main" : "") + '"><div class="commandbar"><div><h1>' + (view === "map" ? "Terras de " + esc(king?.family || "Valen") : NAV.find((item) => item[0] === view)?.[2] || "Hierarquia") + '</h1><span class="region">' + season() + " · " + temperature() + " °C (" + (REGIONS[state.region]?.name || "Norte") + ')</span></div><div class="clock"><span>' + date() + '</span><div class="speed">' + speedButtons + '<button data-action="day" title="Avançar um dia" aria-label="Avançar um dia">↦</button></div></div></div>' + migration + '<div class="workspace ' + (view === "map" ? "map-workspace" : "") + '">' + views[view]() + '</div></main><footer><span class="status">' + (speed === 0 ? "Ⅱ Pausado" : "▶ Tempo correndo") + ' <span class="desktop-only">· ' + (saveFailed ? "Falha ao salvar: exporte seu progresso." : "Progresso local") + '</span></span><button class="chronicle-link" data-action="chronicle">' + esc(state.logs[0]?.text || "") + ' <span>Crônicas ↗</span></button><button data-action="help" class="help-link">? Guia</button></footer>';
  if (view === "map") drawMap();
}
