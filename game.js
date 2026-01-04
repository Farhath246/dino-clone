// ===== CANVAS SETUP =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("startScreen");
const currentScoreEl = document.getElementById("currentScore");
const highScoreEl = document.getElementById("highScore");

// ===== GAME CONSTANTS =====
let LOGICAL_WIDTH, LOGICAL_HEIGHT;
let GROUND_Y; // will be computed on resize
const INITIAL_SPEED = 8;
const MAX_SPEED = 20;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const DAY_NIGHT_INTERVAL = 700; // Score interval for day/night toggle

// ===== GAME STATE =====
let gameSpeed = INITIAL_SPEED;
let score = 0;
let highScore = parseInt(localStorage.getItem("dinoHighScore")) || 0;
let gameOver = false;
let gameStarted = false;
let isDay = true;
let frameCount = 0;

// ===== PLAYER =====
const player = {
  x: 80,
  y: 0,
  width: 44,
  height: 48,
  duckWidth: 58,
  duckHeight: 28,
  yVelocity: 0,
  isDucking: false,
  isJumping: false,
  runFrame: 0,
  
  get currentWidth() {
    return this.isDucking ? this.duckWidth : this.width;
  },
  get currentHeight() {
    return this.isDucking ? this.duckHeight : this.height;
  },
  get groundY() {
    return GROUND_Y - this.currentHeight;
  }
};

// ===== OBSTACLES =====
let groundObstacles = [];
let flyingObstacles = [];
let clouds = [];
let groundTiles = [];

// Obstacle types
const CACTUS_TYPES = [
  { width: 20, height: 40 },  // Small
  { width: 25, height: 50 },  // Medium
  { width: 35, height: 55 },  // Large
  { width: 50, height: 45 },  // Double
];

// bird positions computed when spawning flying obstacles

// ===== INITIALIZATION =====
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  LOGICAL_WIDTH = Math.min(window.innerWidth - 20, 1000);
  LOGICAL_HEIGHT = Math.round(LOGICAL_WIDTH * 0.3);

  canvas.style.width = LOGICAL_WIDTH + "px";
  canvas.style.height = LOGICAL_HEIGHT + "px";

  canvas.width = LOGICAL_WIDTH * dpr;
  canvas.height = LOGICAL_HEIGHT * dpr;

  // Keep drawing coordinates in logical pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  GROUND_Y = LOGICAL_HEIGHT - 50;
}

// ===== INITIALIZATION =====
function init() {
  highScoreEl.textContent = formatScore(highScore);

  // Initialize ground tiles
  groundTiles = [];
  for (let x = 0; x < LOGICAL_WIDTH + 100; x += 20) {
    groundTiles.push({ x, width: Math.random() > 0.7 ? 15 : 5 });
  }

  // Initialize clouds
  clouds = [];
  for (let i = 0; i < 4; i++) {
    clouds.push(createCloud(Math.random() * LOGICAL_WIDTH));
  }

  // Place player on ground
  player.y = GROUND_Y - player.height;
}

function createCloud(x) {
  return {
    x,
    y: Math.random() * 80 + 20,
    width: Math.random() * 40 + 40,
    speed: 0.5 + Math.random() * 0.5
  };
}

// ===== CONTROLS =====
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (!gameStarted) {
      startGame();
    } else if (gameOver) {
      resetGame();
    } else {
      jump();
    }
  }
  
  if (e.code === "ArrowDown") {
    e.preventDefault();
    if (gameStarted && !gameOver) {
      player.isDucking = true;
      // Fast fall if in air
      if (player.isJumping) {
        player.yVelocity = 10;
      }
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowDown") {
    player.isDucking = false;
  }
});

// Touch/Click controls
canvas.addEventListener("mousedown", handleTap);
startScreen.addEventListener("click", handleTap);

// Mouse / desktop tap
function handleTap(e) {
  e.preventDefault();
  if (!gameStarted) {
    startGame();
  } else if (gameOver) {
    resetGame();
  } else {
    jump();
  }
}

// Mobile touch: tap to jump, bottom-area touch to duck
canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
startScreen.addEventListener("touchstart", (e) => { e.preventDefault(); startGame(); }, { passive: false });

