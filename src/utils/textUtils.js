/**
 * Turkish & ASCII Robust Text Normalization Utility
 * Handles i/İ/I/ı, ö/Ö, ü/Ü, ş/Ş, ç/Ç, ğ/Ğ seamlessly.
 */

export function normalizeTurkish(text) {
  if (!text) return '';
  return String(text)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // replace punctuation/dots with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the best matching user from a list using normalized scoring.
 * Prevents false positives (e.g., matching Murat Çelik when Murat Özkul is requested).
 */
export function findBestUserMatch(query, users = []) {
  if (!query || !Array.isArray(users) || users.length === 0) return null;

  const normQuery = normalizeTurkish(query);
  if (!normQuery) return null;

  const queryWords = normQuery.split(' ').filter(Boolean);
  if (queryWords.length === 0) return null;

  let bestMatch = null;
  let bestScore = -1;

  for (const u of users) {
    const rawName = u.name || u.full_name || '';
    const rawUsername = u.username || '';
    const normName = normalizeTurkish(rawName);
    const normUsername = normalizeTurkish(rawUsername);
    const userWords = normName.split(' ').filter(Boolean);

    let score = 0;

    // 1. Exact full name match
    if (normName === normQuery) {
      score = 1000;
    }
    // 2. Exact username match
    else if (normUsername === normQuery || normUsername === normQuery.replace(/\s+/g, '.')) {
      score = 950;
    }
    // 3. Multi-word exact word set match
    else if (queryWords.length > 1 && queryWords.length === userWords.length && queryWords.every((w, i) => userWords[i] === w)) {
      score = 900;
    }
    // 4. All query words exist in user name words
    else if (queryWords.length > 1 && queryWords.every(qw => userWords.some(uw => uw === qw || uw.startsWith(qw)))) {
      // Bonus if exact match of all words
      const exactWordMatches = queryWords.filter(qw => userWords.includes(qw)).length;
      score = 800 + exactWordMatches * 20;
    }
    // 5. Query is substring of full name or vice versa (only if multi-word query or high match)
    else if (queryWords.length > 1 && normName.includes(normQuery)) {
      score = 700;
    }
    // 6. Single word query matches single word user name or first/last name
    else if (queryWords.length === 1) {
      const qWord = queryWords[0];
      if (userWords.includes(qWord)) {
        score = 500;
      } else if (normName.startsWith(qWord)) {
        score = 400;
      } else if (normName.includes(qWord)) {
        score = 300;
      }
    }

    if (score > bestScore && score >= 400) {
      bestScore = score;
      bestMatch = u;
    }
  }

  return bestMatch;
}
