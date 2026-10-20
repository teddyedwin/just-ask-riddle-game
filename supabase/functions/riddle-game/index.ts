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
  ],
  medium: [
    { question: 'What has keys but no locks?', answer: 'A piano', options: ['A map', 'A piano', 'A treasure chest', 'A keyboard lock'] },
    { question: 'What can be broken but never held?', answer: 'A promise', options: ['A glass', 'A secret', 'A promise', 'A rule'] },
    { question: 'What goes up but never comes down?', answer: 'Your age', options: ['A balloon', 'Smoke', 'Your age', 'An elevator'] },
    { question: 'What has cities, but no houses; forests, but no trees; and water, but no fish?', answer: 'A map', options: ['A map', 'A painting', 'A globe', 'A book'] },
    { question: 'What has many words but never speaks?', answer: 'A book', options: ['A parrot', 'A radio', 'A book', 'A teacher'] },
  ],
  hard: [
    { question: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'An echo', options: ['An echo', 'A cloud', 'A kite', 'A whistle'] },
    { question: 'The more you take, the more you leave behind. What are they?', answer: 'Footsteps', options: ['Memories', 'Footsteps', 'Photographs', 'Coins'] },
    { question: 'What can travel around the world while staying in one corner?', answer: 'A stamp', options: ['A stamp', 'A compass', 'A shadow', 'A postcard'] },
    { question: 'What disappears as soon as you say its name?', answer: 'Silence', options: ['A secret', 'Silence', 'An echo', 'A dream'] },
    { question: 'What has 13 hearts but no other organs?', answer: 'A deck of cards', options: ['A deck of cards', 'A hospital', 'A calendar', 'A family'] },
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
    playerName?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (payload.action === 'start') {
    const difficulty = payload.difficulty;
    if (typeof difficulty !== 'string' || !Object.hasOwn(riddlesByDifficulty, difficulty)) {
      return jsonResponse({ error: 'Choose a valid difficulty.' }, 400);
    }
    const playerName = typeof payload.playerName === 'string' ? payload.playerName.trim() : '';
    if (
      playerName.length < 1
      || playerName.length > 40
      || /[\u0000-\u001f\u007f]/.test(playerName)
    ) {
      return jsonResponse({ error: 'Enter a display name of 1 to 40 characters.' }, 400);
    }

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
      user_id: null,
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
