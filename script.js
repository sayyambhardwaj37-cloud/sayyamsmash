
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = (id) => document.getElementById(id);

const startScreen = $("startScreen");
const gameOverScreen = $("gameOverScreen");

let width = 0;
let height = 0;
let running = false;
let lastTime = 0;

let player;
let objects = [];
let distance = 0;
let coins = 0;
let score = 0;
let speed = 0.38;
let spawnTimer = 0;
let roadOffset = 0;
let messageTimer = 0;

const lanePositions = [-1, 0, 1];

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function resetGame() {
  player = {
    lane: 0,
    xLane: 0,
    jump: 0,
    jumpVelocity: 0,
    sliding: false,
    slideTimer: 0
  };

  objects = [];
  distance = 0;
  coins = 0;
  score = 0;
  speed = 0.38;
  spawnTimer = 0.8;
  roadOffset = 0;
  messageTimer = 0;

  updateHUD();
}

function startGame() {
  resetGame();

  running = true;
  lastTime = performance.now();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
}

function endGame() {
  if (!running) return;

  running = false;

  $("finalDistance").textContent = Math.floor(distance) + " m";
  $("finalCoins").textContent = coins;
  $("finalScore").textContent = score.toLocaleString();

  gameOverScreen.classList.remove("hidden");
}

$("startButton").addEventListener("click", startGame);
$("restartButton").addEventListener("click", startGame);

function move(action) {
  if (!running) return;

  if (action === "left") {
    player.lane = Math.max(-1, player.lane - 1);
  }

  if (action === "right") {
    player.lane = Math.min(1, player.lane + 1);
  }

  if (action === "jump" && player.jump === 0 && !player.sliding) {
    player.jumpVelocity = 760;
  }

  if (action === "slide" && player.jump === 0 && !player.sliding) {
    player.sliding = true;
    player.slideTimer = 0.65;
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (
    ["arrowleft", "arrowright", "arrowup", "arrowdown", " "]
      .includes(key)
  ) {
    event.preventDefault();
  }

  if (key === "arrowleft" || key === "a") move("left");
  if (key === "arrowright" || key === "d") move("right");
  if (key === "arrowup" || key === "w" || key === " ") move("jump");
  if (key === "arrowdown" || key === "s") move("slide");

  if (key === "enter" && !running) startGame();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    move(button.dataset.action);
  });
});

// Swipe controls for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy < 0 ? "jump" : "slide");
  }
}, { passive: true });

function updateHUD() {
  $("distance").textContent = Math.floor(distance) + " m";
  $("coins").textContent = coins;
  $("score").textContent = score.toLocaleString();
}

function spawnObject() {
  const lane = lanePositions[Math.floor(Math.random() * 3)];
  const roll = Math.random();

  if (roll < 0.28) {
    objects.push({ type: "block", lane, z: 0, checked: false });
  } else if (roll < 0.55) {
    objects.push({ type: "gate", lane, z: 0, checked: false });
  } else if (roll < 0.76) {
    objects.push({ type: "rock", lane, z: 0, checked: false });
  } else {
    for (let i = 0; i < 5; i++) {
      objects.push({
        type: "coin",
        lane,
        z: -i * 0.09,
        checked: false
      });
    }
  }
}

function update(dt) {
  if (!running) return;

  distance += speed * dt * 22;
  speed = Math.min(0.78, 0.38 + distance * 0.00025);

  score = Math.floor(distance * 10) + coins * 50;

  player.xLane += (player.lane - player.xLane) *
    Math.min(1, dt * 12);

  // Jump physics
  if (player.jumpVelocity !== 0 || player.jump > 0) {
    player.jump += player.jumpVelocity * dt;
    player.jumpVelocity -= 1900 * dt;

    if (player.jump <= 0) {
      player.jump = 0;
      player.jumpVelocity = 0;
    }
  }

  // Slide duration
  if (player.sliding) {
    player.slideTimer -= dt;

    if (player.slideTimer <= 0) {
      player.sliding = false;
    }
  }

  // Move obstacles and coins towards the player
  spawnTimer -= dt;

  if (spawnTimer <= 0) {
    spawnObject();
    spawnTimer = Math.max(0.65, 1.15 - speed * 0.45);
  }

  roadOffset += dt * speed * 0.8;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    obj.z += speed * dt;

    if (
      !obj.checked &&
      obj.z >= 0.84 &&
      obj.z <= 1.02 &&
      Math.abs(obj.lane - player.xLane) < 0.42
    ) {
      obj.checked = true;

      if (obj.type === "coin") {
        coins++;
        score += 50;
        showMessage("+1 COIN");
      } else {
        let safe = false;

        if (obj.type === "block") {
          safe = player.jump > 48;
        } else if (obj.type === "gate") {
          safe = player.sliding;
        } else if (obj.type === "rock") {
          safe = player.jump > 85;
        }

        if (!safe) {
          endGame();
          return;
        }
      }
    }

    if (obj.z > 1.12) {
      objects.splice(i, 1);
    }
  }

  if (messageTimer > 0) {
    messageTimer -= dt;

    if (messageTimer <= 0) {
      $("message").textContent = "";
    }
  }

  updateHUD();
}

