# Personal Library Tracker — Complete UI Context for Redesign

> **Purpose:** This document gives Stitch AI (or any designer) a complete picture of every screen, component, interaction, and feature in the current app so a redesigned UI can be generated with full fidelity.

---

## 1. App Overview

**Personal Library Tracker** is a full-stack MERN web app that lets readers track their reading life. It is:

- **Single-page app** built with React (client-side routing via React Router)
- **Dark-mode aware** — every screen has a light and dark variant (toggleable via a Sun/Moon button in the navbar)
- **Authenticated** — all pages except Auth and Reset-Password are gated behind a login
- **Responsive** — navbar collapses to a hamburger menu below `md` breakpoint
- **Current color scheme:** Indigo (`#6366f1`) as the primary accent, purple-to-indigo gradients for headers/banners, gray-50/gray-900 backgrounds

---

## 2. Application Shell

### 2.1 Navbar (sticky top bar — visible on all authenticated pages)

| Element | Details |
|---|---|
| Logo | `BookOpen` icon on the left |
| Nav links (desktop) | Horizontal pills: **My Library · Shelves · Dashboard · Friends · Messages · My Diary · My Profile · Billing** |
| Active link style | Indigo-100 bg, indigo-700 text pill |
| Diary link | Shows a small lock icon when diary PIN is enabled |
| Messages link | Shows a red badge with unread count |
| Theme toggle | Sun/Moon icon button (right side) |
| Notification bell | Bell icon with red unread count badge; opens a dropdown panel |
| Welcome text | "Welcome, [Name]" + gold PRO badge if subscribed |
| Mobile hamburger | Below `md` — collapses all nav links into a vertical panel |

### 2.2 Notification Bell Dropdown

- Shows pending friend requests with Accept / Decline buttons
- Shows system notifications: reading reminders, continue-reading nudges, goal pace alerts, streak milestones
- Each notification row has icon, message text, a "mark read" button
- Paginated (8 per page) with Prev / Next controls
- "Mark all read" button at top
- Live — new notifications arrive via WebSocket and also show as toast pop-ups

### 2.3 Global Loading State

Full-screen centered spinner (indigo, animated) while auth is being checked on app load.

---

## 3. Screens (9 total)

---

### Screen 1 — Auth Screen (`/auth`)

**Two modes: Login / Sign Up (toggled via text link at the bottom of the card)**

Card style: white, rounded-2xl, shadow-2xl, max-w-md, centered on a gradient background (indigo-50 to purple-50 / dark: gray-950).

#### Login Mode
- **Header banner:** indigo-to-purple gradient, BookOpen icon, "Welcome Back!" title, subtitle text
- Fields: Email address · Password (with show/hide eye toggle)
- "Forgot password?" inline link (top-right of password field) → transitions to Forgot Password sub-mode
- Submit: full-width gradient button "Sign In"

#### Forgot Password Sub-Mode (within Login)
- Header changes to "Reset Password"
- Single email field + "Send Reset Link" button
- On success: MailCheck icon + "Check your inbox — link expires in 30 minutes"
- "← Back to Sign In" link

#### Sign Up Mode (2-step flow)
- **Step indicator in header:** two step pills "1 Required" and "2 Optional" with a connecting line
- **Step 1 – Required fields:** Full Name · Email address · Password (min 6 chars, show/hide) · Confirm Password
  - "Continue →" button; client-side validation before proceeding
- **Step 2 – Optional fields:** Phone Number · Favorite Genre (dropdown, 15 genre options) · Short Bio (textarea, 280 char counter)
  - "← Back" button + "Create Account" button + "Skip for now →" text link
- Toggle between Login/Sign Up via a text link at the bottom

#### Reset Password Page (`/reset-password/:token`) — Separate route
- Same card visual style as Auth
- Fields: New Password · Confirm New Password
- Submits against a URL token

---

### Screen 2 — My Library (`/`) — Primary / Home screen

**Section A: Reading Stats Bar**
- Page title: "My Reading Stats"
- 5 stat cards in a responsive grid (2 col on mobile → 3 col → 5 col on lg):
  - **Total Books** — BookOpen icon, indigo
  - **Want to Read** — PlusCircle icon, blue
  - **Reading** — Book icon, yellow
  - **Completed** — CheckCircle icon, green
  - **On Hold** — Clock icon, gray
- Each StatCard: white card, large bold number, label below, colored icon top-left