function handleTouchStart(e) {
  e.preventDefault();
  const t = e.touches[0];
  if (!gameStarted) {
    startGame();
    return;
  }
  if (gameOver) {
    resetGame();
    return;
  }

  // If touch is near the bottom of the screen, duck; otherwise jump
  if (t.clientY > window.innerHeight * 0.6) {
    player.isDucking = true;
    // Fast fall if in air
    if (player.isJumping) player.yVelocity = 10;
  } else {
    jump();
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  player.isDucking = false;
}

function jump() {
  if (!player.isJumping && !player.isDucking) {
    player.yVelocity = JUMP_FORCE;
    player.isJumping = true;
  }
}

function startGame() {
  gameStarted = true;
  startScreen.classList.add("hidden");
}

// ===== OBSTACLE CREATION =====
function createGroundObstacle() {
  const type = CACTUS_TYPES[Math.floor(Math.random() * CACTUS_TYPES.length)];
  groundObstacles.push({
    x: LOGICAL_WIDTH,
    y: GROUND_Y - type.height,
    width: type.width,
    height: type.height
  });
}

function createFlyingObstacle() {
  const offsets = [80, 50, 120];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  const yPos = Math.max(20, GROUND_Y - offset);
  flyingObstacles.push({
    x: LOGICAL_WIDTH,
    y: yPos,
    width: 46,
    height: 32,
    wingFrame: 0
  });
}

// ===== GAME LOOP =====
function update() {
  if (!gameStarted || gameOver) return;
  
  frameCount++;
  
  // Update score
  score += 0.15;
  currentScoreEl.textContent = formatScore(Math.floor(score));
  
  // Day/Night cycle
  if (Math.floor(score) > 0 && Math.floor(score) % DAY_NIGHT_INTERVAL === 0) {
    const currentCycle = Math.floor(score / DAY_NIGHT_INTERVAL);
    const shouldBeNight = currentCycle % 2 === 1;
    if (shouldBeNight !== !isDay) {
      isDay = !shouldBeNight;
      document.body.classList.toggle("night-mode", !isDay);
    }
  }
  
  // Increase speed over time
  gameSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + Math.floor(score / 100) * 0.5);
  
  // Player physics
  player.yVelocity += GRAVITY;
  player.y += player.yVelocity;
  
  const groundLevel = GROUND_Y - player.currentHeight;
  if (player.y >= groundLevel) {
    player.y = groundLevel;
    player.yVelocity = 0;
    player.isJumping = false;
  }
  
  // Update run animation
  if (!player.isJumping && frameCount % 6 === 0) {
    player.runFrame = (player.runFrame + 1) % 2;
  }
  
  // Move obstacles
  groundObstacles.forEach(obs => obs.x -= gameSpeed);
  flyingObstacles.forEach(obs => {
    obs.x -= gameSpeed + 2;
    if (frameCount % 8 === 0) obs.wingFrame = (obs.wingFrame + 1) % 2;
  });
  
  // Move environment
  groundTiles.forEach(tile => tile.x -= gameSpeed);
  clouds.forEach(cloud => cloud.x -= cloud.speed);
  
  // Collision detection
  const playerBox = {
    x: player.x + 5,
    y: player.y + 5,
    width: player.currentWidth - 10,
    height: player.currentHeight - 10
  };
  
  [...groundObstacles, ...flyingObstacles].forEach(obs => {
    if (
      playerBox.x < obs.x + obs.width &&
      playerBox.x + playerBox.width > obs.x &&
      playerBox.y < obs.y + obs.height &&
      playerBox.y + playerBox.height > obs.y
    ) {
      gameOver = true;
      if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem("dinoHighScore", highScore);
        highScoreEl.textContent = formatScore(highScore);
      }
    }
  });
  
  // Remove off-screen obstacles
  groundObstacles = groundObstacles.filter(obs => obs.x + obs.width > 0);
  flyingObstacles = flyingObstacles.filter(obs => obs.x + obs.width > 0);
  
  // Recycle ground tiles
  groundTiles.forEach(tile => {
    if (tile.x + tile.width < 0) {
      tile.x = LOGICAL_WIDTH + Math.random() * 20;
    }
  });

  // Recycle clouds
  clouds.forEach(cloud => {
    if (cloud.x + cloud.width < 0) {
      cloud.x = LOGICAL_WIDTH + Math.random() * 100;
      cloud.y = Math.random() * 80 + 20;
    }
  });
}

// ===== DRAW =====
function draw() {
  const bgColor = isDay ? "#f7f7f7" : "#1a1a2e";
  const fgColor = isDay ? "#535353" : "#e0e0e0";
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  
  // Draw clouds
  ctx.fillStyle = isDay ? "#e0e0e0" : "#2a2a4e";
  clouds.forEach(cloud => {
    drawCloud(cloud.x, cloud.y, cloud.width);
  });
  
  // Draw ground line
  ctx.fillStyle = fgColor;
  ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, 2);
  
  // Draw ground texture
  groundTiles.forEach(tile => {
    ctx.fillRect(tile.x, GROUND_Y + 8, tile.width, 2);
  });
  
  // Draw player (dino)
  ctx.fillStyle = fgColor;
  if (player.isDucking) {
    drawDuckingDino(player.x, player.y);
  } else {
    drawDino(player.x, player.y, player.runFrame, player.isJumping);
  }
  
  // Draw ground obstacles (cacti)
  groundObstacles.forEach(obs => {
    drawCactus(obs.x, obs.y, obs.width, obs.height);
  });
  
  // Draw flying obstacles (birds)
  flyingObstacles.forEach(obs => {
    drawBird(obs.x, obs.y, obs.wingFrame);
  });
  
  // Game Over screen
  if (gameOver) {
    ctx.fillStyle = fgColor;
    ctx.font = "24px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 20);
    ctx.font = "12px 'Press Start 2P'";
    ctx.fillText("Press SPACE to restart", LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 20);
    ctx.textAlign = "left";
  }
}

