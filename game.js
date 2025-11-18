// game.js - RPG gráfico com sprite sheet, nível e combate simples

const SHEET_URL = "https://opengameart.org/sites/default/files/icons_12.png"; // sprite sheet pública

// mapa e tile
const MAP_SIZE = 7;
const TILE = 50; // tamanho em px do tile no canvas (ajuste à vontade)

// elementos DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const logDiv = document.getElementById("log");
const btnInventory = document.getElementById("btn-inventory");
const btnRestart = document.getElementById("btn-restart");

// mapa: 0 = chão, 1 = árvore (obstáculo), 2 = inimigo
let map = [
  [0,0,1,0,0,0,2],
  [0,1,1,0,2,0,0],
  [0,0,0,0,0,1,0],
  [0,2,0,1,0,0,0],
  [0,0,1,0,0,2,1],
  [1,0,0,0,1,0,0],
  [2,0,1,0,0,0,0],
];

// jogador
let player = {
  nome: "Herói",
  x: 0,
  y: 0,
  hp: 30,
  maxHp: 30,
  ataque: 6,
  cura: 6,
  inventario: ["Poção de cura"],
  nivel: 1,
  xp: 0,
  xpProx: 15
};

// variedade de inimigos (base XP), usaremos index para escolher aleatório
const inimigosBase = [
  { nome: "Goblin", hp: 14, ataque: 3, xp: 8 },
  { nome: "Lobo", hp: 18, ataque: 4, xp: 10 },
  { nome: "Bandido", hp: 24, ataque: 6, xp: 16 },
  { nome: "Aranha", hp: 20, ataque: 5, xp: 12 },
  { nome: "Golem", hp: 36, ataque: 9, xp: 26, especial: "defesa" },
  { nome: "Dragão Jovem", hp: 50, ataque: 14, xp: 50, especial: "fogo" }
];

let inimigoAtual = null;

// configuração dos sprites dentro da sheet (sx,sy,sw,sh em px)
const tileSpecs = {
  ground: { sx: 0,  sy: 0,  sw: 24, sh: 24 },
  tree:   { sx: 48, sy: 0,  sw: 24, sh: 24 },
  enemy:  { sx: 72, sy: 0,  sw: 24, sh: 24 },
  hero:   { sx: 96, sy: 0,  sw: 24, sh: 24 }
};

const sprites = { sheet: { src: SHEET_URL } };

// carrega imagens com crossOrigin para reduzir chance de erro CORS
function loadSprites(spritesObj, cb) {
  const keys = Object.keys(spritesObj);
  let loaded = 0;
  if (keys.length === 0) return cb();
  keys.forEach(k => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { loaded++; spritesObj[k].img = img; if (loaded === keys.length) cb(); };
    img.onerror = () => { console.warn("Erro ao carregar", spritesObj[k].src); loaded++; spritesObj[k].img = null; if (loaded === keys.length) cb(); };
    img.src = spritesObj[k].src;
  });
}

function log(txt) {
  const p = document.createElement("div");
  p.textContent = txt;
  logDiv.prepend(p);
  // manter apenas últimas 200 linhas
  while (logDiv.childElementCount > 200) logDiv.removeChild(logDiv.lastChild);
}

function drawTileFromSheet(spec, dx, dy, dSize = TILE) {
  if (!sprites.sheet.img || !spec) {
    // fallback: retângulo colorido
    ctx.fillStyle = "#666";
    ctx.fillRect(dx, dy, dSize, dSize);
    return;
  }
  ctx.drawImage(sprites.sheet.img,
                spec.sx, spec.sy, spec.sw, spec.sh,
                dx, dy, dSize, dSize);
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      const px = c * TILE;
      const py = r * TILE;
      // chão sempre
      drawTileFromSheet(tileSpecs.ground, px, py);
      // obstáculos / inimigos sobre o chão
      if (map[r][c] === 1) drawTileFromSheet(tileSpecs.tree, px, py);
      if (map[r][c] === 2) drawTileFromSheet(tileSpecs.enemy, px, py);
    }
  }
  // desenha jogador por cima
  drawTileFromSheet(tileSpecs.hero, player.x * TILE, player.y * TILE);
}

function showHUD() {
  hud.innerHTML = `
    <strong>${player.nome}</strong> — Nível: ${player.nivel} | XP: ${player.xp}/${player.xpProx}
    <br>Vida: ${player.hp}/${player.maxHp} | Ataque: ${player.ataque} | Poções: ${countItem("Poção de cura")}
    <br>Use as setas do teclado para mover. Encontre inimigos (tiles com inimigos).
  `;
}

function countItem(name) {
  return player.inventario.filter(i => i === name).length;
}

// Inicia combate com inimigo baseado no nivel do jogador
function iniciarCombateEm(nx, ny) {
  // escolhe inimigo com base no nível (quanto maior o nível, maior chance dos inimigos fortes)
  const maxIdx = Math.min(inimigosBase.length - 1, Math.floor(player.nivel / 2) + 2);
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const base = Object.assign({}, inimigosBase[idx]);
  // escala stats com nível
  base.hp += player.nivel * 6;
  base.ataque += Math.floor(player.nivel * 0.9);
  inimigoAtual = base;
  log(`Você encontrou um ${inimigoAtual.nome}!`);
  combateTurno();
}

