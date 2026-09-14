import swaggerJSDoc from 'swagger-jsdoc';

// Phase 15: the OpenAPI document itself. `definition` carries everything
// that isn't tied to one specific route (info, servers, the bearer auth
// scheme, and every reusable `components.schemas` entry) — every route
// file's own `@swagger` JSDoc blocks (picked up via `apis` below) only need
// to $ref these, not redeclare a Book/User/etc. shape every time.
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Library Nest API',
    version: '1.0.0',
    description:
      'REST API for Library Nest — a personal reading tracker with social, payment, and reminder features. ' +
      'Every route below except the ones explicitly marked "Public" requires a Bearer access token, obtained from ' +
      '`POST /auth/login` or `POST /auth/register` and refreshed via `POST /auth/refresh` (that one reads an httpOnly cookie, not a body).',
  },
  servers: [{ url: '/api', description: 'API root (same origin as this docs page)' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, session/token lifecycle, password reset' },
    { name: 'Books', description: 'Core library CRUD, search/filter, import/export' },
    { name: 'Reading', description: 'Progress, sessions, streaks, calendar heatmap' },
    { name: 'Organization', description: 'Ratings, favorites, tags, reviews, private notes' },
    { name: 'Shelves', description: 'User-defined book collections' },
    { name: 'Quotes', description: 'Per-book highlights/quotes' },
    { name: 'Goals & Analytics', description: 'Reading goals and aggregate stats' },
    { name: 'Friends', description: 'Friend search, requests, and the friends list' },
    { name: 'Activity', description: "Friends' live activity feed" },
    { name: 'Notifications', description: 'Persisted in-app notification inbox' },
    { name: 'Payments', description: 'Razorpay Library Pro subscriptions + webhook' },
    { name: 'Uploads', description: 'Cloudinary image uploads' },
    { name: 'Diary', description: 'Personal diary — PIN lock, entries, stats' },
    { name: 'External', description: 'Google Books search, ISBN lookup, Gemini AI insights' },
    {
      name: 'AI',
      description:
        'Phase 18 stretch features — similar books, ask-your-diary (RAG), spoiler-light summaries, habit insights, review drafting, natural-language search',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'A short-lived (15 min) access token. Get one from /auth/login, /auth/register, or /auth/refresh.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      NotificationPrefs: {
        type: 'object',
        properties: {
          readingReminders: { type: 'boolean' },
          goalReminders: { type: 'boolean' },
          continueReadingNudges: { type: 'boolean' },
          streakAlerts: { type: 'boolean' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
          phone: { type: 'string' },
          bio: { type: 'string' },
          favoriteGenre: { type: 'string' },
          avatarUrl: { type: 'string' },
          isPro: { type: 'boolean' },
          notificationPrefs: { $ref: '#/components/schemas/NotificationPrefs' },
          emailDigestOptIn: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthSession: {
        allOf: [
          { $ref: '#/components/schemas/User' },
          {
            type: 'object',
            properties: { accessToken: { type: 'string', description: 'JWT, 15 min TTL' } },
          },
        ],
      },
      Book: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          title: { type: 'string' },
          author: { type: 'string' },
          genre: { type: 'string' },
          status: { type: 'string', enum: ['wantToRead', 'reading', 'completed', 'dnf', 'onHold'] },
          coverUrl: { type: 'string' },
          isbn: { type: 'string', nullable: true },
          currentPage: { type: 'integer' },
          totalPages: { type: 'integer' },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          finishDate: { type: 'string', format: 'date-time', nullable: true },
          rating: { type: 'number', nullable: true, minimum: 0, maximum: 5 },
          isFavorite: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BookInput: {
        type: 'object',
        required: ['title', 'author'],
        properties: {
          title: { type: 'string' },
          author: { type: 'string' },
          genre: { type: 'string' },
          status: { type: 'string', enum: ['wantToRead', 'reading', 'completed', 'dnf', 'onHold'] },
          coverUrl: { type: 'string' },
          isbn: { type: 'string', description: '10 or 13 digits, hyphens allowed on input' },
          currentPage: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 },
          startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          finishDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
      PaginatedBooks: {
        type: 'object',
        properties: {
          books: { type: 'array', items: { $ref: '#/components/schemas/Book' } },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      ImportResult: {
        type: 'object',
        properties: {
          added: { type: 'integer' },
          skipped: { type: 'integer' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                row: { type: 'integer' },
                title: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      ReadingSession: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          book: { type: 'string' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          pagesRead: { type: 'integer', minimum: 1 },
          durationMinutes: { type: 'integer', nullable: true },
          note: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      StreakInfo: {
        type: 'object',
        properties: {
          streak: { type: 'integer' },
          longestStreak: { type: 'integer' },
          totalSessions: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Review: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          book: { type: 'string' },
          text: { type: 'string', maxLength: 4000 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Note: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          book: { type: 'string' },
          text: { type: 'string', maxLength: 4000 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Quote: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          book: { type: 'string' },
          text: { type: 'string', maxLength: 2000 },
          page: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Shelf: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          name: { type: 'string', maxLength: 60 },
          books: {
            type: 'array',
            items: { type: 'string' },
            description: 'Book ids — populated to full Book objects on GET /shelves/{id}',
          },
        },
      },
      ReadingGoal: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          year: { type: 'integer' },
          period: { type: 'string', enum: ['yearly', 'monthly'] },
          month: { type: 'integer', nullable: true, minimum: 1, maximum: 12 },
          metric: { type: 'string', enum: ['books', 'pages'] },
          target: { type: 'integer', minimum: 1 },
        },
      },
      GoalProgress: {
        allOf: [
          { $ref: '#/components/schemas/ReadingGoal' },
          {
            type: 'object',
            properties: { actual: { type: 'integer' }, percent: { type: 'integer' } },
          },
        ],
      },
      AnalyticsOverview: {
        type: 'object',
        properties: {
          booksPerMonth: {
            type: 'array',
            items: {
              type: 'object',
              properties: { month: { type: 'string' }, count: { type: 'integer' } },
            },
          },
          pagesPerMonth: {
            type: 'array',
            items: {
              type: 'object',
              properties: { month: { type: 'string' }, pages: { type: 'integer' } },
            },
          },
          genreBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: { genre: { type: 'string' }, count: { type: 'integer' } },
            },
          },
          ratingDistribution: {
            type: 'array',
            items: {
              type: 'object',
              properties: { rating: { type: 'number' }, count: { type: 'integer' } },
            },
          },
        },
      },
      FriendUser: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          avatarUrl: { type: 'string' },
          isOnline: { type: 'boolean' },
        },
      },
      FriendSearchResult: {
        allOf: [
          { $ref: '#/components/schemas/FriendUser' },
          {
            type: 'object',
            properties: {
              relation: {
                type: 'string',
                enum: ['none', 'friends', 'pending_sent', 'pending_received'],
              },
              requestId: { type: 'string', nullable: true },
            },
          },
        ],
      },
      FriendRequest: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          from: { $ref: '#/components/schemas/FriendUser' },
          to: { $ref: '#/components/schemas/FriendUser' },
          status: { type: 'string', enum: ['pending', 'accepted', 'declined'] },
        },
      },
      ActivityEvent: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['book_added', 'book_completed', 'book_rated', 'reading_streak'],
          },
          user: { $ref: '#/components/schemas/FriendUser' },
          book: {
            type: 'object',
            nullable: true,
            properties: {
              _id: { type: 'string' },
              title: { type: 'string' },
              coverUrl: { type: 'string' },
            },
          },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['reading_reminder', 'continue_reading', 'goal_reminder', 'streak_milestone'],
          },
          message: { type: 'string' },
          book: { type: 'object', nullable: true },
          metadata: { type: 'object' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [
              'created',
              'authenticated',
              'active',
              'past_due',
              'halted',
              'cancelled',
              'completed',
            ],
          },
          currentEnd: { type: 'string', format: 'date-time', nullable: true },
          cancelAtCycleEnd: { type: 'boolean' },
        },
      },
      DiaryEntry: {
        type: 'object',
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          title: { type: 'string', maxLength: 150 },
          content: { type: 'string' },
          mood: {
            type: 'string',
            enum: ['happy', 'peaceful', 'inspired', 'productive', 'neutral', 'stressed', 'sad'],
          },
          tags: { type: 'array', items: { type: 'string' } },
          linkedBook: { type: 'string', nullable: true },
          gratitude: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          images: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          wordCount: { type: 'integer' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing, invalid, or expired access token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Authenticated, but not allowed to perform this action',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'No resource with that id (or it belongs to another user)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Request body failed schema validation',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  // Every route not explicitly overridden with `security: []` in its own
  // JSDoc block requires the bearer token — matches this API's actual
  // default (nearly everything sits behind the `protect` middleware).
  security: [{ bearerAuth: [] }],
};

const options = {
  definition,
  // Scanned for `@swagger` YAML blocks — every route file, one per phase's
  // worth of endpoints. Controllers are deliberately not scanned: paths and
  // methods live in the route files, so annotating there keeps each route's
  // doc physically next to the `router.METHOD(...)` line it describes.
  apis: ['./routes/*.js'],
};

export default swaggerJSDoc(options);
