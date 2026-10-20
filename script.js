const question = document.getElementById('question');
const prompt = document.getElementById('prompt');
const answerOptions = document.getElementById('answerOptions');
const restartButton = document.getElementById('restartButton');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const loginStatus = document.getElementById('loginStatus');
const loginPanel = document.getElementById('loginPanel');
const quizPanel = document.getElementById('quizPanel');
const logoutButton = document.getElementById('logoutButton');
const headerNote = document.getElementById('headerNote');
const profileAvatar = document.getElementById('profileAvatar');
const profileDrawer = document.getElementById('profileDrawer');
const profileBackdrop = document.getElementById('profileBackdrop');
const closeProfileDrawer = document.getElementById('closeProfileDrawer');
const drawerLeaderboardLink = document.getElementById('drawerLeaderboardLink');
const profileDrawerName = document.getElementById('profileDrawerName');
const profileForm = document.getElementById('profileForm');
const profileNameInput = document.getElementById('profileNameInput');
const profileYearInput = document.getElementById('profileYearInput');
const profileStatus = document.getElementById('profileStatus');
const profileGuestNote = document.getElementById('profileGuestNote');
const howToPlay = document.getElementById('howToPlay');
const howToPlayBackdrop = document.getElementById('howToPlayBackdrop');
const closeHowToPlay = document.getElementById('closeHowToPlay');
const howToPlayLink = document.querySelector('.wordmark');
const slideImage = document.getElementById('slideImage');
const photoCarousel = document.querySelector('.photo-carousel');
const slideIndicators = [...document.querySelectorAll('.slide-indicator')];
const difficultySelect = document.getElementById('difficultySelect');
const soundToggle = document.getElementById('soundToggle');
const supabaseClient = window.riddleSupabase;
let playerName = '';
let activeGameId = null;
let currentQuestion = null;
let gameRequestId = 0;
const soundPreferenceKey = 'justAskSoundEnabled';
let soundEnabled = true;
let audioContext = null;
let musicGain = null;
let musicOscillators = [];
let musicChordTimer = null;
let musicGeneration = 0;

const ambientChords = [
  [130.81, 164.81, 196, 246.94],
  [110, 130.81, 164.81, 196],
  [87.31, 110, 130.81, 164.81],
  [98, 123.47, 146.83, 196],
];

try {
  soundEnabled = localStorage.getItem(soundPreferenceKey) !== 'false';
} catch (error) {
  console.warn('Could not load the sound preference.', error);
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', `Sound ${soundEnabled ? 'on' : 'off'}`);
}

function prepareAudio() {
  if (!soundEnabled || !window.AudioContext) return;
  try {
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch((error) => {
        console.warn('Could not enable game sounds.', error);
      });
    }
  } catch (error) {
    console.warn('Game sounds are unavailable.', error);
  }
}

function playTone(frequency, startTime, duration, endFrequency = frequency) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (endFrequency !== frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
  }
  volume.gain.setValueAtTime(0.0001, startTime);
  volume.gain.exponentialRampToValueAtTime(0.15, startTime + 0.025);
  volume.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(volume);
  volume.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function stopBackgroundMusic() {
  musicGeneration += 1;
  window.clearInterval(musicChordTimer);
  musicChordTimer = null;
  if (!musicGain || !audioContext) return;

  const now = audioContext.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
  musicOscillators.forEach((oscillator) => oscillator.stop(now + 0.85));
  musicOscillators = [];
  musicGain = null;
}

function startBackgroundMusic() {
  if (!soundEnabled || !activeGameId || document.hidden || !window.AudioContext) return;
  prepareAudio();
  if (!audioContext) return;

  stopBackgroundMusic();
  const generation = musicGeneration;
  const beginMusic = () => {
    if (
      generation !== musicGeneration
      || !soundEnabled
      || !activeGameId
      || document.hidden
      || !audioContext
      || audioContext.state !== 'running'
    ) return;

    const filter = audioContext.createBiquadFilter();
    musicGain = audioContext.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    musicGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.07, audioContext.currentTime + 2);
    musicGain.connect(filter);
    filter.connect(audioContext.destination);

    const voiceGains = [0.4, 0.34, 0.28, 0.22];
    musicOscillators = voiceGains.map((voiceGain, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = ambientChords[0][index];
      gain.gain.value = voiceGain;
      oscillator.connect(gain);
      gain.connect(musicGain);
      oscillator.start();
      return oscillator;
    });

    let chordIndex = 0;
    musicChordTimer = window.setInterval(() => {
      if (!audioContext || !musicGain) return;
      chordIndex = (chordIndex + 1) % ambientChords.length;
      const changeTime = audioContext.currentTime;
      musicOscillators.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(ambientChords[chordIndex][index], changeTime, 1.4);
      });
    }, 8000);
  };

  if (audioContext.state === 'running') {
    beginMusic();
  } else {
    void audioContext.resume().then(beginMusic).catch((error) => {
      console.warn('Could not start background music.', error);
    });
  }
}

