const question = document.getElementById('question');
const prompt = document.getElementById('prompt');
const answerOptions = document.getElementById('answerOptions');
const restartButton = document.getElementById('restartButton');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
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
const supabaseClient = window.riddleSupabase;
let playerName = '';
let currentUser = null;
let activeGameId = null;
let currentQuestion = null;
let gameRequestId = 0;

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

profileForm.addEventListener('submit', async (event) => {
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

  if (!supabaseClient || !currentUser) {
    profileStatus.textContent = 'Sign in to update your public display name.';
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ display_name: updatedName })
      .eq('user_id', currentUser.id);
    if (error) throw error;
    if (updatedYear) {
      localStorage.setItem(playerYearStorageKey, updatedYear);
    } else {
      localStorage.removeItem(playerYearStorageKey);
    }
    playerName = updatedName;
    setHeaderGreeting();
    profileStatus.textContent = 'Profile saved. Your leaderboard name is updated.';
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
  if (!supabaseClient || !currentUser) return;

  const requestId = ++gameRequestId;
  activeGameId = null;
  currentQuestion = null;
  selectedDifficulty = difficultySelect ? difficultySelect.value : 'medium';
  restartButton.hidden = true;
  answerOptions.hidden = false;
  answerOptions.replaceChildren();
  prompt.classList.remove('answer-correct', 'answer-wrong');
  prompt.textContent = 'Starting a verified game...';
  try {
    const result = await invokeGame({ action: 'start', difficulty: selectedDifficulty });
    if (requestId !== gameRequestId) return;
    activeGameId = result.gameId;
    currentQuestion = result.question;
    showQuestion();
  } catch (error) {
    if (requestId !== gameRequestId) return;
    console.error('Could not start a verified game.', error);
    prompt.textContent = 'Could not start the game. Please try again.';
    prompt.classList.add('answer-wrong');
  }
}

async function handleAuthenticatedUser(user) {
  if (!user) {
    gameRequestId += 1;
    currentUser = null;
    activeGameId = null;
    currentQuestion = null;
    playerName = '';
    loginPanel.hidden = false;
    quizPanel.hidden = true;
    logoutButton.hidden = true;
    headerNote.hidden = false;
    headerNote.replaceChildren(
      headerNote.querySelector('.status-dot'),
      document.createTextNode(' A little question game')
    );
    return;
  }
  if (currentUser && currentUser.id === user.id) return;

  try {
    let { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;

    if (!profile) {
      const displayName = String(
        user.user_metadata.display_name || user.email?.split('@')[0] || 'Player'
      ).trim().slice(0, 40);
      const result = await supabaseClient
        .from('profiles')
        .upsert({ user_id: user.id, display_name: displayName }, { onConflict: 'user_id' })
        .select('display_name')
        .single();
      if (result.error) throw result.error;
      profile = result.data;
    }

    currentUser = user;
    playerName = profile.display_name;
    setHeaderGreeting();
    headerNote.hidden = false;
    loginPanel.hidden = true;
    quizPanel.hidden = false;
    logoutButton.hidden = false;
    await startOnlineGame();
  } catch (error) {
    console.error('Could not load the signed-in player profile.', error);
    loginStatus.textContent = 'Signed in, but the player profile could not be loaded. Please try again.';
  }
}

async function initializeOnlineSignIn() {
  if (!supabaseClient) {
    loginStatus.textContent = 'Online sign-in is not configured yet. Complete the Supabase setup to enable accounts and shared scores.';
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Could not restore the online sign-in session.', error);
    loginStatus.textContent = 'Could not check your sign-in session. Please reload the page.';
    return;
  }
  await handleAuthenticatedUser(data.session?.user || null);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    window.setTimeout(() => {
      void handleAuthenticatedUser(session?.user || null);
    }, 0);
  });
}

nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = nameInput.value.trim();
  const email = emailInput.value.trim();
  if (!displayName || !email) return;
  if (!supabaseClient) {
    loginStatus.textContent = 'Online sign-in is not configured yet. Complete the Supabase setup first.';
    return;
  }

  const submitButton = nameForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  loginStatus.textContent = 'Sending your sign-in link...';
  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
    loginStatus.textContent = 'Check your email for the sign-in link. Your display name and scores will be public.';
  } catch (error) {
    console.error('Could not send the email sign-in link.', error);
    loginStatus.textContent = 'Could not send a sign-in link. Check the email address and Supabase email settings.';
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
      prompt.textContent = `${playerName}, try again.`;
      prompt.classList.remove('answer-correct');
      prompt.classList.add('answer-wrong');
      return;
    }

    prompt.classList.remove('answer-wrong');
    if (result.completed) {
      activeGameId = null;
      currentQuestion = null;
      question.textContent = "Brilliant! You've solved all the riddles.";
      answerOptions.hidden = true;
      restartButton.hidden = false;
      prompt.textContent = `${playerName}, you earned ${result.score} points!`;
      prompt.classList.add('answer-correct');
      return;
    }

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
  void startOnlineGame();
});

if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    selectedDifficulty = difficultySelect.value;
    if (currentUser) void startOnlineGame();
  });
}

logoutButton.addEventListener('click', async () => {
  if (!supabaseClient) return;
  logoutButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    handleAuthenticatedUser(null);
    profileStatus.textContent = '';
    profileDrawerName.textContent = '';
    profileNameInput.value = '';
    profileYearInput.value = '';
    dismissProfileDrawer();
    profileAvatar.textContent = '?';
    profileAvatar.setAttribute('aria-label', 'Player profile');
    nameInput.focus();
  } catch (error) {
    console.error('Could not sign out.', error);
    prompt.textContent = 'Could not sign out. Please try again.';
    prompt.classList.add('answer-wrong');
  } finally {
    logoutButton.disabled = false;
  }
});

initializeOnlineSignIn();
showQuestion();
