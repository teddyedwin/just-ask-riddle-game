import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const riddlesByDifficulty = {
  easy: [
    { question: 'What has hands but cannot clap?', answer: 'A clock', options: ['A statue', 'A clock', 'A glove', 'A mannequin'] },
    { question: 'What gets wetter the more it dries?', answer: 'A towel', options: ['A towel', 'A sponge', 'A cloud', 'A river'] },
    { question: 'What has a neck but no head?', answer: 'A bottle', options: ['A shirt', 'A giraffe', 'A bottle', 'A guitar'] },
    { question: 'What has many teeth but cannot bite?', answer: 'A comb', options: ['A shark', 'A zipper', 'A comb', 'A saw'] },
    { question: 'What has one eye but cannot see?', answer: 'A needle', options: ['A camera', 'A needle', 'A storm', 'A potato'] },
    { question: 'What can you catch but cannot throw?', answer: 'A cold', options: ['A ball', 'A cold', 'A fish', 'A frisbee'] },
    { question: 'What has a head and a tail but no body?', answer: 'A coin', options: ['A snake', 'A coin', 'A kite', 'A comet'] },
    { question: 'What belongs to you, but other people use it more than you do?', answer: 'Your name', options: ['Your name', 'Your phone', 'Your chair', 'Your jacket'] },
    { question: 'What must you break before you can use it?', answer: 'An egg', options: ['A promise', 'An egg', 'A toy', 'A stick'] },
    { question: 'What has a ring but no finger?', answer: 'A telephone', options: ['A bracelet', 'A telephone', 'A bell', 'A tree'] },
  ],
  medium: [
    { question: 'What has keys but no locks?', answer: 'A piano', options: ['A map', 'A piano', 'A treasure chest', 'A keyboard lock'] },
    { question: 'What can be broken but never held?', answer: 'A promise', options: ['A glass', 'A secret', 'A promise', 'A rule'] },
    { question: 'What goes up but never comes down?', answer: 'Your age', options: ['A balloon', 'Smoke', 'Your age', 'An elevator'] },
    { question: 'What has cities, but no houses; forests, but no trees; and water, but no fish?', answer: 'A map', options: ['A map', 'A painting', 'A globe', 'A book'] },
    { question: 'What has many words but never speaks?', answer: 'A book', options: ['A parrot', 'A radio', 'A book', 'A teacher'] },
    { question: 'What gets bigger the more you take away from it?', answer: 'A hole', options: ['A pile', 'A hole', 'A shadow', 'A puzzle'] },
    { question: 'What can fill a room but takes up no space?', answer: 'Light', options: ['Light', 'Furniture', 'Smoke', 'A crowd'] },
    { question: 'What has branches but no leaves, trunk, or fruit?', answer: 'A bank', options: ['A river', 'A bank', 'A library', 'A family tree'] },
    { question: 'What begins with T, ends with T, and has T inside it?', answer: 'A teapot', options: ['A tent', 'A teapot', 'A test', 'A ticket'] },
    { question: 'What can you hold in your right hand but never in your left?', answer: 'Your left hand', options: ['Your left hand', 'A mirror', 'A secret', 'A shadow'] },
  ],
  hard: [
    { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'An echo', options: ['An echo', 'A cloud', 'A kite', 'A whistle'] },
    { question: 'The more you take, the more you leave behind. What are they?', answer: 'Footsteps', options: ['Memories', 'Footsteps', 'Photographs', 'Coins'] },
    { question: 'What can travel around the world while staying in one corner?', answer: 'A stamp', options: ['A stamp', 'A compass', 'A shadow', 'A postcard'] },
    { question: 'What disappears as soon as you say its name?', answer: 'Silence', options: ['A secret', 'Silence', 'An echo', 'A dream'] },
    { question: 'What has 13 hearts but no other organs?', answer: 'A deck of cards', options: ['A deck of cards', 'A hospital', 'A calendar', 'A family'] },
    { question: 'What word becomes shorter when you add the letters E and R?', answer: 'Short', options: ['Small', 'Short', 'Brief', 'Tiny'] },
    // Adapted from https://www.riddles.com/best-riddles.
    { question: 'What word can lose one letter at a time and still make a word, from eight letters down to one?', answer: 'Starting', options: ['Starting', 'Searching', 'Learning', 'Reading'] },
    { question: 'What has four letters, sometimes has nine, and always has six?', answer: 'The words in the question', options: ['The words in the question', 'A calendar', 'A number line', 'The alphabet'] },
    { question: 'The more of it there is, the less you can see. What is it?', answer: 'Darkness', options: ['Fog', 'Darkness', 'Rain', 'Distance'] },
    { question: 'What can be cracked, made, told, and played?', answer: 'A joke', options: ['A song', 'A joke', 'A game', 'A code'] },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function publicQuestion(question: { question: string; options: string[] }) {
  return { question: question.question, options: question.options };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase function environment is not configured.');
    return jsonResponse({ error: 'The game service is not configured.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let payload: {
    action?: string;
    difficulty?: string;
    gameId?: string;
    answer?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (payload.action !== 'start' && payload.action !== 'answer') {
    return jsonResponse({ error: 'Unknown game action.' }, 400);
  }

  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse({ error: 'Log in before playing.' }, 401);
  }
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Your login has expired. Please log in again.' }, 401);
  }
  const user = authData.user;

  if (payload.action === 'start') {
    const difficulty = payload.difficulty;
    if (typeof difficulty !== 'string' || !Object.hasOwn(riddlesByDifficulty, difficulty)) {
      return jsonResponse({ error: 'Choose a valid difficulty.' }, 400);
    }
    const { data: account, error: accountError } = await admin
      .from('usernames')
      .select('username')
      .eq('user_id', user.id)
      .single();
    if (accountError || !account) {
      console.error('Could not find the authenticated player username.', accountError);
      return jsonResponse({ error: 'Could not load your account. Please log in again.' }, 500);
    }
    const playerName = account.username;

    const questions = [...riddlesByDifficulty[difficulty as keyof typeof riddlesByDifficulty]];
    if (difficulty === 'hard') {
      for (let index = questions.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
      }
    }

    const gameId = crypto.randomUUID();
    const { error: insertError } = await admin.from('riddle_game_sessions').insert({
      id: gameId,
      user_id: user.id,
      player_name: playerName,
      difficulty,
      questions,
      last_answered_at: new Date(Date.now() - 1000).toISOString(),
    });
    if (insertError) {
      console.error('Could not create a game session.', insertError);
      return jsonResponse({ error: 'Could not start the game. Please try again.' }, 500);
    }
    return jsonResponse({ gameId, question: publicQuestion(questions[0]) });
  }

  if (payload.action === 'answer') {
    if (
      typeof payload.gameId !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(payload.gameId)
      || typeof payload.answer !== 'string'
      || payload.answer.length > 200
    ) {
      return jsonResponse({ error: 'Invalid answer request.' }, 400);
    }

    const { data, error } = await admin.rpc('submit_riddle_answer', {
      p_game_id: payload.gameId,
      p_answer: payload.answer,
      p_user_id: user.id,
    });
    if (error) {
      if (error.message.includes('Please wait')) {
        return jsonResponse({ error: 'Please wait a moment before answering again.' }, 429);
      }
      console.error('Could not verify game answer.', error);
      return jsonResponse({ error: 'Could not verify that answer. Please try again.' }, 500);
    }
    return jsonResponse(data);
  }

  return jsonResponse({ error: 'Unknown game action.' }, 400);
});
