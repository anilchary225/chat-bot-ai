# Changelog

All notable changes to Zenoxi are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] - 2026-11-14

### Added
- First-use feature introduction and version-based "What's new" announcements in Zenoxi, available to all users.
- General resume tailoring without a job description, plus a clear-resume-data action.

### Changed
- Telugu typed in Latin letters receives Tenglish replies in Latin letters; assistants identify themselves as Zenoxi.
- Zenoxi chat prioritizes its built-in Resume ATS Match feature for resume improvement, tailoring and ATS-score requests.

## [0.5.0] - 2026-11-12

### Added
- **Website Agents (Phase 1):** owners create a website assistant by chatting with Zenoxi (website reading +
  interview + editable business profile), add knowledge (pages, files, notes), customize the look and inquiry form,
  test it, and install a floating widget with one line of code. Visitors get answers only from the owner's
  information and can send inquiries (form card or conversational), saved as leads.
- Public widget API with allowed-domain checks, preview mode, per-IP rate limits and a daily per-agent cap.
- **Website Agents (Phase 2/3):** lead statuses, notes, AI summaries and conversation view; Excel/CSV export; owner
  alerts, visitor confirmations with brochure attachments, follow-ups and daily/weekly reports (with unsubscribe
  links and a daily email cap); agent avatars (orb, initials, emoji, logo); widget in English, Hindi, Telugu and
  Tamil; owners' own OpenRouter key; analytics; an inbox of unanswered questions.
- **Token savings:** instant FAQ answers and an answer cache for agents, adaptive knowledge/document budgets, trimmed
  chat history and reply length caps.
- **Load balancing:** `deploy/nginx` runs several API copies behind nginx; scheduled jobs use a MongoDB lock so they
  run once.
- Admin dashboard for platform admins (`ADMIN_EMAILS`) at `/admin`: overview with a 14-day chart, users (search,
  details, block, delete with all data), agents (filters, usage, disable), platform email log, system health and
  "Run jobs now". Blocked users can't sign in and their agents pause.
- Direct links `/admin`, `/agents` and `/resume`.
- Replies in the user's language (Telugu, Hindi, Tamil and others, including those typed in English letters) in the
  main chat and in Website Agents.
- "Check your Spam or Promotions folder" notes on the sign-in code screen and in the widget after an inquiry with
  a confirmation email.
- Safe website reader with SSRF protection and robots.txt support.
- Full documentation set: user guide, architecture, API reference, configuration, deployment, development,
  troubleshooting, security policy, contributing guide and this changelog.

### Changed
- Email logos (sign-in codes and Website Agent emails) are drawn with HTML instead of an image, so they show even
  when email apps block images; agent emails start with the business's initial and name.
- "Continue with Google" uses Google's white outline button with the logo next to the text, in both themes.

### Fixed
- **Admin** now appears right after sign-in (the sign-in response includes `is_admin`), not only after a reload.
- `/admin`, `/agents` and `/resume` returned 404 on Vercel; the rewrites now point to `/`.
- Questions written in Telugu, Hindi or Tamil script no longer get a cached English answer; they always go to the AI.
- Preview (test) inquiries only email the owner's own address, never the address typed into the form.
- Lead and user drawers open at the right edge of the screen instead of inside the page.
- Default form texts (title, field labels, button, thank-you) are translated when the widget language isn't English.

## [0.3.0] - 2026-11-11

### Added
- Accounts: passwordless sign-up/sign-in with 6-digit email codes (Brevo or SMTP) and **Continue with Google**.
- Branded HTML verification email template.
- Per-user chats; private keys for chats started on messaging apps.
- WhatsApp Cloud API and Instagram messaging: webhooks, `link CODE`, `/web`, `/new`, `/search`, `/help`, and
  WhatsApp document uploads.
- Instagram API with Unified login (system-user tokens), alongside Instagram-login tokens.
- "Continue on…" popover with link codes, live sync of linked chats, and "via Instagram/WhatsApp" badges.
- Live web search with numbered, clickable sources (Tavily, with a fallback to free engines and a quota cooldown).
- Document uploads (PDF, DOCX, text, CSV, JSON, code) with relevant-passage selection.
- Resume ATS Match: keyword and formatting score, AI tailoring, one-page PDF and DOCX template.
- Privacy Policy, Terms of Service and Data deletion pages.

### Changed
- Mobile chat uses the full width, with the assistant avatar above each reply.
- The system prompt includes today's date.

## [0.2.0] - 2026-11-11

### Changed
- Redesigned the interface with Framer Motion: animated orb assistant, aurora background, kinetic welcome screen.
- New ember/amber color palette (no purple) and new orb-planet logo.
- Added a light theme.

## [0.1.0] - 2026-11-10

### Added
- First version: FastAPI backend with MongoDB chat history and streaming replies, React frontend.
- Deployments for Render, Vercel and Oracle Cloud.
- Hosted inference through Ollama Cloud, later switched to OpenRouter free models.

[Unreleased]: https://github.com/anilchary225/chat-bot-ai/compare/51c4f27...HEAD
[0.3.0]: https://github.com/anilchary225/chat-bot-ai/compare/a3690ce...51c4f27
[0.2.0]: https://github.com/anilchary225/chat-bot-ai/compare/7a38f24...a3690ce
[0.1.0]: https://github.com/anilchary225/chat-bot-ai/commits/7a38f24
