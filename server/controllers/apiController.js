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

// @desc    Look up a book by ISBN (Google Books → Open Library fallback)
// @route   GET /api/external/isbn/:isbn
// @access  Private
export const getBookByISBN = async (req, res) => {
  const { isbn } = req.params;

  // Strip hyphens/spaces for the API calls
  const cleanIsbn = isbn.replace(/[\s-]/g, '');

  try {
    // 1. Try Google Books isbn: query
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.GEMINI_API_KEY;
    const gbUrl = `${GOOGLE_BOOKS_API_URL}isbn:${cleanIsbn}&maxResults=1${apiKey ? `&key=${apiKey}` : ''}`;

    const gbResponse = await fetch(gbUrl, {
      headers: { 'User-Agent': 'PersonalLibraryTracker/1.0' },
    });

    if (gbResponse.ok) {
      const gbData = await gbResponse.json();
      const items = gbData.items || [];

      if (items.length > 0) {
        const info = items[0].volumeInfo;
        return res.json({
          title: info.title || 'N/A',
          author: info.authors ? info.authors.join(', ') : 'Unknown Author',
          genre: info.categories ? info.categories[0] : 'Fiction',
          coverUrl: info.imageLinks
            ? info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || ''
            : '',
          isbn: cleanIsbn,
        });
      }
    }

    // 2. Fallback: Open Library ISBN API
    const olResponse = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`, {
      headers: { 'User-Agent': 'PersonalLibraryTracker/1.0' },
    });

    if (olResponse.ok) {
      const olData = await olResponse.json();

      // Resolve author from /authors/:key if present
      let authorName = 'Unknown Author';
      if (olData.authors && olData.authors.length > 0) {
        try {
          const authorKey = olData.authors[0].key; // e.g. "/authors/OL..."
          const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`, {
            headers: { 'User-Agent': 'PersonalLibraryTracker/1.0' },
          });
          if (authorRes.ok) {
            const authorData = await authorRes.json();
            authorName = authorData.name || 'Unknown Author';
          }
        } catch {
          // silently ignore author resolution failure
        }
      }

      // Cover image from Open Library covers API
      const coverId = olData.covers ? olData.covers[0] : null;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';

      return res.json({
        title: olData.title || 'N/A',
        author: authorName,
        genre: olData.subjects ? olData.subjects[0] : 'General',
        coverUrl,
        isbn: cleanIsbn,
      });
    }

    // 3. Not found in either source
    return res.status(404).json({ message: `No book found for ISBN ${isbn}` });
  } catch (error) {
    console.error('ISBN lookup error:', error.message);
    res.status(500).json({ message: 'Error looking up ISBN' });
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
