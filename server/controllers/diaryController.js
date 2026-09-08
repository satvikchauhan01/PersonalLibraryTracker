import DiaryEntry from '../models/DiaryEntry.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// ─────────────────────────────────────────────────────────────────────────────
// PIN / LOCK MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get diary lock status (is lock enabled? is pin set?)
// @route   GET /api/diary/lock/status
// @access  Private
export const getPinStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('diaryLockEnabled diaryPin');
    res.json({
      diaryLockEnabled: user.diaryLockEnabled,
      hasPinSet: !!user.diaryPin,
    });
  } catch (error) {
    console.error('getPinStatus error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Set / update diary PIN
// @route   POST /api/diary/lock/setup-pin
// @access  Private
export const setupPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin || String(pin).length < 4 || String(pin).length > 6) {
    return res.status(400).json({ message: 'PIN must be 4–6 digits.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(String(pin), salt);

    await User.findByIdAndUpdate(req.user._id, {
      diaryPin: hashedPin,
      diaryLockEnabled: true,
    });

    res.json({ message: 'Diary PIN set successfully. Lock is now enabled.' });
  } catch (error) {
    console.error('setupPin error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Verify diary PIN and return short-lived diary access token
// @route   POST /api/diary/lock/verify-pin
// @access  Private
export const verifyPin = async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ message: 'PIN is required.' });
  }

  try {
    const user = await User.findById(req.user._id).select('+diaryPin diaryLockEnabled');
    if (!user || !user.diaryPin) {
      return res.status(400).json({ message: 'No diary PIN configured.' });
    }

    const isMatch = await user.matchDiaryPin(pin);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect PIN. Try again.', incorrect: true });
    }

    // Issue a short-lived diary access token (30 minutes)
    const diaryToken = jwt.sign(
      { userId: req.user._id.toString() },
      process.env.JWT_SECRET + '_diary',
      { expiresIn: '30m' }
    );

    res.json({ diaryToken, message: 'Diary unlocked successfully.' });
  } catch (error) {
    console.error('verifyPin error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Disable diary PIN lock
// @route   POST /api/diary/lock/disable
// @access  Private
export const disablePin = async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ message: 'Current PIN required to disable lock.' });
  }

  try {
    const user = await User.findById(req.user._id).select('+diaryPin');
    const isMatch = await user.matchDiaryPin(pin);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect PIN.' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      diaryLockEnabled: false,
      diaryPin: null,
    });

    res.json({ message: 'Diary lock disabled.' });
  } catch (error) {
    console.error('disablePin error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DIARY ENTRY CRUD
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all entry summaries for calendar (date, mood, title, wordCount)
// @route   GET /api/diary/entries
// @access  Private + DiaryLock
export const getEntries = async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user: req.user._id })
      .select('date title mood wordCount tags')
      .sort({ date: -1 });
    res.json(entries);
  } catch (error) {
    console.error('getEntries error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Get full entry by date string (YYYY-MM-DD)
// @route   GET /api/diary/entries/:date
// @access  Private + DiaryLock
export const getEntryByDate = async (req, res) => {
  try {
    const entry = await DiaryEntry.findOne({
      user: req.user._id,
      date: req.params.date,
    }).populate('linkedBook', 'title author coverUrl');

    if (!entry) {
      return res.status(404).json({ message: 'No entry found for this date.' });
    }
    res.json(entry);
  } catch (error) {
    console.error('getEntryByDate error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Save (create or update) entry for a given date
// @route   PUT /api/diary/entries/:date
// @access  Private + DiaryLock
export const saveEntry = async (req, res) => {
  const { title, content, mood, tags, linkedBook, gratitude } = req.body;
  const { date } = req.params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const wordCount = content
    ? content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  try {
    const entry = await DiaryEntry.findOneAndUpdate(
      { user: req.user._id, date },
      {
        $set: {
          title: title || '',
          content: content || '',
          mood: mood || 'neutral',
          tags: tags || [],
          linkedBook: linkedBook || null,
          gratitude: gratitude || [],
          wordCount,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(entry);
  } catch (error) {
    console.error('saveEntry error:', error);
    res.status(500).json({ message: 'Server error saving entry.' });
  }
};

// @desc    Delete entry for a given date
// @route   DELETE /api/diary/entries/:date
// @access  Private + DiaryLock
export const deleteEntry = async (req, res) => {
  try {
    const result = await DiaryEntry.findOneAndDelete({
      user: req.user._id,
      date: req.params.date,
    });
    if (!result) {
      return res.status(404).json({ message: 'No entry found for this date.' });
    }
    res.json({ message: 'Entry deleted.' });
  } catch (error) {
    console.error('deleteEntry error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS — STREAK, MOOD, WORD COUNT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get diary stats: total entries, streak, mood distribution, total words
// @route   GET /api/diary/stats
// @access  Private + DiaryLock
export const getDiaryStats = async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user: req.user._id })
      .select('date mood wordCount')
      .sort({ date: -1 });

    const totalEntries = entries.length;
    const totalWords = entries.reduce((sum, e) => sum + (e.wordCount || 0), 0);

    // Mood counts
    const moodCounts = {};
    for (const e of entries) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }

    // Streak: consecutive days ending today/yesterday
    let streak = 0;
    if (entries.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build a Set of date strings for quick lookup
      const dateSet = new Set(entries.map(e => e.date));

      let current = new Date(today);
      while (true) {
        const ds = current.toISOString().split('T')[0];
        if (dateSet.has(ds)) {
          streak++;
          current.setDate(current.getDate() - 1);
        } else {
          // allow one gap for today not yet written
          if (streak === 0) {
            current.setDate(current.getDate() - 1);
            const yesterday = current.toISOString().split('T')[0];
            if (dateSet.has(yesterday)) {
              streak++;
              current.setDate(current.getDate() - 1);
              continue;
            }
          }
          break;
        }
      }
    }

    res.json({ totalEntries, totalWords, streak, moodCounts });
  } catch (error) {
    console.error('getDiaryStats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI WRITING PROMPT (Gemini)
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Generate a personalized reflective writing prompt via Gemini
// @route   GET /api/diary/prompt
// @access  Private
export const getWritingPrompt = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'Gemini API key not configured.' });
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const userQuery = `Generate ONE short, warm, and reflective personal diary writing prompt for today (${today}). 
The prompt should encourage the person to reflect on their feelings, small joys, things they learned, or anything meaningful. 
It should be 1-2 sentences, conversational, and personal in tone. Do not add numbering or quotes. Just the prompt text.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userQuery }] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini prompt error:', errText);
      return res.status(500).json({ message: 'Failed to generate prompt.' });
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';

    if (!text) {
      return res.status(500).json({ message: 'Empty response from Gemini.' });
    }

    res.json({ prompt: text.trim() });
  } catch (error) {
    console.error('getWritingPrompt error:', error);
    res.status(500).json({ message: 'Failed to get writing prompt.' });
  }
};
