const leaderboardEntries = document.getElementById('leaderboardEntries');
const leaderboardStatus = document.getElementById('leaderboardStatus');
const supabaseClient = window.riddleSupabase;

function createCell(text, className) {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

async function loadLeaderboard() {
  if (!supabaseClient) {
    leaderboardStatus.textContent = 'The shared leaderboard is not configured yet. Complete the Supabase setup first.';
    return;
  }

  leaderboardStatus.textContent = 'Loading shared scores...';
  try {
    const { data: results, error } = await supabaseClient
      .from('scores')
      .select('score,difficulty,completed_at,profiles(display_name)')
      .order('score', { ascending: false })
      .order('completed_at', { ascending: true })
      .limit(50);
    if (error) throw error;

    leaderboardEntries.replaceChildren();
    if (results.length === 0) {
      leaderboardStatus.textContent = 'No shared scores yet. Finish a game to appear here!';
      return;
    }

    results.forEach((result, index) => {
      const row = document.createElement('tr');
      row.append(
        createCell(String(index + 1), 'leaderboard-rank'),
        createCell(result.profiles.display_name),
        createCell(result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1)),
        createCell(String(result.score), 'leaderboard-score'),
        createCell(new Date(result.completed_at).toLocaleDateString())
      );
      leaderboardEntries.appendChild(row);
    });
    leaderboardStatus.textContent = '';
  } catch (error) {
    console.error('Could not load shared leaderboard scores.', error);
    leaderboardStatus.textContent = 'Could not load the shared leaderboard. Check the Supabase setup and try again.';
  }
}

loadLeaderboard();