function playSoundEffect(effect) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  if (effect === 'incorrect') {
    playTone(240, now, 0.18, 170);
    return;
  }
  const notes = effect === 'complete'
    ? [523.25, 659.25, 783.99, 1046.5]
    : [659.25, 880];
  notes.forEach((note, index) => {
    playTone(note, now + index * (effect === 'complete' ? 0.12 : 0.09), 0.22);
  });
}

updateSoundToggle();
soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  updateSoundToggle();
  try {
    localStorage.setItem(soundPreferenceKey, String(soundEnabled));
  } catch (error) {
    console.warn('Could not save the sound preference.', error);
  }
  if (soundEnabled) prepareAudio();
  if (soundEnabled && activeGameId) {
    startBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }
});

const slides = [
  {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Chess_game_Staunton_No._6_perfil_view_8.jpg/1280px-Chess_game_Staunton_No._6_perfil_view_8.jpg',
    alt: 'Chess pieces set up on a board',
  },
  {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Chess_board_with_pieces.jpg/1280px-Chess_board_with_pieces.jpg',
    alt: 'Chess board and pieces',
  },
  {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Dartboard_with_darts.jpg/1280px-Dartboard_with_darts.jpg',
    alt: 'Darts thrown into a dartboard',
  },
  {
    src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Darts_in_a_dartboard.jpg/1280px-Darts_in_a_dartboard.jpg',
    alt: 'Darts in a dartboard at a game venue',
  }
];

let slideIndex = 0;
let selectedDifficulty = 'medium';
const playerYearStorageKey = 'justAskPlayerYear';

function setHeaderGreeting() {
  const initials = playerName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  profileAvatar.textContent = initials || '?';
  profileAvatar.setAttribute('aria-label', `Open ${playerName}'s profile menu`);
  profileDrawerName.textContent = playerName;
  profileNameInput.value = playerName;
  profileYearInput.value = localStorage.getItem(playerYearStorageKey) || '';
  headerNote.replaceChildren(
    headerNote.querySelector('.status-dot'),
    document.createTextNode(` Good luck, ${playerName}!`)
  );
}

function openProfileDrawer() {
  const isLoggedIn = !quizPanel.hidden;
  profileForm.hidden = !isLoggedIn;
  profileGuestNote.hidden = isLoggedIn;
  drawerLeaderboardLink.hidden = !isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  if (isLoggedIn) {
    profileNameInput.value = playerName;
    profileYearInput.value = localStorage.getItem(playerYearStorageKey) || '';
    profileStatus.textContent = '';
  }
  profileDrawer.hidden = false;
  profileBackdrop.hidden = false;
  profileDrawer.setAttribute('aria-hidden', 'false');
  profileAvatar.setAttribute('aria-expanded', 'true');
  closeProfileDrawer.focus();
}

function dismissProfileDrawer() {
  profileDrawer.hidden = true;
  profileBackdrop.hidden = true;
  profileDrawer.setAttribute('aria-hidden', 'true');
  profileAvatar.setAttribute('aria-expanded', 'false');
  profileAvatar.focus();
}

