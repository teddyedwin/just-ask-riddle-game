const question = document.getElementById('question');
const prompt = document.getElementById('prompt');
const answerOptions = document.getElementById('answerOptions');
const restartButton = document.getElementById('restartButton');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const passwordInput = document.getElementById('passwordInput');
const authModeToggle = document.getElementById('authModeToggle');
const authSubmitLabel = document.getElementById('authSubmitLabel');
const loginTitle = document.getElementById('loginTitle');
const authRecoveryNote = document.getElementById('authRecoveryNote');
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
let authMode = 'login';
const soundPreferenceKey = 'justAskSoundEnabled';
let soundEnabled = true;
let audioContext = null;

try {
  soundEnabled = localStorage.getItem(soundPreferenceKey) !== 'false';
} catch (error) {
  console.warn('Could not load the sound preference.', error);
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? 'Sound effects on' : 'Sound effects off';
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', `Sound effects ${soundEnabled ? 'on' : 'off'}`);
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
  headerNote.replaceChildren(
    headerNote.querySelector('.status-dot'),
    document.createTextNode(` Good luck, ${playerName}!`)
  );
}

function openProfileDrawer() {
  const isLoggedIn = Boolean(playerName);
  profileGuestNote.hidden = isLoggedIn;
  drawerLeaderboardLink.hidden = !isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  profileStatus.textContent = '';
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

async function invokeGame(payload) {
  const { data, error } = await supabaseClient.functions.invoke('riddle-game', { body: payload });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const body = await error.context.clone().json();
      if (typeof body?.error === 'string') message = body.error;
    }
    if (/display name/i.test(message)) {
      throw new Error('The deployed game service is out of date. Deploy the latest riddle-game function from this project, then try again.');
    }
    throw new Error(message);
  }
  return data;
}

async function startOnlineGame() {
  if (!supabaseClient || !playerName) return false;

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
    });
    if (requestId !== gameRequestId) return;
    activeGameId = result.gameId;
    currentQuestion = result.question;
    showQuestion();
    return true;
  } catch (error) {
    if (requestId !== gameRequestId) return false;
    console.error('Could not start the player game.', error);
    prompt.textContent = error instanceof Error
      ? `Could not start the game: ${error.message}`
      : 'Could not start the game. Please try again.';
    prompt.classList.add('answer-wrong');
    return false;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const creatingAccount = mode === 'signup';
  loginTitle.textContent = creatingAccount ? 'CREATE YOUR ACCOUNT' : 'LOG IN TO PLAY';
  authSubmitLabel.textContent = creatingAccount ? 'Create account' : 'Log in';
  authModeToggle.textContent = creatingAccount
    ? 'Already have an account? Log in'
    : 'New here? Create an account';
  authRecoveryNote.hidden = !creatingAccount;
  passwordInput.autocomplete = creatingAccount ? 'new-password' : 'current-password';
  loginStatus.textContent = '';
}

function accountLookupErrorMessage(error) {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'You are signed in, but the player database is not set up yet. Run supabase-setup.sql in the Supabase SQL Editor, then try again.';
  }
  if (error?.code === 'PGRST116') {
    return 'You are signed in, but your player record is missing. Run the updated supabase-setup.sql to repair existing accounts, then try again.';
  }
  return 'You are signed in, but your player account could not be loaded. Please try again later.';
}

async function startPlayerGame(username) {
  playerName = username;
  setHeaderGreeting();
  headerNote.hidden = false;
  loginPanel.hidden = true;
  quizPanel.hidden = false;
  logoutButton.hidden = false;
  const started = await startOnlineGame();
  if (started) return true;

  playerName = '';
  headerNote.replaceChildren(
    headerNote.querySelector('.status-dot'),
    document.createTextNode(' A little question game')
  );
  loginPanel.hidden = false;
  quizPanel.hidden = true;
  logoutButton.hidden = true;
  loginStatus.textContent = 'Your account is signed in, but the game service could not start. Please try logging in again later.';
  return false;
}

authModeToggle.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'signup' : 'login');
});

nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = nameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    loginStatus.textContent = 'Use a username of 3–20 letters, numbers, or underscores.';
    nameInput.focus();
    return;
  }
  if (password.length < 8) {
    loginStatus.textContent = 'Your password must be at least 8 characters.';
    passwordInput.focus();
    return;
  }
  if (!supabaseClient) {
    loginStatus.textContent = 'The account service is not available. Please try again later.';
    return;
  }

  nameInput.value = username;
  const submitButton = nameForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  authModeToggle.disabled = true;
  prepareAudio();
  loginStatus.textContent = authMode === 'signup' ? 'Creating your account...' : 'Logging in...';
  let sessionEstablished = false;
  try {
    const syntheticEmail = `${username}@players.justask.invalid`;
    const authResult = authMode === 'signup'
      ? await supabaseClient.auth.signUp({
        email: syntheticEmail,
        password,
        options: { data: { username } },
      })
      : await supabaseClient.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
    if (authResult.error) throw authResult.error;
    if (!authResult.data.session) {
      loginStatus.textContent = 'Username-only accounts require email confirmation to be disabled in the Supabase Auth settings. No email address is collected.';
      return;
    }
    sessionEstablished = true;

    const { data: account, error: accountError } = await supabaseClient
      .from('usernames')
      .select('username')
      .eq('user_id', authResult.data.session.user.id)
      .single();
    if (accountError) throw accountError;

    passwordInput.value = '';
    await startPlayerGame(account.username);
  } catch (error) {
    console.error(`Could not ${authMode === 'signup' ? 'create the player account' : 'log in the player'}.`, error);
    loginStatus.textContent = sessionEstablished
      ? accountLookupErrorMessage(error)
      : authMode === 'signup'
        ? 'Could not create the account. The username may already be taken; please try another.'
        : 'Username or password is incorrect.';
  } finally {
    submitButton.disabled = false;
    authModeToggle.disabled = false;
  }
});

async function restorePlayerSession() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) return;

    const { data: account, error: accountError } = await supabaseClient
      .from('usernames')
      .select('username')
      .eq('user_id', data.session.user.id)
      .single();
    if (accountError) throw accountError;
    await startPlayerGame(account.username);
  } catch (error) {
    console.error('Could not restore the player session.', error);
    loginStatus.textContent = accountLookupErrorMessage(error);
  }
}

void restorePlayerSession();

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

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Could not log out the player.', error);
    profileStatus.textContent = 'Could not log out. Please try again.';
    logoutButton.disabled = false;
    return;
  }

  gameRequestId += 1;
  playerName = '';
  activeGameId = null;
  currentQuestion = null;
  profileStatus.textContent = '';
  profileDrawerName.textContent = '';
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
  loginStatus.textContent = '';
  nameInput.value = '';
  passwordInput.value = '';
  setAuthMode('login');
  logoutButton.disabled = false;
  nameInput.focus();
});

showQuestion();