// ===== DRAW HELPERS =====
function drawDino(x, y, frame, jumping) {
  const color = isDay ? "#535353" : "#e0e0e0";
  ctx.fillStyle = color;
  
  // Body
  ctx.fillRect(x + 10, y, 24, 32);
  // Head
  ctx.fillRect(x + 18, y - 16, 26, 20);
  // Eye
  ctx.fillStyle = isDay ? "#f7f7f7" : "#1a1a2e";
  ctx.fillRect(x + 34, y - 10, 6, 6);
  ctx.fillStyle = color;
  // Arm
  ctx.fillRect(x, y + 12, 12, 6);
  // Tail
  ctx.fillRect(x + 2, y + 4, 10, 8);
  
  // Legs (animated)
  if (jumping) {
    ctx.fillRect(x + 10, y + 32, 8, 14);
    ctx.fillRect(x + 24, y + 32, 8, 14);
  } else if (frame === 0) {
    ctx.fillRect(x + 10, y + 32, 8, 16);
    ctx.fillRect(x + 24, y + 32, 8, 8);
  } else {
    ctx.fillRect(x + 10, y + 32, 8, 8);
    ctx.fillRect(x + 24, y + 32, 8, 16);
  }
}

function drawDuckingDino(x, y) {
  const color = isDay ? "#535353" : "#e0e0e0";
  ctx.fillStyle = color;
  
  // Long body
  ctx.fillRect(x, y + 4, 50, 18);
  // Head
  ctx.fillRect(x + 38, y, 20, 16);
  // Eye
  ctx.fillStyle = isDay ? "#f7f7f7" : "#1a1a2e";
  ctx.fillRect(x + 50, y + 4, 5, 5);
  ctx.fillStyle = color;
  // Legs
  ctx.fillRect(x + 8, y + 22, 8, 6);
  ctx.fillRect(x + 30, y + 22, 8, 6);
}

function drawCactus(x, y, width, height) {
  const color = isDay ? "#535353" : "#e0e0e0";
  ctx.fillStyle = color;
  
  // Main stem
  ctx.fillRect(x + width/3, y, width/3, height);
  
  // Arms (for larger cacti)
  if (width > 25) {
    ctx.fillRect(x, y + height * 0.3, width/3, height * 0.2);
    ctx.fillRect(x, y + height * 0.3, width/5, height * 0.4);
    ctx.fillRect(x + width * 0.7, y + height * 0.4, width/3, height * 0.15);
    ctx.fillRect(x + width * 0.8, y + height * 0.2, width/5, height * 0.35);
  }
}

function drawBird(x, y, wingFrame) {
  const color = isDay ? "#535353" : "#e0e0e0";
  ctx.fillStyle = color;
  
  // Body
  ctx.fillRect(x + 8, y + 10, 30, 14);
  // Head
  ctx.fillRect(x + 34, y + 8, 12, 12);
  // Beak
  ctx.fillRect(x + 42, y + 12, 8, 4);
  // Tail
  ctx.fillRect(x, y + 12, 10, 6);
  
  // Wings (animated)
  if (wingFrame === 0) {
    ctx.fillRect(x + 14, y, 16, 10);
  } else {
    ctx.fillRect(x + 14, y + 22, 16, 10);
  }
}

function drawCloud(x, y, width) {
  ctx.beginPath();
  ctx.arc(x, y, width/4, 0, Math.PI * 2);
  ctx.arc(x + width/3, y - 5, width/3, 0, Math.PI * 2);
  ctx.arc(x + width * 0.7, y, width/4, 0, Math.PI * 2);
  ctx.fill();
}

// ===== UTILITIES =====
function formatScore(num) {
  return String(num).padStart(5, "0");
}

function resetGame() {
  score = 0;
  gameSpeed = INITIAL_SPEED;
  gameOver = false;
  player.y = GROUND_Y - player.height;
  player.yVelocity = 0;
  player.isJumping = false;
  player.isDucking = false;
  groundObstacles = [];
  flyingObstacles = [];
  isDay = true;
  document.body.classList.remove("night-mode");
}

// ===== MAIN LOOP =====
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ===== OBSTACLE SPAWNING =====
function spawnObstacles() {
  if (!gameStarted || gameOver) return;

  const rand = Math.random();

  // Spawn flying obstacles after score > 200
  if (score > 200 && rand < 0.25 && flyingObstacles.length === 0) {
    createFlyingObstacle();
  } else if (rand < 0.6 && groundObstacles.length < 3) {
    const lastObs = groundObstacles[groundObstacles.length - 1];
    if (!lastObs || lastObs.x < LOGICAL_WIDTH - 200) {
      createGroundObstacle();
    }
  }
}

// ===== START =====
// Start: ensure canvas fits viewport then init
resizeCanvas();
init();
gameLoop();
setInterval(spawnObstacles, 800);

// Recompute layout / reset on viewport changes
window.addEventListener('resize', () => {
  resizeCanvas();
  resetGame();
  init();
});