profileAvatar.addEventListener('click', openProfileDrawer);
closeProfileDrawer.addEventListener('click', dismissProfileDrawer);
profileBackdrop.addEventListener('click', dismissProfileDrawer);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !profileDrawer.hidden) {
    dismissProfileDrawer();
    return;
  }
  if (event.key === 'Tab' && !profileDrawer.hidden) {
    const focusableElements = [...profileDrawer.querySelectorAll(
      'a[href]:not([hidden]), button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden])'
    )].filter((element) => element.getClientRects().length > 0);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
});

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const updatedName = profileNameInput.value.trim();
  const updatedYear = profileYearInput.value.trim();
  if (!updatedName) {
    profileStatus.textContent = 'Please enter a name.';
    profileNameInput.focus();
    return;
  }
  if (updatedYear && (Number(updatedYear) < 1900 || Number(updatedYear) > 2100)) {
    profileStatus.textContent = 'Enter a year between 1900 and 2100.';
    profileYearInput.focus();
    return;
  }

  try {
    if (updatedYear) {
      localStorage.setItem(playerYearStorageKey, updatedYear);
    } else {
      localStorage.removeItem(playerYearStorageKey);
    }
    playerName = updatedName;
    setHeaderGreeting();
    profileStatus.textContent = 'Name saved for future games. Current and past scores keep their original name.';
  } catch (error) {
    console.error('Could not save profile changes.', error);
    profileStatus.textContent = 'Profile could not be saved. Please try again.';
  }
});

async function invokeGame(payload) {
  const { data, error } = await supabaseClient.functions.invoke('riddle-game', { body: payload });
  if (error) throw error;
  return data;
}

async function startOnlineGame() {
  if (!supabaseClient || !playerName) return false;

  stopBackgroundMusic();
  const requestId = ++gameRequestId;
  activeGameId = null;
  currentQuestion = null;
  selectedDifficulty = difficultySelect ? difficultySelect.value : 'medium';
  restartButton.hidden = true;
  answerOptions.hidden = false;
  answerOptions.replaceChildren();
  prompt.classList.remove('answer-correct', 'answer-wrong');
  prompt.textContent = 'Starting your game...';
  try {
    const result = await invokeGame({
      action: 'start',
      difficulty: selectedDifficulty,
      playerName,
    });
    if (requestId !== gameRequestId) return;
    activeGameId = result.gameId;
    currentQuestion = result.question;
    startBackgroundMusic();
    showQuestion();
    return true;
  } catch (error) {
    if (requestId !== gameRequestId) return false;
    console.error('Could not start the guest game.', error);
    prompt.textContent = 'Could not start the game. Please try again.';
    prompt.classList.add('answer-wrong');
    return false;
  }
}

nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = nameInput.value.trim().slice(0, 40);
  if (!displayName) {
    nameInput.focus();
    return;
  }
  if (!supabaseClient) {
    loginStatus.textContent = 'The shared game service is not available. Please try again later.';
    return;
  }

  const submitButton = nameForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  prepareAudio();
  playerName = displayName;
  loginStatus.textContent = 'Starting your game...';
  try {
    setHeaderGreeting();
    headerNote.hidden = false;
    loginPanel.hidden = true;
    quizPanel.hidden = false;
    logoutButton.hidden = false;
    const started = await startOnlineGame();
    if (!started) {
      loginPanel.hidden = false;
      quizPanel.hidden = true;
      logoutButton.hidden = true;
      loginStatus.textContent = 'Could not connect to the shared game service. Please try again later.';
      nameInput.focus();
    }
  } catch (error) {
    console.error('Could not start a guest game.', error);
    loginStatus.textContent = 'Could not start the game. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});

function showSlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  const slide = slides[slideIndex];
  slideImage.src = slide.src;
  slideImage.alt = slide.alt;
  slideIndicators.forEach((indicator, indicatorIndex) => {
    const active = indicatorIndex === slideIndex;
    indicator.classList.toggle('is-active', active);
    if (active) {
      indicator.setAttribute('aria-current', 'true');
    } else {
      indicator.removeAttribute('aria-current');
    }
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let slideTimer;
let carouselPaused = false;

function startSlideshow() {
  window.clearInterval(slideTimer);
  if (carouselPaused || prefersReducedMotion.matches) return;
  slideTimer = window.setInterval(() => showSlide(slideIndex + 1), 5000);
}

function pauseSlideshow() {
  carouselPaused = true;
  window.clearInterval(slideTimer);
}

function resumeSlideshow() {
  carouselPaused = false;
  startSlideshow();
}

slideIndicators.forEach((indicator, index) => {
  indicator.addEventListener('click', () => {
    showSlide(index);
    startSlideshow();
  });
});
photoCarousel.addEventListener('mouseenter', pauseSlideshow);
photoCarousel.addEventListener('mouseleave', resumeSlideshow);
photoCarousel.addEventListener('focusin', pauseSlideshow);
photoCarousel.addEventListener('focusout', (event) => {
  if (!photoCarousel.contains(event.relatedTarget)) resumeSlideshow();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearInterval(slideTimer);
  } else {
    startSlideshow();
  }
});
prefersReducedMotion.addEventListener('change', startSlideshow);
showSlide(0);
startSlideshow();

function openHowToPlay() {
  howToPlay.hidden = false;
  howToPlayBackdrop.hidden = false;
  howToPlay.setAttribute('aria-hidden', 'false');
  closeHowToPlay.focus();
}

function dismissHowToPlay() {
  howToPlay.hidden = true;
  howToPlayBackdrop.hidden = true;
  howToPlay.setAttribute('aria-hidden', 'true');
  howToPlayLink.focus();
}

howToPlayLink.addEventListener('click', (event) => {
  event.preventDefault();
  openHowToPlay();
});
closeHowToPlay.addEventListener('click', dismissHowToPlay);
howToPlayBackdrop.addEventListener('click', dismissHowToPlay);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !howToPlay.hidden) {
    dismissHowToPlay();
  }
});