**Section B: Reading Activity Calendar + Friend Activity Feed (side by side)**
- Left 2/3: **Reading Heatmap Calendar**
- Right 1/3: **Friend Activity Feed**

**Reading Heatmap Calendar**
- Rounded-2xl white card with border
- Header row: Calendar icon + "Reading Activity" + streak stat pills:
  - 🔥 [N] day streak (orange bg)
  - [N] best streak (purple bg)
  - [N] pages this year (emerald bg)
  - [N] sessions (blue bg)
- 52-column × 7-row grid of 14×14px squares (GitHub-style)
- Color intensity: gray (0 pages) → emerald-200 → emerald-400 → emerald-600 → emerald-800
- Month labels along top, alternate day labels (Mon/Wed/Fri) on left side
- Hover tooltip shows: date, pages read, number of sessions
- Legend row: "Less [squares] More"
- Loading: animated skeleton pulse

**Friend Activity Feed**
- Card showing friends' recent reading activity
- Each row: friend avatar initial circle + friend name + activity text ("finished X", "started Y") + relative timestamp

**Section C: Filter & Search Bar**
- Status filter pills (horizontal scrollable on mobile): All Books · Want to Read · Reading · Completed · On Hold · DNF
  - Active pill: indigo-600 bg, white text
  - Inactive: white bg, colored icon, border
- Search input: rounded-full, search icon inside left, placeholder "Search by title or author..."
- **SlidersHorizontal icon button** — toggles "More Filters" expandable panel
- **Sparkles icon button** — toggles AI natural-language search panel (purple tint when active)
- **ArrowLeftRight icon button** — opens Import/Export modal

**More Filters Panel** (collapsible, white card)
- Genre text input
- Min. Rating select (Any / 1+ stars / 2+ stars / 3+ stars / 4+ stars)
- Tag text input
- Sort By select (Recently Added / Oldest Added / Title A–Z / Author A–Z / Highest Rated)
- "Clear" text link when any extended filter is active

**AI Search Panel** (collapsible, purple-50/purple-950 bg, purple border)
- Free-form text input: placeholder "e.g. short fantasy books I rated highly last year"
- Sparkles submit button (with Loader2 spinner when fetching)
- Error message if quota exceeded or AI unavailable

**Section D: Book Grid**
- Row header: "[Status Label]" + book count in gray + "Add New Book" button (indigo pill, right-aligned)
- Grid: 1 col → 2 col (lg) → 3 col (xl)
- Loading: spinner centered
- Empty state: large BookOpen icon + "No books matching your criteria"
- **Pagination** component at the bottom (Prev · numbered pages · Next)

#### Book Card (within the grid)
Each card is horizontal (cover left, info right) on md+, stacks vertically on mobile:

| Area | Content |
|---|---|
| Cover image (left, 128px wide) | object-cover, fallback gray placeholder |
| Heart button (top-right of cover) | Toggle favorite — red filled heart if favorited |
| Title | Bold, line-clamp-2 |
| Author | Italic, gray |
| Genre | xs gray |
| Status badge | Rounded pill: blue/yellow/green/red/gray per status |
| Star rating | 5 clickable stars |
| Tag chips | Indigo-50 bg pills, small font |
| Progress bar | Pages/total + % text + colored bar (green=100%, indigo>50%, light-indigo below) |
| Action buttons row | 6 icon-only circular buttons: Toggle Status (indigo) · Edit (yellow) · Log Session (emerald) · Review/Notes/Quotes (teal) · AI Insights (purple) · Delete (red) |

---

### Screen 3 — Shelves (`/shelves`)

Custom book collections (like Spotify playlists for books).

**Create Shelf form** (at the top)
- Rounded-pill text input + "New Shelf" button (indigo pill, Plus icon)
- Inline error message if name already taken

**Shelf Grid** (1 → 2 → 3 col)
- Each shelf card: white rounded-xl, shelf name (bold), "N books" count
  - Clicking the card opens that shelf's detail panel below
  - Active shelf gets an indigo border-2
  - Trash2 delete icon (top-right, red on hover)

**Active Shelf Detail Panel** (below the grid)
- Header: shelf name + "Add Book" (indigo pill) + X close button
- Book grid: 2 → 3 → 4 col of cover thumbnails (h-36)
- Hover on each cover: shows a small X button to remove from shelf
- Empty state: "This shelf is empty — add a book from your library"

**Add Book Picker Modal** (full-screen overlay, max-w-md)
- Header: 'Add to "[Shelf Name]"' + X
- Scrollable list of all library books
- Each row: small cover thumbnail (w-8 h-12) + title + author
- Already-on-shelf books: grayed out + "Already on shelf" label