function showMessage(text) {
  $("message").textContent = text;
  messageTimer = 0.6;
}

// Draw a polygon
function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }

  ctx.closePath();
  ctx.fill();
}

// Perspective track coordinates
function roadGeometry(z) {
  const horizon = height * 0.30;
  const bottom = height * 1.03;
  const t = Math.max(0, Math.min(1, z));

  const y = horizon + (bottom - horizon) * t;
  const halfWidth = width * (0.07 + 0.40 * t);

  return {
    y,
    left: width / 2 - halfWidth,
    right: width / 2 + halfWidth,
    laneWidth: halfWidth * 2 / 3,
    scale: 0.15 + t * 1.3
  };
}

function laneX(lane, z) {
  const road = roadGeometry(z);
  return width / 2 + lane * road.laneWidth;
}

function drawBackground() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, height);

  sky.addColorStop(0, "#8fc2bd");
  sky.addColorStop(0.48, "#c7c79a");
  sky.addColorStop(1, "#315b35");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Distant hills
  polygon([
    [0, height * .36],
    [width * .12, height * .24],
    [width * .27, height * .34],
    [width * .42, height * .22],
    [width * .60, height * .34],
    [width * .79, height * .23],
    [width, height * .34],
    [width, height * .58],
    [0, height * .58]
  ], "#557b50");

  // Jungle foliage
  for (let side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const t = (i / 11 + roadOffset * .12) % 1;
      const z = .15 + t * .8;
      const road = roadGeometry(z);
      const x = width / 2 + side * (road.right - width / 2 + 15 + 22 * z);
      const y = road.y;
      const r = 8 + z * 33;

      ctx.fillStyle = i % 2 ? "#204b2c" : "#32623a";
      ctx.beginPath();
      ctx.arc(x, y - r * .5, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#62482c";
      ctx.fillRect(x - r * .10, y, r * .20, r * .8);
    }
  }
}

function drawRoad() {
  const horizon = height * .30;
  const bottom = height * 1.04;

  polygon([
    [width / 2 - width * .08, horizon],
    [width / 2 + width * .08, horizon],
    [width * 1.02, bottom],
    [-width * .02, bottom]
  ], "#604b34");

  // Road surface
  polygon([
    [width / 2 - width * .065, horizon],
    [width / 2 + width * .065, horizon],
    [width * .94, bottom],
    [width * .06, bottom]
  ], "#89704c");

  // Side edges
  const top = roadGeometry(0);
  const bot = roadGeometry(1);

  ctx.strokeStyle = "#d6b87b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(top.left, top.y);
  ctx.lineTo(bot.left, bot.y);
  ctx.moveTo(top.right, top.y);
  ctx.lineTo(bot.right, bot.y);
  ctx.stroke();

  // Dashed lane markings
  for (let i = 0; i < 13; i++) {
    const t = (i / 13 + roadOffset * .55) % 1;
    const z1 = .06 + t * .91;
    const z2 = Math.min(.99, z1 + .025 + t * .035);

    const a = roadGeometry(z1);
    const b = roadGeometry(z2);

    for (const lane of [-.5, .5]) {
      const x1 = width / 2 + a.laneWidth * lane;
      const x2 = width / 2 + b.laneWidth * lane;

      polygon([
        [x1 - a.scale * 1.2, a.y],
        [x1 + a.scale * 1.2, a.y],
        [x2 + b.scale * 1.2, b.y],
        [x2 - b.scale * 1.2, b.y]
      ], "#e5d1a1");
    }
  }
}

function drawTemple() {
  const x = width / 2;
  const y = height * .285;

  ctx.fillStyle = "#61543c";
  ctx.fillRect(x - 70, y - 55, 20, 65);
  ctx.fillRect(x + 50, y - 55, 20, 65);
  ctx.fillRect(x - 90, y - 66, 180, 15);

  polygon([
    [x - 88, y - 65],
    [x, y - 100],
    [x + 88, y - 65]
  ], "#796448");

  ctx.fillStyle = "#263d2a";
  ctx.fillRect(x - 29, y - 34, 58, 45);
}