function showQuestion() {
  if (!currentQuestion) return;
  question.textContent = currentQuestion.question;
  answerOptions.replaceChildren();
  currentQuestion.options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'answer-button answer-choice';
    button.type = 'button';
    button.textContent = option;
    button.addEventListener('click', () => void checkAnswer(option));
    answerOptions.appendChild(button);
  });
  const message = 'Solve the riddle to unlock the next question.';
  prompt.dataset.message = message;
  prompt.textContent = playerName ? `${playerName}, ${message}` : message;
  prompt.classList.remove('answer-correct', 'answer-wrong');
  question.parentElement.style.animation = 'none';
  void question.parentElement.offsetWidth;
  question.parentElement.style.animation = '';
}

async function checkAnswer(answer) {
  if (!activeGameId) return;
  prepareAudio();
  answerOptions.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  prompt.textContent = 'Checking your answer...';
  try {
    const result = await invokeGame({
      action: 'answer',
      gameId: activeGameId,
      answer,
    });
    if (!result.correct) {
      playSoundEffect('incorrect');
      prompt.textContent = `${playerName}, try again.`;
      prompt.classList.remove('answer-correct');
      prompt.classList.add('answer-wrong');
      return;
    }

    prompt.classList.remove('answer-wrong');
    if (result.completed) {
      playSoundEffect('complete');
      stopBackgroundMusic();
      activeGameId = null;
      currentQuestion = null;
      question.textContent = "Brilliant! You've solved all the riddles.";
      answerOptions.hidden = true;
      restartButton.hidden = false;
      prompt.textContent = `${playerName}, you earned ${result.score} points!`;
      prompt.classList.add('answer-correct');
      return;
    }

    playSoundEffect('correct');
    currentQuestion = result.question;
    showQuestion();
    prompt.textContent = `${playerName}, correct! Here comes the next riddle.`;
    prompt.classList.add('answer-correct');
  } catch (error) {
    console.error('Could not verify the game answer.', error);
    prompt.textContent = 'Could not check that answer. Please try again.';
    prompt.classList.add('answer-wrong');
  } finally {
    if (activeGameId) {
      answerOptions.querySelectorAll('button').forEach((button) => {
        button.disabled = false;
      });
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopBackgroundMusic();
  } else if (activeGameId) {
    startBackgroundMusic();
  }
});

restartButton.addEventListener('click', () => {
  prepareAudio();
  void startOnlineGame();
});

if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    selectedDifficulty = difficultySelect.value;
    if (playerName) {
      prepareAudio();
      void startOnlineGame();
    }
  });
}

logoutButton.addEventListener('click', () => {
  stopBackgroundMusic();
  gameRequestId += 1;
  playerName = '';
  activeGameId = null;
  currentQuestion = null;
  profileStatus.textContent = '';
  profileDrawerName.textContent = '';
  profileNameInput.value = '';
  profileYearInput.value = '';
  dismissProfileDrawer();
  profileAvatar.textContent = '?';
  profileAvatar.setAttribute('aria-label', 'Open profile menu');
  loginPanel.hidden = false;
  quizPanel.hidden = true;
  logoutButton.hidden = true;
  answerOptions.hidden = false;
  restartButton.hidden = true;
  headerNote.replaceChildren(
    headerNote.querySelector('.status-dot'),
    document.createTextNode(' A little question game')
  );
  headerNote.hidden = false;
  loginStatus.textContent = 'No account needed. Names and scores are public and can’t be verified.';
  nameInput.value = '';
  nameInput.focus();
});

showQuestion();
