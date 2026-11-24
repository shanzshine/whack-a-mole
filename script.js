// Whack-a-Mole Game Logic & Arcade Engine
// moleclub arcade edition

const GAME_LENGTH = 30;

// Difficulty Settings
const DIFFICULTIES = {
  easy: {
    label: 'EASY',
    stayMin: 720,
    stayBase: 1300,
    stayScale: 14,
    intervalMin: 520,
    intervalBase: 1100,
    intervalScale: 12,
    multiChance: 0.12,
  },
  medium: {
    label: 'MED',
    stayMin: 420,
    stayBase: 960,
    stayScale: 14,
    intervalMin: 360,
    intervalBase: 850,
    intervalScale: 12,
    multiChance: 0.22,
  },
  hard: {
    label: 'HARD',
    stayMin: 280,
    stayBase: 680,
    stayScale: 12,
    intervalMin: 240,
    intervalBase: 600,
    intervalScale: 10,
    multiChance: 0.38,
  },
};

// DOM Elements
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const progressEl = document.getElementById('time-progress');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('start-btn');
const soundBtn = document.getElementById('sound-btn');
const soundIconOn = document.getElementById('sound-icon-on');
const soundIconOff = document.getElementById('sound-icon-off');
const timerCard = document.querySelector('.timer-card');
const holes = [...document.querySelectorAll('.hole')];
const diffButtons = [...document.querySelectorAll('.diff-btn')];

// Modal DOM Elements
const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalEyebrow = document.getElementById('modal-eyebrow');
const modalDesc = document.getElementById('modal-desc');
const modalFinalScore = document.getElementById('modal-final-score');
const modalBestScore = document.getElementById('modal-best-score');
const modalDiffLabel = document.getElementById('modal-diff-label');
const modalReplayBtn = document.getElementById('modal-replay-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

// State Variables
let currentDiff = localStorage.getItem('moleclub-diff') || 'medium';
if (!DIFFICULTIES[currentDiff]) currentDiff = 'medium';

let score = 0;
let best = getBestScore(currentDiff);
let timeLeft = GAME_LENGTH;
let activeHoles = new Set();
let gameTimer = null;
let moleTimer = null;
let playing = false;
let hitCombo = 0;

// Helper to get and set best scores per difficulty
function getBestScore(diff) {
  const specific = localStorage.getItem(`moleclub-best-${diff}`);
  if (specific !== null) return Number(specific);
  if (diff === 'medium') {
    return Number(localStorage.getItem('moleclub-best') || 0);
  }
  return 0;
}

function setBestScore(diff, val) {
  localStorage.setItem(`moleclub-best-${diff}`, String(val));
  if (diff === 'medium') {
    localStorage.setItem('moleclub-best', String(val));
  }
}

// Web Audio API Synthesizer (Zero external dependencies)
class SoundFx {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('moleclub-sound-muted') === 'true';
    this.updateIcon();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.muted = !this.muted;
    localStorage.setItem('moleclub-sound-muted', String(this.muted));
    this.updateIcon();
    if (!this.muted) {
      this.init();
      this.playHit(600);
    }
  }

  updateIcon() {
    if (this.muted) {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
      soundBtn.setAttribute('title', 'Sound is OFF (Click to turn ON)');
    } else {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
      soundBtn.setAttribute('title', 'Sound is ON (Click to turn OFF)');
    }
  }

  playPop() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.1);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (_) {}
  }

  playHit(pitch = 520) {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.14);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch (_) {}
  }

  playStart() {
    if (this.muted || !this.ctx) return;
    try {
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
      });
    } catch (_) {}
  }

  playGameOver(isBest = false) {
    if (this.muted || !this.ctx) return;
    try {
      const notes = isBest 
        ? [392.00, 523.25, 659.25, 783.99] // Upbeat victory fanfare
        : [392.00, 349.23, 329.63, 261.63]; // Gentle wrap chime

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.1;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
      });
    } catch (_) {}
  }
}

const sound = new SoundFx();

// Formats score as 3-digit tabular string: 007
function formatScore(value) {
  return String(value).padStart(3, '0');
}