---

### Screen 4 — Reading Dashboard (`/dashboard`)

**Goals Section**
- Section header "Goals" + "New Goal" button (indigo rounded-full)
- **Goal Creation Form** (collapsible inline form below header):
  - Period select: Yearly / Monthly
  - Year select (current year and 2 prior)
  - Month select (appears only if Monthly chosen)
  - Metric select: Books / Pages
  - Target number input (placeholder "e.g. 24")
  - "Create" button + error message
- **Goal Cards Grid** (1 → 2 → 4 col):
  - Period label (e.g. "October 2026" or "2026")
  - Target text ("24 books" or "500 pages")
  - actual/target + percentage (indigo text, turns green when complete)
  - Progress bar (indigo fill → green when ≥100%)
  - Trash2 delete icon (top-right)
- Empty state: "No goals yet — set one to track your progress"

**AI Habit Insight Banner**
- Gradient bg: purple-50 to indigo-50 (dark: purple-950/30 to indigo-950/30)
- Purple border, rounded-xl
- Default state: Sparkles icon + "Get a plain-language read on your [year] reading habits" + "Get My Insight" button (purple rounded-full)
- Loading state: Loader2 spinner + "Thinking…"
- Result state: Sparkles icon + insight text paragraph
- Error state: red error text (quota exceeded or service unavailable)

**Analytics Section**
- Header "Analytics" + Year selector (right, last 3 years)
- 2×2 grid of Chart Cards:
  1. **Books Completed – [Year]**: vertical bar chart, indigo bars, months on X-axis
  2. **Pages Read – [Year]**: vertical bar chart, sky-blue bars, months on X-axis
  3. **Genres Read (All Time)**: donut/ring pie chart, 8 distinct colors, legend below
  4. **Rating Distribution (All Time)**: vertical bar chart, amber bars, 1–5 stars on X-axis
- Each ChartCard: white bg, icon + title, 224px height chart area
- Empty state: "Nothing here yet — start logging progress and rating books"

---

### Screen 5 — Friends (`/friends`)

**Search bar** (max-w-md, rounded-full pill, search icon inside)
- Auto-searches after 2+ characters, debounced 300ms
- **Search results panel** (dropdown-style card, max-w-md):
  - Each result: name (bold) + email (gray) + relation action button on the right
  - Relation states: "Friends" (UserCheck icon, green) · "Pending" (Clock icon, gray) · "Accept" button (indigo) · "Add" button (indigo-50 bg)
  - "No users found" empty state
  - "Searching…" loading state

**My Friends List**
- Header: "My Friends (N)"
- 1 → 2 → 3 col grid of friend cards:
  - Avatar initial circle (indigo-100 bg, indigo-700 text) with **presence dot** (green = online, gray = offline)
  - Friend name (bold) + "Online" / "Offline" text
  - Message icon button (links to `/messages?friend=[id]`)
  - Unfriend (UserMinus) icon button (red on hover)
- Empty state: centered text "No friends yet — search above to find people"
- Loading state: gray text

---

### Screen 6 — Messages (`/messages`)

Two-column real-time chat layout.

**Left sidebar: Conversation List**
- Each conversation row: avatar initial circle + name + presence dot + last message preview + time + unread count badge
- Active/selected conversation highlighted
- Deep-link support: `/messages?friend=[id]` auto-opens that conversation

**Right: Active Chat Panel**
- **Header:** friend avatar + name + presence dot + "Online"/"Offline" label
- Back arrow button (mobile only)
- **Messages area** (scrollable, auto-scrolls to bottom):
  - Date separator labels: "Today", "Yesterday", formatted date
  - Own messages: right-aligned, indigo-600 bubble, white text
  - Friend messages: left-aligned, white/gray-800 bubble
  - Timestamp below each message
  - Delivery indicators: Check (sent) / CheckCheck (read)
- **Typing indicator:** animated "..." + "[Friend name] is typing…" — auto-clears after 4s
- **"Load older messages"** button at the top for pagination
- **Composer bar** (pinned to bottom):
  - Rounded-full text input (placeholder "Type a message…")
  - Send button (indigo, Send icon)

**Empty state** (no conversation selected):
- MessageCircle icon + "Select a conversation to start chatting"
- Link to Friends page

---

### Screen 7 — My Diary (`/diary`)

The most feature-rich screen. Protected with an optional 4-digit PIN.

