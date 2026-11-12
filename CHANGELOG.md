# Changelog

All notable changes to Zenoxi are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Full documentation set: user guide, architecture, API reference, configuration, deployment, development,
  troubleshooting, security policy, contributing guide and this changelog.

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
