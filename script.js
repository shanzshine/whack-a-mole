// Whack-a-Mole Game Logic & Arcade Engine
// moleclub arcade & stages edition

const GAME_LENGTH = 30;

// Level & Stage Configurations
const LEVELS = {
  1: {
    id: 1,
    name: 'Sunny Meadow',
    badge: 'STAGE 1',
    theme: 'theme-meadow',
    desc: 'Catch garden moles before the 30-second clock runs out. Clear target to unlock next stage!',
    targetScore: 15,
    specialMoles: [],
    speedMultiplier: 1.0,
  },
  2: {
    id: 2,
    name: 'Sunset Orchard',
    badge: 'STAGE 2',
    theme: 'theme-sunset',
    desc: 'Faster moles appear! Look out for Golden Moles (+3 pts)!',
    targetScore: 22,
    specialMoles: ['golden'],
    goldenChance: 0.22,
    speedMultiplier: 1.22,
  },
  3: {
    id: 3,
    name: 'Midnight Grove',
    badge: 'STAGE 3',
    theme: 'theme-night',
    desc: 'Beware of Sneaky Bomb Moles (-2 pts & resets combo)! Hit Golden Moles for big bonus.',
    targetScore: 28,
    specialMoles: ['golden', 'hazard'],
    goldenChance: 0.24,
    hazardChance: 0.20,
    speedMultiplier: 1.42,
  },
};

// Difficulty Settings
const DIFFICULTIES = {
  easy: {
    label: 'EASY',
    stayMin: 680,
    stayBase: 1250,
    stayScale: 14,
    intervalMin: 500,
    intervalBase: 1050,
    intervalScale: 12,
    multiChance: 0.12,
  },
  medium: {
    label: 'MED',
    stayMin: 400,
    stayBase: 920,
    stayScale: 14,
    intervalMin: 340,
    intervalBase: 820,
    intervalScale: 12,
    multiChance: 0.22,
  },
  hard: {
    label: 'HARD',
    stayMin: 260,
    stayBase: 650,
    stayScale: 12,
    intervalMin: 220,
    intervalBase: 560,
    intervalScale: 10,
    multiChance: 0.36,
  },
};

// DOM Elements
const boardEl = document.getElementById('board');
const holeTemplate = document.getElementById('hole-template');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const comboDisplayEl = document.getElementById('combo-display');
const comboCardEl = document.querySelector('.combo-card');
const progressEl = document.getElementById('time-progress');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('start-btn');
const soundBtn = document.getElementById('sound-btn');
const soundIconOn = document.getElementById('sound-icon-on');
const soundIconOff = document.getElementById('sound-icon-off');
const timerCard = document.querySelector('.timer-card');
const diffButtons = [...document.querySelectorAll('.diff-btn')];
const stageTabs = [...document.querySelectorAll('.stage-tab')];
const targetScoreEl = document.getElementById('target-score');
const stageBadgeEl = document.getElementById('stage-badge');
const levelTagEl = document.getElementById('level-tag');
const levelDescEl = document.getElementById('level-desc');