**Lock Screen** (shown when diary is locked)
- Large lock icon
- "Your diary is locked" message
- "Unlock Diary" button → opens PIN modal

**DiaryPinModal**
- Three modes: unlock (enter PIN), setup (create PIN), disable (confirm PIN)
- 4 separate numeric input boxes, auto-advance on digit entry

**Main Diary Layout** (two-column on large screens, single-column on mobile)

**Left column: Entry Editor**
- **Date navigation bar:** ← (previous day) · Formatted date (e.g. "Wednesday, 16 September 2026") · → (next day, disabled for future dates)
- **Title input** (large, borderless styled, bold placeholder "Entry title…")
- **Mood Selector Row** (7 chips, horizontal scroll):
  - 😊 Joyful (yellow-400 border/bg)
  - 😌 Peaceful (teal-400)
  - 💡 Inspired (purple-400)
  - ⚡ Productive (blue-400)
  - 😐 Neutral (gray-400)
  - 😟 Stressed (orange-400)
  - 😔 Down (indigo-400)
  - Selected chip: vivid color; unselected: faded opacity
- **Content textarea** (large, auto-resize, "Write your thoughts…" placeholder)
- **AI Writing Prompt button** (Sparkles icon): fetches a context-aware writing prompt; inserts it above the textarea
- **Gratitude section:** 3 labeled text inputs "I'm grateful for…" (1, 2, 3)
- **Linked Book picker:** search-as-you-type input to link a book from the library; shows cover + title when linked; X to remove
- **Image upload area:** drag-or-click zone; shows uploaded image thumbnails with X remove button; up to 3 images per entry
- **Tags chip input:** type + Enter or comma to add tag; rendered as chips with X; shows existing tags
- **Auto-save status indicator:** idle (nothing) → "Saving…" (spinner) → "✓ Saved" (green) → "Error" (red)
- **Toolbar buttons:** Save Entry (manual) · Delete Entry (red, confirmation)

**AI Chat Panel** (collapsible section below the editor)
- Collapsible via "Ask your diary" toggle button
- Chat message list: user messages (indigo bg, right) and AI responses (gray bg, left)
- Text input + Send button
- Loading indicator while AI responds

**Right column: Stats + Entry List Sidebar**
- **Stats pills row:** Total Entries · Current Streak · Longest Streak
- **Entry list** (scrollable):
  - Each row: date + first line of title/content
  - Visual dot indicator for dates with saved entries
  - Clicking a row navigates the editor to that date

**Diary Lock Controls** (top-right of the diary page)
- "Lock Diary" button (when unlocked + PIN enabled) — instant lock
- "Enable PIN" / "Disable PIN" / "Change PIN" button depending on state

---

### Screen 8 — My Profile (`/profile`)

**Profile Card** (max-w-2xl, centered)

**Header Banner** (indigo-to-purple gradient, py-8)
- Avatar: 80×80px rounded-2xl
  - If URL: shows image with border
  - If no URL: shows initials (up to 2 chars) in white on indigo/20 bg
  - In edit mode: ImageUploadField component replaces the avatar
- Name (bold, white, 24px)
- Email (indigo-100 text, Mail icon)
- Member since date (indigo-200 text, Calendar icon)
- "Edit Profile" button (top-right, frosted glass style: bg-white/20 + backdrop-blur)
- In edit mode: button becomes "Cancel"

**Body — Display Mode** (2-col grid of InfoCards)
- Full Name · Email · Phone · Favorite Genre · Bio (spans full width)
- InfoCard: gray-50 bg, icon + uppercase label + value

**Body — Edit Mode** (vertical form)
- Name input (required)
- Email: read-only locked notice with Shield icon
- Phone input
- Favorite Genre select (15 options)
- Bio textarea (280 char + live counter)
- "Save Changes" gradient button (full width)

**Notification Preferences** (toggle switch section)
- Section header with Bell icon
- 4 toggle rows (indigo switch, gray when off):
  - Daily reading reminders
  - Continue-reading nudges
  - Goal pace alerts
  - Streak milestones
- Each row: label (bold) + hint text (xs gray) + toggle switch (right-aligned)

**Email Digest** (toggle section)
- Section header with Inbox icon
- Single toggle: "Weekly reading recap" — description: "A Monday-morning email with books completed & pages read"

**Sign Out** (danger zone at bottom)
- "Sign Out" label + description + red-border button

---

### Screen 9 — Billing (`/billing`)