function drawPlayer() {
  const x = laneX(player.xLane, .90);
  const groundY = height * .87 - player.jump * .48;
  const scale = Math.min(width / 700, 1.25);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  if (player.sliding) {
    // Sliding character
    ctx.fillStyle = "#183c3a";
    ctx.fillRect(-32, -30, 64, 24);

    ctx.fillStyle = "#bb8054";
    ctx.beginPath();
    ctx.arc(35, -29, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#24251e";
    ctx.fillRect(25, -43, 18, 8);

    ctx.strokeStyle = "#29332b";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-25, -12);
    ctx.lineTo(-49, 0);
    ctx.moveTo(5, -10);
    ctx.lineTo(34, 0);
    ctx.stroke();
  } else {
    // Legs
    ctx.strokeStyle = "#252f2b";
    ctx.lineWidth = 13;
    ctx.lineCap = "round";

    const swing = player.jump > 0 ? 0 : Math.sin(performance.now() * .018) * 13;

    ctx.beginPath();
    ctx.moveTo(-10, -37);
    ctx.lineTo(-14 + swing, -8);
    ctx.moveTo(10, -37);
    ctx.lineTo(14 - swing, -8);
    ctx.stroke();

    // Shoes
    ctx.strokeStyle = "#151c18";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-14 + swing, -8);
    ctx.lineTo(-24 + swing, -5);
    ctx.moveTo(14 - swing, -8);
    ctx.lineTo(24 - swing, -5);
    ctx.stroke();

    // Body
    ctx.fillStyle = "#1c4540";
    ctx.fillRect(-24, -89, 48, 55);

    // Arms
    ctx.strokeStyle = "#bd8257";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-21, -78);
    ctx.lineTo(-31 - swing * .5, -48);
    ctx.moveTo(21, -78);
    ctx.lineTo(31 + swing * .5, -48);
    ctx.stroke();

    // Head
    ctx.fillStyle = "#c88b60";
    ctx.beginPath();
    ctx.arc(0, -105, 19, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = "#27231c";
    ctx.beginPath();
    ctx.arc(0, -111, 19, Math.PI, Math.PI * 2);
    ctx.lineTo(17, -103);
    ctx.lineTo(-17, -103);
    ctx.fill();

    // Backpack
    ctx.fillStyle = "#9a6136";
    ctx.fillRect(-29, -84, 10, 30);
  }

  ctx.restore();
}

function drawObstacle(obj) {
  const road = roadGeometry(obj.z);
  const x = laneX(obj.lane, obj.z);
  const y = road.y;
  const s = road.scale;

  ctx.save();
  ctx.translate(x, y);

  if (obj.type === "coin") {
    const r = 12 * s;
    const pulse = 0.75 + Math.abs(Math.sin(performance.now() * .006)) * .25;

    ctx.fillStyle = "#b77a13";
    ctx.beginPath();
    ctx.ellipse(0, -r * 2, r * pulse, r, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffe77c";
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.ellipse(0, -r * 2, r * pulse * .68, r * .68, 0, 0, Math.PI * 2);
    ctx.stroke();

  } else if (obj.type === "block") {
    const w = 37 * s;
    const h = 43 * s;

    ctx.fillStyle = "#633b2c";
    ctx.fillRect(-w / 2, -h, w, h);

    ctx.fillStyle = "#a65d3b";
    ctx.fillRect(-w / 2, -h, w, h * .25);

    ctx.fillStyle = "#e1ba6b";
    ctx.fillRect(-w / 2, -h * .58, w, h * .13);

  } else if (obj.type === "gate") {
    const w = 45 * s;
    const h = 65 * s;

    ctx.fillStyle = "#584936";
    ctx.fillRect(-w / 2, -h, 7 * s, h);
    ctx.fillRect(w / 2 - 7 * s, -h, 7 * s, h);

    ctx.fillStyle = "#a64d31";
    ctx.fillRect(-w / 2, -h, w, 12 * s);

  } else if (obj.type === "rock") {
    ctx.fillStyle = "#42483d";
    ctx.beginPath();
    ctx.moveTo(-22 * s, 0);
    ctx.lineTo(-17 * s, -21 * s);
    ctx.lineTo(-5 * s, -29 * s);
    ctx.lineTo(17 * s, -20 * s);
    ctx.lineTo(23 * s, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  drawBackground();
  drawTemple();
  drawRoad();

  // Draw objects from farthest to nearest
  const sorted = [...objects].sort((a, b) => a.z - b.z);

  sorted.forEach(drawObstacle);

  drawPlayer();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.04);
  lastTime = timestamp;

  if (running) {
    update(dt);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// Start with the game scene visible behind the start screen
resetGame();
requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  gameLoop(timestamp);
});