// Initial stats setup
function applyDifficulty(diff) {
  currentDiff = diff;
  localStorage.setItem('moleclub-diff', diff);

  diffButtons.forEach((btn) => {
    const isActive = btn.dataset.diff === diff;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });

  best = getBestScore(currentDiff);
  bestEl.textContent = formatScore(best);
}

// Clear active moles
function clearMoles() {
  holes.forEach((hole) => {
    hole.classList.remove('active', 'hit');
  });
  activeHoles.clear();
}

// Spawn burst particles around hit mole
function createHitParticles(holeEl) {
  const count = 7;
  const colors = ['#8CC63F', '#A4E836', '#A47154', '#DFC9B8', '#F8B1A6', '#FFF4CC'];

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'hit-particle';
    const size = Math.floor(Math.random() * 6) + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.left = '50%';
    particle.style.top = '45%';

    const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
    const distance = Math.floor(Math.random() * 32) + 26;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    holeEl.appendChild(particle);
    setTimeout(() => particle.remove(), 550);
  }
}

// Spawn floating +1 indicator
function createScorePopup(holeEl) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = '+1';
  holeEl.appendChild(popup);
  setTimeout(() => popup.remove(), 700);
}

// Popup a mole at a specific index
function popMoleAtIndex(index, stayDuration) {
  const hole = holes[index];
  activeHoles.add(index);
  hole.classList.remove('hit');
  hole.classList.add('active');

  setTimeout(() => {
    if (activeHoles.has(index)) {
      hole.classList.remove('active');
      activeHoles.delete(index);
      hitCombo = 0;
    }
  }, stayDuration);
}

// Show mole(s) based on difficulty
function showMole() {
  if (!playing) return;

  const cfg = DIFFICULTIES[currentDiff];

  // Find available holes
  const availableIndices = holes
    .map((_, idx) => idx)
    .filter((idx) => !activeHoles.has(idx));

  if (availableIndices.length > 0) {
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const stayDuration = Math.max(cfg.stayMin, cfg.stayBase - score * cfg.stayScale);
    
    popMoleAtIndex(randomIndex, stayDuration);
    sound.playPop();

    // Occasional dual mole for extra excitement
    if (Math.random() < cfg.multiChance && availableIndices.length > 1) {
      const remaining = availableIndices.filter((idx) => idx !== randomIndex);
      const secondIndex = remaining[Math.floor(Math.random() * remaining.length)];
      setTimeout(() => {
        if (playing && !activeHoles.has(secondIndex)) {
          popMoleAtIndex(secondIndex, stayDuration * 0.95);
        }
      }, 120);
    }
  }

  // Interval until next mole
  const nextInterval = Math.max(cfg.intervalMin, cfg.intervalBase - score * cfg.intervalScale) + Math.floor(Math.random() * 160);
  moleTimer = setTimeout(showMole, nextInterval);
}

// Update game stats display
function updateStats() {
  scoreEl.textContent = formatScore(score);
  timeEl.innerHTML = `${timeLeft}<span class="seconds-unit">s</span>`;

  const pct = (timeLeft / GAME_LENGTH) * 100;
  progressEl.style.width = `${pct}%`;

  if (timeLeft <= 8) {
    progressEl.classList.add('urgent');
    timerCard.classList.add('urgent');
  } else {
    progressEl.classList.remove('urgent');
    timerCard.classList.remove('urgent');
  }
}

// Show Game Over Modal
function showModal(isNewBest) {
  modalFinalScore.textContent = formatScore(score);
  modalBestScore.textContent = formatScore(best);
  modalDiffLabel.textContent = DIFFICULTIES[currentDiff].label;

  if (isNewBest && score > 0) {
    modalEyebrow.textContent = 'NEW PERSONAL BEST! 🏆';
    modalTitle.textContent = 'High Score!';
    modalDesc.textContent = `Incredible reflexes! You set a new record of ${score} moles on ${DIFFICULTIES[currentDiff].label} mode.`;
  } else if (score >= 25) {
    modalEyebrow.textContent = 'EXCELLENT ROUND';
    modalTitle.textContent = 'Mole Master!';
    modalDesc.textContent = `Lightning fast! You caught ${score} moles before time ran out.`;
  } else if (score > 0) {
    modalEyebrow.textContent = 'ROUND FINISHED';
    modalTitle.textContent = "Time's Up!";
    modalDesc.textContent = `Good job! You whacked ${score} moles in 30 seconds. Can you beat your best?`;
  } else {
    modalEyebrow.textContent = 'ROUND OVER';
    modalTitle.textContent = 'Nice Try!';
    modalDesc.textContent = 'The cheeky moles got away this time. Give it another shot!';
  }

  gameModal.classList.remove('hidden');
}