**Header:** CreditCard icon + "Billing" title + subtitle (current plan or upsell text)

**Current Subscription Status Card** (shown if Pro subscriber)
- Sparkles icon + "Library Pro" label + status pill ("active" in green)
- Renewal/cancellation date text
- "Cancel subscription" red text button

**Pricing Comparison Grid** (2 col, max-w-3xl)

| Free Card | Pro Card |
|---|---|
| "Free" title | "Library Pro ✦" title |
| ₹0 price | ₹99 / month |
| 3 features with gray checkmarks | 4 features with indigo checkmarks |
| No action (current default) | "Upgrade to Pro" rounded-full indigo button |
| Transparent border | Indigo border (green if already active) |

- "Upgrade to Pro" button triggers Razorpay payment modal (hosted by Razorpay)
- If already Pro: shows "✓ Active" green text instead of button
- Error message area above the grid

---

## 4. Modal Components

### BookFormModal — Add / Edit Book

Full-screen overlay, max-w-2xl card, rounded-2xl.

Fields: Title* · Author* · Genre · Status (select) · Cover URL + image upload (drag-drop + preview thumbnail) · Total Pages · Current Page · Publication Year · ISBN · Description (textarea) · Tags (chip input)

Special: AI-powered cover suggestion button (Sparkles) — suggests a cover image based on title/author.

Actions: Cancel · "Add Book" / "Save Changes"

---

### BookDetailModal — Book Details (5 tabs)

Full-screen overlay, tabbed navigation.

| Tab | Icon | Content |
|---|---|---|
| Review | MessageSquare | Textarea for book review + "Draft with AI" toggle (enter bullet notes → AI generates a polished review) + Save button + status ("Saved", "Saving…") |
| Notes | StickyNote | Private notes textarea + Save button |
| Quotes | Quote icon | List of saved quotes (quote text + page number + delete) + Add Quote form |
| Tags | Tag | Current tag chips + add tag input + Save button |
| AI | Sparkles | "Get AI Analysis" on-demand button → shows: book summary paragraph + similar book recommendations list |

---

### LogSessionModal — Log a Reading Session

Compact overlay, max-w-md, gradient header (indigo→purple).