// Simples sistema de turno (jogador ataca, inimigo ataca)
function combateTurno() {
  if (!inimigoAtual) return;
  // mostra opções no log (no futuro podemos abrir UI)
  // ataque do jogador automático quando encontra: dano variável
  const danoPlayer = player.ataque + Math.floor(Math.random() * 3);
  inimigoAtual.hp -= danoPlayer;
  log(`Você ataca ${inimigoAtual.nome} e causa ${danoPlayer} de dano.`);
  if (inimigoAtual.hp <= 0) {
    // vitória
    log(`Você derrotou o ${inimigoAtual.nome}! Ganhou ${inimigoAtual.xp} XP.`);
    player.xp += inimigoAtual.xp;
    // drop chance
    if (Math.random() < 0.7) {
      player.inventario.push("Poção de cura");
      log("Você encontrou uma Poção de cura!");
    }
    // recupera um pouco
    player.hp = Math.min(player.maxHp, player.hp + 5 + player.nivel);
    // remover inimigo do mapa (procura tile mais próximo)
    removeNearestEnemyTile();
    // checar level up
    checarLevelUp();
    inimigoAtual = null;
    drawGrid();
    showHUD();
    return;
  }

  // inimigo contra-ataca
  let danoInimigo = inimigoAtual.ataque + Math.floor(Math.random() * 3);
  // efeitos especiais
  if (inimigoAtual.especial === "fogo" && Math.random() < 0.25) {
    danoInimigo += 4;
    log("Ataque especial: fogo!");
  }
  if (inimigoAtual.especial === "defesa" && Math.random() < 0.3) {
    inimigoAtual.hp += 6;
    log(`${inimigoAtual.nome} regenera algumas partículas de pedra! (+6 HP)`);
  }
  player.hp -= danoInimigo;
  log(`${inimigoAtual.nome} ataca e causa ${danoInimigo} de dano.`);
  showHUD();

  if (player.hp <= 0) {
    log("Você foi derrotado!");
    alert("Você foi derrotado! Reiniciando o jogo...");
    reiniciarJogo();
    return;
  }

  // turno termina, espera próximo movimento (neste exemplo o combate acontece automaticamente ao entrar no tile)
}

// Remove a primeira tile inimigo encontrada próxima ao jogador (para simplificar)
function removeNearestEnemyTile() {
  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      if (map[r][c] === 2) {
        // achamos um inimigo: se estiver próximo ou não, vamos remover o que estava no tile que o jogador entrou
        // para garantir, preferimos remover o que estiver na mesma posição do jogador se existir
        if (r === player.y && c === player.x) {
          map[r][c] = 0;
          return;
        }
      }
    }
  }
  // fallback: tenta limpar o tile em que o jogador se encontra
  if (map[player.y][player.x] === 2) map[player.y][player.x] = 0;
}

// checa e aplica subida de nível
function checarLevelUp() {
  while (player.xp >= player.xpProx) {
    player.xp -= player.xpProx;
    player.nivel++;
    player.xpProx = Math.floor(player.xpProx * 1.6 + player.nivel * 8);
    player.maxHp += 8;
    player.ataque += 2;
    player.cura += 2;
    player.hp = player.maxHp; // cura ao subir de nível
    log(`🎉 Você subiu para o nível ${player.nivel}! Stats aumentados.`);
  }
  showHUD();
}

// usar poção
function usarPocao() {
  const idx = player.inventario.indexOf("Poção de cura");
  if (idx > -1) {
    player.hp = Math.min(player.maxHp, player.hp + player.cura);
    player.inventario.splice(idx, 1);
    log("Você usou uma Poção de cura.");
  } else {
    log("Você não tem poção!");
  }
  showHUD();
}

// movimento e interação
window.addEventListener("keydown", e => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
  let dx = 0, dy = 0;
  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;
  if (dx === 0 && dy === 0) return;

  const nx = player.x + dx;
  const ny = player.y + dy;
  if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) {
    log("Limite do mapa.");
    return;
  }
  // obstáculo
  if (map[ny][nx] === 1) {
    log("Há um obstáculo (árvore).");
    return;
  }
  // inimigo
  if (map[ny][nx] === 2) {
    // move para o tile e inicia combate
    player.x = nx; player.y = ny;
    drawGrid();
    showHUD();
    iniciarCombateEm(nx, ny);
    return;
  }
  // mover normalmente
  player.x = nx; player.y = ny;
  drawGrid();
  showHUD();
});

// botões UI
btnInventory.addEventListener("click", () => {
  alert("Inventário: " + (player.inventario.length ? player.inventario.join(", ") : "Vazio"));
});
btnRestart.addEventListener("click", () => {
  if (confirm("Reiniciar o jogo?")) reiniciarJogo();
});

function reiniciarJogo() {
  // reset player
  player = {
    nome: "Herói",
    x: 0, y: 0,
    hp: 30, maxHp: 30,
    ataque: 6, cura: 6,
    inventario: ["Poção de cura"],
    nivel: 1, xp: 0, xpProx: 15
  };
  // recria mapa com inimigos (padrão)
  map = [
    [0,0,1,0,0,0,2],
    [0,1,1,0,2,0,0],
    [0,0,0,0,0,1,0],
    [0,2,0,1,0,0,0],
    [0,0,1,0,0,2,1],
    [1,0,0,0,1,0,0],
    [2,0,1,0,0,0,0],
  ];
  inimigoAtual = null;
  log("Jogo reiniciado.");
  drawGrid(); showHUD();
}

// Carregamento inicial
loadSprites(sprites, () => {
  drawGrid();
  showHUD();
  log("Jogo carregado. Use as setas para se mover e encontrar inimigos.");
});