function hideModal() {
  gameModal.classList.add('hidden');
}

// Start game round
function startGame() {
  if (playing) return;
  hideModal();
  sound.init();
  sound.playStart();

  score = 0;
  timeLeft = GAME_LENGTH;
  hitCombo = 0;
  playing = true;
  clearMoles();
  updateStats();

  messageEl.textContent = `Playing on ${DIFFICULTIES[currentDiff].label}! Go get 'em!`;
  startBtn.disabled = true;
  startBtn.innerHTML = '<span>Playing...</span>';

  // Spawn first mole immediately
  showMole();

  // 1-second countdown clock
  gameTimer = setInterval(() => {
    timeLeft -= 1;
    updateStats();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// End round
function endGame() {
  playing = false;
  clearInterval(gameTimer);
  clearTimeout(moleTimer);
  clearMoles();

  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    setBestScore(currentDiff, best);
    bestEl.textContent = formatScore(best);
  }

  sound.playGameOver(isNewBest);

  if (isNewBest && score > 0) {
    messageEl.textContent = `🎉 Fantastic! New best: ${score} moles!`;
  } else if (score > 0) {
    messageEl.textContent = `Time's up! You scored ${score} moles.`;
  } else {
    messageEl.textContent = `Round over! Give it another go.`;
  }

  startBtn.disabled = false;
  startBtn.innerHTML = `
    <span>Play again</span>
    <svg class="btn-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="12" y2="4"></line>
      <polyline points="5 4 12 4 12 11"></polyline>
    </svg>
  `;

  // Display the clean popup modal right over the board
  showModal(isNewBest);
}

// Handle Whack Interaction
function handleWhack(hole, index) {
  if (!playing) return;
  if (!activeHoles.has(index)) return;
  if (hole.classList.contains('hit')) return; // Prevent double hitting the same mole

  activeHoles.delete(index);
  score += 1;
  hitCombo += 1;

  // Mole reacts
  hole.classList.add('hit');
  hole.classList.remove('active');

  // Audio pitch increases with combo
  const hitPitch = Math.min(800, 480 + hitCombo * 28);
  sound.playHit(hitPitch);

  // Effects
  createHitParticles(hole);
  createScorePopup(hole);
  updateStats();

  // Dynamic feedback messages at milestones
  if (score === 10) {
    messageEl.textContent = 'Nice pace! Keep going!';
  } else if (score === 20) {
    messageEl.textContent = 'Mole master mode! 🔥';
  } else if (score === 30) {
    messageEl.textContent = 'Unbelievable speed! ⚡';
  }

  // After squash animation, retreat mole
  setTimeout(() => {
    hole.classList.remove('hit');
  }, 320);
}

// Event Listeners for Burrows
holes.forEach((hole, index) => {
  hole.addEventListener('click', () => {
    handleWhack(hole, index);
  });

  // Support Keyboard Play (Enter / Space)
  hole.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleWhack(hole, index);
    }
  });
});

// Difficulty Button Listeners
diffButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (playing) {
      // If round is active, stop it cleanly
      clearInterval(gameTimer);
      clearTimeout(moleTimer);
      clearMoles();
      playing = false;
      startBtn.disabled = false;
      startBtn.innerHTML = '<span>Start game</span>';
    }
    hideModal();
    applyDifficulty(btn.dataset.diff);
    messageEl.textContent = `Difficulty set to ${DIFFICULTIES[currentDiff].label}. Ready!`;
  });
});

// Modal Actions
modalReplayBtn.addEventListener('click', () => {
  hideModal();
  startGame();
});

modalCloseBtn.addEventListener('click', () => {
  hideModal();
});

// Sound Toggle Listener
soundBtn.addEventListener('click', () => {
  sound.toggle();
});

// Start Button Listener
startBtn.addEventListener('click', startGame);

// Initialize display and active difficulty
applyDifficulty(currentDiff);
updateStats();