Fields:
- Pages Read* (number, required)
- Now on page (optional — updates the book's progress bar live in the modal)
- Duration (minutes, optional)
- Date (date picker, default today)
- Note (short textarea, optional)

Progress preview: indigo gradient bar updates live as "now on page" changes.

Actions: Cancel · "Log Session" (gradient button)

---

### InsightModal — AI Book Insights

Small overlay with:
- Book title in header
- AI-generated insights text (summary, themes, reading level, etc.)
- Loader2 spinner while fetching

---

### DeleteModal — Confirm Delete

Simple 2-button confirm dialog:
- Warning message: "Are you sure you want to delete this book?"
- Cancel (outline) · Delete (red, filled)

---

### ImportExportModal — Import / Export Library

Tabbed modal:
- **Export tab:** Download as CSV or JSON buttons
- **Import tab:** File upload zone (CSV/JSON), preview parsed rows, Confirm Import button

---

## 5. UI Pattern Library

| Pattern | Details |
|---|---|
| Primary button | Rounded-full or rounded-xl, indigo-600 bg, white text, hover → indigo-700 |
| Gradient button | `from-indigo-600 to-purple-600`, `shadow-lg`, `hover:shadow-indigo-500/30` |
| Danger button | Red border, white bg, red text, hover red-50 bg |
| Ghost button | Border only, transparent bg |
| Status badge pill | Rounded-full: blue (Want to Read), yellow (Reading), green (Completed), red (DNF), gray (On Hold) |
| Card | `bg-white dark:bg-gray-800 rounded-xl shadow-md` |
| Section header | `text-3xl font-extrabold` + lucide icon with indigo color |
| Input field | Rounded-lg, border-gray-300, `focus:ring-2 focus:ring-indigo-500/20`, dark variants |
| Toggle switch | 40×22px pill, indigo when on, gray when off, white circle slides |
| Toast notification | Fixed top-right corner, emerald bg (success) or red bg (error), auto-dismisses in 3.5s |
| Inline error | Red-50 bg, red-200 border, AlertTriangle icon, red text |
| Empty state | Centered, large gray lucide icon, muted message text |
| Loading | Loader2 `animate-spin` (indigo) or skeleton pulse animation |
| Presence dot | 10×10px circle: emerald-500 (online), gray-300 (offline) |
| PRO badge | Amber gradient pill, Sparkles icon, white bold text |
| AI-powered elements | Purple accent (purple-600 buttons, purple-50 bg, Sparkles icon) |

---

## 6. Theme / Color Tokens

| Token | Light mode | Dark mode |
|---|---|---|
| Page background | `gray-50` | `gray-900` |
| Card / panel bg | `white` | `gray-800` |
| Text primary | `gray-900` | `white` |
| Text secondary | `gray-500` / `gray-600` | `gray-400` / `gray-300` |
| Border | `gray-200` / `gray-300` | `gray-700` / `gray-800` |
| Accent primary | `indigo-600` | `indigo-400` |
| Accent hover | `indigo-700` | `indigo-300` |
| AI accent | `purple-600` | `purple-400` |
| Header gradient | `from-indigo-600 to-purple-600` | same |
| Chart bar 1 | `#6366f1` (indigo) | same |
| Chart bar 2 | `#0ea5e9` (sky) | same |
| Chart bar 3 | `#f59e0b` (amber) | same |
| Pie chart colors | 8-color CVD-safe palette: indigo, emerald, amber, rose, sky, violet, teal, orange | same |

---

## 7. Navigation Map

```
/auth                    Auth Screen (Login / Register / Forgot Password)
/reset-password/:token   Password reset page

/ (My Library)           Home screen (default after login)
  Embedded modals:
    - Add/Edit Book
    - Book Detail (Review, Notes, Quotes, Tags, AI)
    - Log Reading Session
    - AI Book Insights
    - Delete Confirmation
    - Import / Export

/shelves                 Custom book shelves/collections
/dashboard               Reading goals + analytics charts + AI habit insight
/friends                 Friend search, friend list, presence indicators
/messages                Real-time chat with friends
/diary                   Daily diary (mood, gratitude, images, AI prompts, AI chat)
/profile                 Profile editor, notification prefs, email digest, sign out
/billing                 Subscription: Free vs Library Pro (Razorpay payments)
```

---

## 8. Real-Time / Live Features (WebSocket)

Needs visible UI affordances in the redesign:

- **Online presence dots** — green/gray indicator on friend avatars everywhere
- **Live chat** — messages appear instantly, typing indicator, read receipts
- **Unread chat badge** — navbar badge updates without page refresh
- **Notification toasts** — pop up bottom-right on new events
- **Friend request updates** — friends list and search results update live

---

## 9. AI-Powered Features

All use purple accent colour, Sparkles icon. Should feel premium:

| Feature | Location | Trigger |
|---|---|---|
| AI Book Insights | Library → Book Card (Zap icon) | On-demand button |
| Natural Language Search | Library → Sparkles icon button | User submits query |
| Book Summary | Book Detail Modal → AI tab | "Get AI Analysis" button |
| Similar Books | Book Detail Modal → AI tab | Same button as above |
| Draft Review with AI | Book Detail Modal → Review tab | "Draft with AI" toggle |
| Habit Insight | Dashboard → purple banner | "Get My Insight" button |
| Writing Prompt | Diary → Sparkles button | Button in editor toolbar |
| Ask Diary (AI Chat) | Diary → bottom panel | User types in chat |

**Quota:** Free = 10 AI calls/month. Pro = unlimited.
Error states: "You've used all your free AI calls this month. Upgrade to Library Pro." / "AI features are not configured on this server yet."

---

## 10. Key Data Entities

| Entity | Key fields (for UI mapping) |
|---|---|
| Book | title, author, genre, status (wantToRead / reading / completed / onHold / dnf), coverUrl, totalPages, currentPage, rating (1–5 stars), isFavorite (bool), tags (string[]), publicationYear, isbn, description |
| ReadingSession | bookId, pagesRead, currentPage, durationMinutes, note, date |
| Shelf | name, books[] |
| Goal | period (yearly/monthly), year, month, metric (books/pages), target, actual, percent |
| DiaryEntry | date (YYYY-MM-DD), title, content, mood (7 moods), tags[], gratitude[3], linkedBook, images[] |
| Quote | bookId, text, page |
| User | name, email, phone, bio, favoriteGenre, avatarUrl, isPro, notificationPrefs {readingReminders, continueReadingNudges, goalReminders, streakAlerts}, emailDigestOptIn |
| Notification | type, message, isRead, createdAt |
| Message | from, to, text, createdAt, readAt |

---

*Generated from full source code analysis of PersonalLibraryTracker-main — all 9 pages, 20 components, and services.*