// Modal Elements
const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalEyebrow = document.getElementById('modal-eyebrow');
const modalDesc = document.getElementById('modal-desc');
const modalFinalScore = document.getElementById('modal-final-score');
const modalMaxCombo = document.getElementById('modal-max-combo');
const modalAccuracy = document.getElementById('modal-accuracy');
const modalReplayBtn = document.getElementById('modal-replay-btn');
const modalNextBtn = document.getElementById('modal-next-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalIcon = document.getElementById('modal-icon');

// Generate Board Holes from Template
boardEl.innerHTML = '';
for (let i = 0; i < 9; i++) {
  const clone = holeTemplate.content.cloneNode(true);
  const holeBtn = clone.querySelector('.hole');
  holeBtn.setAttribute('data-hole', String(i));
  holeBtn.setAttribute('aria-label', `Burrow ${i + 1}`);
  
  const keyHint = clone.querySelector('.key-hint');
  if (keyHint) keyHint.textContent = String(i + 1);

  boardEl.appendChild(clone);
}

const holes = [...document.querySelectorAll('.hole')];

// State Variables
let currentLevel = Number(localStorage.getItem('moleclub-level') || 1);
if (!LEVELS[currentLevel]) currentLevel = 1;

let currentDiff = localStorage.getItem('moleclub-diff') || 'medium';
if (!DIFFICULTIES[currentDiff]) currentDiff = 'medium';

let score = 0;
let best = getBestScore(currentLevel, currentDiff);
let timeLeft = GAME_LENGTH;
let activeMoles = new Map(); // index -> { type, timer }
let gameTimer = null;
let moleTimer = null;
let playing = false;
let hitCombo = 0;
let maxCombo = 0;
let totalSpawns = 0;
let totalHits = 0;

// High score helpers
function getBestScore(lvl, diff) {
  const key = `moleclub-best-l${lvl}-${diff}`;
  const val = localStorage.getItem(key);
  if (val !== null) return Number(val);
  return 0;
}

function setBestScore(lvl, diff, val) {
  localStorage.setItem(`moleclub-best-l${lvl}-${diff}`, String(val));
}

// Procedural Cartoon Web Audio API Synthesizer
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
      this.playHit(580);
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

      gain.gain.setValueAtTime(0.16, now);
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
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.14);

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (_) {}
  }

  playGold() {
    if (this.muted || !this.ctx) return;
    try {
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 shimmer
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.05;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      });
    } catch (_) {}
  }

  playHazard() {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  playStart() {
    if (this.muted || !this.ctx) return;
    try {
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.07;

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

  playStageClear() {
    if (this.muted || !this.ctx) return;
    try {
      const chord = [392.00, 523.25, 659.25, 783.99, 1046.50]; // Victory Fanfare
      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    } catch (_) {}
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    try {
      const notes = [392.00, 349.23, 329.63, 261.63];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + i * 0.1;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
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

function formatScore(val) {
  return String(Math.max(0, val)).padStart(3, '0');
}

// Stage & Theme Setup
function applyLevel(lvl) {
  currentLevel = lvl;
  localStorage.setItem('moleclub-level', String(lvl));

  const cfg = LEVELS[lvl];
  document.body.className = cfg.theme;

  stageBadgeEl.textContent = cfg.badge;
  levelTagEl.textContent = `${cfg.badge} • ${cfg.name.toUpperCase()}`;
  levelDescEl.textContent = cfg.desc;
  targetScoreEl.textContent = `${cfg.targetScore} pts`;

  stageTabs.forEach((tab) => {
    const isActive = Number(tab.dataset.level) === lvl;
    tab.classList.toggle('active', isActive);
  });

  best = getBestScore(currentLevel, currentDiff);
  bestEl.textContent = formatScore(best);
}

// Difficulty Setup
function applyDifficulty(diff) {
  currentDiff = diff;
  localStorage.setItem('moleclub-diff', diff);

  diffButtons.forEach((btn) => {
    const isActive = btn.dataset.diff === diff;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });

  best = getBestScore(currentLevel, currentDiff);
  bestEl.textContent = formatScore(best);
}

// Clear moles
function clearMoles() {
  holes.forEach((hole) => {
    hole.classList.remove('active', 'hit', 'mole--golden', 'mole--hazard');
  });
  activeMoles.forEach((info) => clearTimeout(info.timer));
  activeMoles.clear();
}

// Spawn burst particles
function createHitParticles(holeEl, type = 'normal') {
  const count = type === 'golden' ? 10 : 7;
  let colors = ['#8CC63F', '#A4E836', '#A47154', '#DFC9B8', '#F8B1A6'];

  if (type === 'golden') {
    colors = ['#F59E0B', '#FBBF24', '#FDE68A', '#FFFFFF', '#D97706'];
  } else if (type === 'hazard') {
    colors = ['#EF4444', '#DC2626', '#1F2937', '#9CA3AF', '#F87171'];
  }

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
    const distance = Math.floor(Math.random() * 34) + 26;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    holeEl.appendChild(particle);
    setTimeout(() => particle.remove(), 550);
  }
}

// Spawn floating score popup
function createScorePopup(holeEl, text, className = '') {
  const popup = document.createElement('div');
  popup.className = `score-popup ${className}`.trim();
  popup.textContent = text;
  holeEl.appendChild(popup);
  setTimeout(() => popup.remove(), 700);
}

// Popup mole at index with type
function popMoleAtIndex(index, stayDuration, type = 'normal') {
  const hole = holes[index];
  hole.classList.remove('hit', 'mole--golden', 'mole--hazard');

  if (type === 'golden') {
    hole.classList.add('mole--golden');
  } else if (type === 'hazard') {
    hole.classList.add('mole--hazard');
  }

  hole.classList.add('active');
  totalSpawns += 1;

  const timer = setTimeout(() => {
    if (activeMoles.has(index)) {
      hole.classList.remove('active', 'mole--golden', 'mole--hazard');
      activeMoles.delete(index);
      // Missed a mole resets combo streak
      if (type !== 'hazard') {
        hitCombo = 0;
        updateComboDisplay();
      }
    }
  }, stayDuration);

  activeMoles.set(index, { type, timer });
}

// Pick special mole type based on stage rules
function determineMoleType(levelCfg) {
  if (levelCfg.specialMoles.includes('hazard') && Math.random() < levelCfg.hazardChance) {
    return 'hazard';
  }
  if (levelCfg.specialMoles.includes('golden') && Math.random() < levelCfg.goldenChance) {
    return 'golden';
  }
  return 'normal';
}

// Show mole(s)
function showMole() {
  if (!playing) return;

  const diffCfg = DIFFICULTIES[currentDiff];
  const levelCfg = LEVELS[currentLevel];

  const availableIndices = holes
    .map((_, idx) => idx)
    .filter((idx) => !activeMoles.has(idx));

  if (availableIndices.length > 0) {
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const speedMult = levelCfg.speedMultiplier || 1.0;
    const stayDuration = Math.max(diffCfg.stayMin, (diffCfg.stayBase - score * diffCfg.stayScale) / speedMult);
    const moleType = determineMoleType(levelCfg);

    popMoleAtIndex(randomIndex, stayDuration, moleType);
    sound.playPop();

    // Multi-mole chance
    if (Math.random() < diffCfg.multiChance && availableIndices.length > 1) {
      const remaining = availableIndices.filter((idx) => idx !== randomIndex);
      const secondIndex = remaining[Math.floor(Math.random() * remaining.length)];
      setTimeout(() => {
        if (playing && !activeMoles.has(secondIndex)) {
          const secondType = determineMoleType(levelCfg);
          popMoleAtIndex(secondIndex, stayDuration * 0.95, secondType);
        }
      }, 120);
    }
  }

  const speedMult = levelCfg.speedMultiplier || 1.0;
  const nextInterval = Math.max(diffCfg.intervalMin, (diffCfg.intervalBase - score * diffCfg.intervalScale) / speedMult) + Math.floor(Math.random() * 150);
  moleTimer = setTimeout(showMole, nextInterval);
}

// Update combo visual
function updateComboDisplay() {
  comboDisplayEl.textContent = `${hitCombo}x`;
  comboCardEl.classList.toggle('combo-active', hitCombo >= 2);
  comboCardEl.classList.toggle('combo-fever', hitCombo >= 5);
}

// Update stats
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

// Render modal icon
function setModalIcon(type = 'win') {
  if (type === 'win') {
    modalIcon.innerHTML = `
      <svg class="modal-mole-svg" viewBox="0 0 100 100" fill="none">
        <ellipse cx="28" cy="30" rx="10" ry="12" fill="#76523D"/>
        <ellipse cx="28" cy="31" rx="6" ry="7" fill="#F8B1A6"/>
        <ellipse cx="72" cy="30" rx="10" ry="12" fill="#76523D"/>
        <ellipse cx="72" cy="31" rx="6" ry="7" fill="#F8B1A6"/>
        <ellipse cx="50" cy="54" rx="34" ry="32" fill="#8C634C"/>
        <ellipse cx="50" cy="62" rx="16" ry="11" fill="#E8D1C2"/>
        <circle cx="32" cy="61" r="5" fill="#F7A89C" opacity="0.8"/>
        <circle cx="68" cy="61" r="5" fill="#F7A89C" opacity="0.8"/>
        <ellipse cx="50" cy="57" rx="5" ry="4" fill="#362217"/>
        <path d="M 34 46 Q 40 40 46 46" stroke="#241710" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path d="M 54 46 Q 60 40 66 46" stroke="#241710" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <ellipse cx="50" cy="66" rx="4" ry="4.5" fill="#B71C1C"/>
        <rect x="48.5" y="62" width="3" height="2.5" rx="0.6" fill="#FFFFFF"/>
        <circle cx="20" cy="22" r="2.5" fill="#F59E0B"/>
        <circle cx="80" cy="22" r="3" fill="#F59E0B"/>
        <circle cx="50" cy="14" r="3.5" fill="#8CC63F"/>
      </svg>
    `;
  } else {
    modalIcon.innerHTML = `
      <svg class="modal-mole-svg" viewBox="0 0 100 100" fill="none">
        <ellipse cx="28" cy="34" rx="10" ry="12" fill="#76523D"/>
        <ellipse cx="72" cy="34" rx="10" ry="12" fill="#76523D"/>
        <ellipse cx="50" cy="56" rx="34" ry="32" fill="#8C634C"/>
        <ellipse cx="50" cy="64" rx="16" ry="11" fill="#E8D1C2"/>
        <ellipse cx="50" cy="59" rx="5" ry="4" fill="#362217"/>
        <line x1="34" y1="48" x2="44" y2="48" stroke="#241710" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="56" y1="48" x2="66" y2="48" stroke="#241710" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M 44 70 Q 50 65 56 70" stroke="#362217" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      </svg>
    `;
  }
}

// Show Modal
function showModal(isCleared, isNewBest) {
  const levelCfg = LEVELS[currentLevel];
  modalFinalScore.textContent = formatScore(score);
  modalMaxCombo.textContent = `${maxCombo}x`;

  const accuracyPct = totalSpawns > 0 ? Math.round((totalHits / totalSpawns) * 100) : 0;
  modalAccuracy.textContent = `${accuracyPct}%`;

  if (isCleared) {
    setModalIcon('win');
    modalEyebrow.textContent = isNewBest ? 'NEW HIGH SCORE! 🏆' : 'STAGE CLEARED! ⭐';
    modalTitle.textContent = currentLevel === 3 ? 'Grand Master!' : 'Stage Cleared!';
    modalDesc.textContent = currentLevel === 3
      ? `Incredible reflexes! You conquered all 3 stages with ${score} points!`
      : `Great reflexes! You scored ${score} pts (Goal: ${levelCfg.targetScore}). Ready for next stage?`;

    if (currentLevel < 3) {
      modalNextBtn.classList.remove('hidden');
      modalNextBtn.querySelector('span').textContent = `Next: Stage ${currentLevel + 1}`;
    } else {
      modalNextBtn.classList.add('hidden');
    }
  } else {
    setModalIcon('loss');
    modalEyebrow.textContent = 'ROUND OVER';
    modalTitle.textContent = "Time's Up!";
    modalDesc.textContent = `You reached ${score} pts (Goal was ${levelCfg.targetScore} pts). Give it another shot!`;
    modalNextBtn.classList.add('hidden');
  }

  gameModal.classList.remove('hidden');
}

function hideModal() {
  gameModal.classList.add('hidden');
}

// Start Game
function startGame() {
  if (playing) return;
  hideModal();
  sound.init();
  sound.playStart();

  score = 0;
  timeLeft = GAME_LENGTH;
  hitCombo = 0;
  maxCombo = 0;
  totalSpawns = 0;
  totalHits = 0;
  playing = true;

  clearMoles();
  updateStats();
  updateComboDisplay();

  const levelCfg = LEVELS[currentLevel];
  messageEl.textContent = `${levelCfg.badge}: ${levelCfg.name}! Target: ${levelCfg.targetScore} pts!`;
  startBtn.disabled = true;
  startBtn.innerHTML = '<span>Playing...</span>';

  showMole();

  gameTimer = setInterval(() => {
    timeLeft -= 1;
    updateStats();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// End Game
function endGame() {
  playing = false;
  clearInterval(gameTimer);
  clearTimeout(moleTimer);
  clearMoles();

  const levelCfg = LEVELS[currentLevel];
  const isCleared = score >= levelCfg.targetScore;
  const isNewBest = score > best;

  if (isNewBest) {
    best = score;
    setBestScore(currentLevel, currentDiff, best);
    bestEl.textContent = formatScore(best);
  }

  if (isCleared) {
    sound.playStageClear();
    messageEl.textContent = `🎉 Stage cleared! You scored ${score} pts!`;
  } else {
    sound.playGameOver();
    messageEl.textContent = `Round over! Target was ${levelCfg.targetScore} pts.`;
  }

  startBtn.disabled = false;
  startBtn.innerHTML = `
    <span>Play again</span>
    <svg class="btn-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="12" y2="4"></line>
      <polyline points="5 4 12 4 12 11"></polyline>
    </svg>
  `;

  showModal(isCleared, isNewBest);
}

// Whack Interaction
function handleWhack(hole, index) {
  if (!playing) return;
  if (!activeMoles.has(index)) return;
  if (hole.classList.contains('hit')) return;

  const moleData = activeMoles.get(index);
  clearTimeout(moleData.timer);
  activeMoles.delete(index);

  hole.classList.add('hit');
  hole.classList.remove('active');

  const moleType = moleData.type;

  if (moleType === 'hazard') {
    // Penalty
    score = Math.max(0, score - 2);
    hitCombo = 0;
    sound.playHazard();
    createHitParticles(hole, 'hazard');
    createScorePopup(hole, '-2', 'score-popup--hazard');
    messageEl.textContent = 'Ouch! Sneaky Bomb Mole (-2 pts)! ⚠️';
  } else if (moleType === 'golden') {
    // Bonus
    score += 3;
    totalHits += 1;
    hitCombo += 1;
    sound.playGold();
    createHitParticles(hole, 'golden');
    createScorePopup(hole, '+3', 'score-popup--gold');
    messageEl.textContent = 'Golden Mole whacked (+3 pts)! ⭐';
  } else {
    // Normal mole
    score += 1;
    totalHits += 1;
    hitCombo += 1;
    const hitPitch = Math.min(840, 480 + hitCombo * 28);
    sound.playHit(hitPitch);
    createHitParticles(hole, 'normal');
    createScorePopup(hole, '+1');
  }

  maxCombo = Math.max(maxCombo, hitCombo);
  updateStats();
  updateComboDisplay();

  setTimeout(() => {
    hole.classList.remove('hit', 'mole--golden', 'mole--hazard');
  }, 320);
}

// Event Listeners for Burrows
holes.forEach((hole, index) => {
  hole.addEventListener('click', () => {
    handleWhack(hole, index);
  });

  hole.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleWhack(hole, index);
    }
  });
});

// Keyboard Controls (Keys 1-9 & Numpad 1-9)
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  // Number Keys 1 to 9
  if (e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key, 10) - 1;
    if (holes[idx]) {
      handleWhack(holes[idx], idx);
      holes[idx].focus();
    }
  }

  // Numpad Keys 1 to 9
  if (e.code && e.code.startsWith('Numpad')) {
    const num = parseInt(e.code.replace('Numpad', ''), 10);
    if (num >= 1 && num <= 9) {
      const idx = num - 1;
      if (holes[idx]) {
        handleWhack(holes[idx], idx);
        holes[idx].focus();
      }
    }
  }
});

// Stage Selection Listeners
stageTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (playing) {
      clearInterval(gameTimer);
      clearTimeout(moleTimer);
      clearMoles();
      playing = false;
      startBtn.disabled = false;
      startBtn.innerHTML = '<span>Start game</span>';
    }
    hideModal();
    applyLevel(Number(tab.dataset.level));
  });
});

// Difficulty Listeners
diffButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (playing) {
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
modalNextBtn.addEventListener('click', () => {
  hideModal();
  if (currentLevel < 3) {
    applyLevel(currentLevel + 1);
    startGame();
  }
});

modalReplayBtn.addEventListener('click', () => {
  hideModal();
  startGame();
});

modalCloseBtn.addEventListener('click', hideModal);
soundBtn.addEventListener('click', () => sound.toggle());
startBtn.addEventListener('click', startGame);

// Initialize Default Stage & Difficulty
applyLevel(currentLevel);
applyDifficulty(currentDiff);
updateStats();
updateComboDisplay();
