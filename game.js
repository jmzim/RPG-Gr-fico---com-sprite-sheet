// game.js - RPG gráfico com sprite sheet, nível e combate simples
// Versão corrigida: mostra status de carregamento da sprite sheet, fallback visível,
// corrige remoção de inimigo no tile correto e reduz drop excessivo de poções.

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
const btnHeal = document.getElementById("btn-heal");

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

// variedade de inimigos (base XP)
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
// OBS: se os recortes não baterem com a sheet, ajuste os valores aqui.
const tileSpecs = {
  ground: { sx: 0,  sy: 0,  sw: 24, sh: 24 },
  tree:   { sx: 48, sy: 0,  sw: 24, sh: 24 },
  enemy:  { sx: 72, sy: 0,  sw: 24, sh: 24 },
  hero:   { sx: 96, sy: 0,  sw: 24, sh: 24 }
};

const sprites = { sheet: { src: SHEET_URL, img: null, loaded: false } };

// carrega imagens com crossOrigin para reduzir chance de erro CORS
function loadSprites(spritesObj, cb) {
  const keys = Object.keys(spritesObj);
  let loaded = 0;
  if (keys.length === 0) return cb();
  keys.forEach(k => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      loaded++;
      spritesObj[k].img = img;
      spritesObj[k].loaded = true;
      console.log(`[loadSprites] carregado: ${spritesObj[k].src}`);
      if (loaded === keys.length) cb();
    };
    img.onerror = (ev) => {
      loaded++;
      spritesObj[k].img = null;
      spritesObj[k].loaded = false;
      console.warn(`[loadSprites] erro ao carregar: ${spritesObj[k].src}`, ev);
      if (loaded === keys.length) cb();
    };
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
    // fallback: retângulo colorido (mais visível)
    ctx.fillStyle = "#6b6b6b";
    ctx.fillRect(dx, dy, dSize, dSize);
    ctx.strokeStyle = "#333";
    ctx.strokeRect(dx+1, dy+1, dSize-2, dSize-2);
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
      if (map[r][c] === 1) {
        // se sprite não carregou, desenhar árvore estilizada
        if (!sprites.sheet.img) {
          ctx.fillStyle = "#2b8b2b";
          ctx.fillRect(px + 10, py + 6, TILE - 20, TILE - 20);
        } else {
          drawTileFromSheet(tileSpecs.tree, px, py);
        }
      }
      if (map[r][c] === 2) {
        if (!sprites.sheet.img) {
          ctx.fillStyle = "#8b2b2b";
          ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        } else {
          drawTileFromSheet(tileSpecs.enemy, px, py);
        }
      }
    }
  }
  // desenha jogador por cima (se sprite ausente, desenha um triângulo simples)
  if (!sprites.sheet.img) {
    ctx.fillStyle = "#ffd166";
    const cx = player.x * TILE + TILE / 2;
    const cy = player.y * TILE + TILE / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 12, cy + 10);
    ctx.lineTo(cx + 12, cy + 10);
    ctx.closePath();
    ctx.fill();
  } else {
    drawTileFromSheet(tileSpecs.hero, player.x * TILE, player.y * TILE);
  }
}

function showHUD() {
  const spritesOk = sprites.sheet.loaded ? "Sim" : "Não";
  hud.innerHTML = `
    <strong>${player.nome}</strong> — Nível: ${player.nivel} | XP: ${player.xp}/${player.xpProx}
    <br>Vida: ${player.hp}/${player.maxHp} | Ataque: ${player.ataque} | Poções: ${countItem("Poção de cura")}
    <br>Sprites carregados: <strong>${spritesOk}</strong>
    <br>Use as setas do teclado para mover. Encontre inimigos (tiles com inimigos).
  `;
}

function countItem(name) {
  return player.inventario.filter(i => i === name).length;
}

// Inicia combate com inimigo baseado no nivel do jogador
function iniciarCombateEm(nx, ny) {
  const maxIdx = Math.min(inimigosBase.length - 1, Math.floor(player.nivel / 2) + 2);
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const base = Object.assign({}, inimigosBase[idx]);
  base.hp += player.nivel * 6;
  base.ataque += Math.floor(player.nivel * 0.9);
  inimigoAtual = base;
  log(`Você encontrou um ${inimigoAtual.nome}!`);
  // Não executar todos os turns automaticamente — vamos executar até um turno por chamada
  combateTurno(nx, ny);
}

// Simples sistema de turno (jogador ataca, inimigo ataca)
function combateTurno(nx, ny) {
  if (!inimigoAtual) return;
  const danoPlayer = player.ataque + Math.floor(Math.random() * 3);
  inimigoAtual.hp -= danoPlayer;
  log(`Você ataca ${inimigoAtual.nome} e causa ${danoPlayer} de dano.`);
  if (inimigoAtual.hp <= 0) {
    // vitória
    log(`Você derrotou o ${inimigoAtual.nome}! Ganhou ${inimigoAtual.xp} XP.`);
    player.xp += inimigoAtual.xp;
    // drop chance reduzida
    if (Math.random() < 0.45) {
      player.inventario.push("Poção de cura");
      log("Você encontrou uma Poção de cura!");
    }
    player.hp = Math.min(player.maxHp, player.hp + 5 + player.nivel);
    // remover inimigo do tile específico (nx, ny) — usa as coordenadas passadas
    if (typeof nx === "number" && typeof ny === "number") {
      if (map[ny] && map[ny][nx] === 2) map[ny][nx] = 0;
    } else {
      // fallback: limpa o tile do jogador
      if (map[player.y] && map[player.y][player.x] === 2) map[player.y][player.x] = 0;
    }
    checarLevelUp();
    inimigoAtual = null;
    drawGrid();
    showHUD();
    return;
  }

  // inimigo contra-ataca
  let danoInimigo = inimigoAtual.ataque + Math.floor(Math.random() * 3);
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

  // mantém inimigoAtual para possível continuidade (se quiser mais turnos depois)
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
    // move para o tile e inicia combate (passa nx, ny para remover corretamente)
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
btnHeal.addEventListener("click", () => usarPocao());

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
  if (sprites.sheet.loaded) {
    console.log("[game] sprite sheet carregada com sucesso.");
    log("Sprite sheet carregada com sucesso.");
  } else {
    console.warn("[game] sprite sheet NÃO carregou — usando fallback visual.");
    log("Aviso: sprite sheet não carregou. O jogo continuará com gráficos fallback.");
  }
  drawGrid();
  showHUD();
  log("Jogo carregado. Use as setas para se mover e encontrar inimigos.");
});
