import fetch from 'node-fetch';

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes?q=';
const GEMINI_MODEL = 'gemini-3.6-flash';

// Helper: search Open Library as a reliable fallback
const searchOpenLibrary = async (q) => {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`,
      {
        headers: { 'User-Agent': 'PersonalLibraryTracker/1.0' },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data.docs || [];
    return docs.map((doc) => ({
      id: doc.key || Math.random().toString(),
      title: doc.title || 'N/A',
      author: doc.author_name ? doc.author_name.join(', ') : 'Unknown Author',
      genre: doc.subject ? doc.subject[0] : 'General',
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    }));
  } catch (err) {
    console.error('Open Library fallback error:', err.message);
    return [];
  }
};

// @desc    Search Books (Google Books with Open Library fallback)
// @route   GET /api/external/gbooks/search
// @access  Private
export const searchGoogleBooks = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query "q" is required' });
  }

  try {
    let results = [];
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.GEMINI_API_KEY;
    const url = `${GOOGLE_BOOKS_API_URL}${encodeURIComponent(q)}&maxResults=5${apiKey ? `&key=${apiKey}` : ''}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'PersonalLibraryTracker/1.0' },
    });

    if (response.ok) {
      const data = await response.json();
      const items = data.items || [];
      results = items.map((item) => {
        const info = item.volumeInfo;
        return {
          id: item.id,
          title: info.title || 'N/A',
          author: info.authors ? info.authors.join(', ') : 'Unknown Author',
          genre: info.categories ? info.categories[0] : 'Fiction',
          coverUrl: info.imageLinks
            ? info.imageLinks.thumbnail || info.imageLinks.smallThumbnail
            : '',
        };
      });
    } else {
      console.warn(`Google Books returned ${response.status}. Falling back to Open Library...`);
      results = await searchOpenLibrary(q);
    }

    // If Google returned 0 items, also try fallback
    if (results.length === 0) {
      results = await searchOpenLibrary(q);
    }

    res.json(results);
  } catch (error) {
    console.error('Book search error, trying Open Library fallback:', error.message);
    try {
      const fallbackResults = await searchOpenLibrary(q);
      res.json(fallbackResults);
    } catch (fallbackError) {
      console.error('Open Library fallback also failed:', fallbackError.message);
      res.status(500).json({ message: 'Error searching for books' });
    }
  }
};

// @desc    Get insights from Gemini API
// @route   POST /api/external/gemini/insights
// @access  Private
export const getGeminiInsights = async (req, res) => {
  const { title, author } = req.body;

  if (!title || !author) {
    return res.status(400).json({ message: 'Title and author are required' });
  }

  const systemPrompt =
    'You are a helpful literary expert. You provide concise insights about books.';
  const userQuery = `
    Please provide the following for the book "${title}" by ${author}:
    1. A one-paragraph summary.
    2. A list of 3-5 key themes.
    3. A list of 3 related reading suggestions (title and author).
    
    Base your answer on publicly available information.
  `;

  const apiKey = process.env.GEMINI_API_KEY;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API Error:', errorBody);
      throw new Error(`API Error: ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];

    if (candidate && candidate.content?.parts?.[0]?.text) {
      const text = candidate.content.parts[0].text;

      let sources = [];
      const groundingMetadata = candidate.groundingMetadata;
      if (groundingMetadata && groundingMetadata.groundingAttributions) {
        sources = groundingMetadata.groundingAttributions
          .map((attr) => ({
            uri: attr.web?.uri,
            title: attr.web?.title,
          }))
          .filter((source) => source.uri && source.title);
      }

      res.json({ insight: text, sources: sources });
    } else {
      throw new Error('Invalid response structure from Gemini API.');
    }
  } catch (error) {
    console.error('Error fetching Gemini insights:', error);
    res.status(500).json({ message: error.message });
  }
};
