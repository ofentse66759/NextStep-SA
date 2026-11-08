# NextStep SA

**Can you still make the deadline? Find out, and fix each gap.**

NextStep SA is a mobile-friendly, low-data web app that helps young South Africans prepare for opportunities they have already found: jobs, learnerships, internships, bursaries and training. It turns an opportunity's published requirements into a personal checklist, shows what is missing, estimates whether the user can still meet the closing date, and suggests practical next steps.

It is designed to complement discovery platforms such as SAYouth.mobi by supporting the step between *finding* an opportunity and *submitting a complete application*.

> **Live demo:** [add your Vercel link here]
> **Status:** working prototype for the Youth Employment and Digital Entrepreneurship challenge. Listings in the demo are samples until real, checked adverts are added.

## Why this matters
Stats SA's Quarterly Labour Force Survey for Q2 2026 (released 11 August 2026) puts youth (15-34) unemployment at 47.4%, with about 5.0 million young people unemployed. In Q1 2026, 45.6% of 15-34 year olds were not in employment, education or training. Many applications fail not because the person is unsuitable, but because of missing documents, unclear requirements, missed deadlines or scams.

## What it does
- **Readiness Plan (core).** Add an opportunity or paste an advert; requirements are detected into an editable checklist. Mark each as Yes / No / Not sure and enter the days needed. The app compares the days needed (plus a one-day buffer) with the days left and shows **On track, Tight, At risk, Complete or Passed**, a timeline, and a "start by" date. Download a calendar reminder.
- **Scam Shield.** Paste an advert or message to see plain-language red flags (asks for payment, PIN/OTP requests, personal-email recruiters, unrealistic pay, pressure).
- **Hustle-to-CV.** Describe informal work in your own words and get CV-ready skills and a WhatsApp-ready pitch.
- **Learn.** Short guides for common paperwork (certified ID, proof of residence, matric certificate, CV, motivation letter, tax number) and downloadable low-data lessons.
- **Passport.** A proof-of-work log, a WhatsApp work profile and a reference request message.
- **Gigs, Build a business, Money.** A simple gig board, business starter checklist, pricing helper, quote maker, daily takings tracker, budget and cost-to-apply calculators.
- **Help & Safety, Community.** Verified helplines, a private mood check-in, a document wallet, and moderated community and mentor concepts (demo).
- **No-data channel.** A USSD/WhatsApp simulator showing how users without smartphones could be reached. This is a concept demo, not a live service.
- **For organisations.** Business model and an anonymised group-gap dashboard concept for colleges and youth centres.
- **11 official languages (plus SA Sign Language placeholder).** Interface text is translated once with Gemini and cached. Translations are machine-generated until reviewed by fluent speakers.
- **Accounts (optional).** Sign up, sign in, email link or password reset. Guests can use the app with data kept on their own device.
- **Admin tools.** Admins publish verified opportunities (with the official link and a "last checked" date) and review translations.

## How the "intelligence" works
The readiness logic is **transparent, rule-based code** (keyword and pattern matching plus a deadline calculation). No machine-learning model is trained, and no user data is used for training. **Gemini is used only to translate fixed interface text**, through a server-side function. User-entered content (plans, proof, notes) is never sent to Gemini. Estimates are typical figures, not guarantees.

## Tech stack
| Part | Technology |
|---|---|
| Front end | HTML, CSS and vanilla JavaScript in a single `index.html` (no build step) |
| Accounts and data | Supabase Auth and Postgres, with Row Level Security so each user can read only their own data |
| Server function | Supabase Edge Function (`translate`) calling the Gemini API |
| Hosting | Vercel, with security headers in `vercel.json` |
| Email | Supabase Auth emails, optionally through your own SMTP provider |

## Project structure
```
index.html                         the whole app
vercel.json                        security headers (CSP and others)
supabase-all.sql                   database setup (run once in the Supabase SQL Editor)
supabase/functions/translate/      Edge Function + catalog.json (fixed interface strings)
docs/                              setup guide, pitch outline, testing checklist (optional)
manifest.json, sw.js, icon.svg     PWA files (install and offline; not enabled yet)
```

## Getting started
1. **Create a Supabase project.** In the SQL Editor, run `supabase-all.sql`.
2. **Add your keys to `index.html`.** Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` near the top of the script with your Project URL and **anon/public** key. The anon key is public by design; security comes from Row Level Security. **Never** use the `service_role` key in the front end or commit it.
3. **Fill in the `ORG` details** in `index.html` (team name, address, Information Officer, email, data region). They appear in the privacy notice.
4. **Translations (optional).**
   ```
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set GEMINI_API_KEY=your-key      # secret on the server, never in a file
   supabase functions deploy translate
   ```
5. **Deploy.** Push to GitHub, import the repo in Vercel (framework: Other, no build command), then in Supabase go to Authentication, URL Configuration and set the Site URL and Redirect URLs to your live address.
6. **Make yourself an admin.** Create an account, copy your user id from Supabase Authentication, then run:
   `insert into public.admins (user_id) values ('YOUR-USER-ID');`

Local testing: serve the folder (for example `python3 -m http.server 8000`) and open `http://localhost:8000`. Add that address to the Supabase Redirect URLs.

## Adding real opportunities
Sign in as an admin and use **Admin: listings**. Only publish adverts you have checked on the employer's or provider's official page, and always add the official https link. Each listing shows a "Checked [date]" label. Do not copy sites in bulk without permission.

## Privacy and security
**Built in**
- Per-user data protection with Row Level Security; admins identified through a separate table.
- No ID numbers, bank details or file uploads collected; warnings next to free-text fields.
- Passwords are handled and hashed by Supabase Auth; the app never stores them.
- Sensitive local-only data (mood check-ins, daily takings, interview feedback) is never synced to the server.
- Sign out clears data from the device; export and delete-my-account controls.
- All user text is escaped; CSV export guards against formula injection.
- Security headers including a Content Security Policy.
- A POPIA-oriented privacy notice with consent and an under-18 guardian tick-box.

**Planned or to configure**
- CAPTCHA and rate limits in Supabase, two-step sign-in, an audit log, a breach-response plan, and an independent security test.
- Have the privacy notice reviewed by a qualified legal adviser before launch.

## Accessibility and low data
Mobile-first layout, large tap targets, labelled form fields, aria-live messages, a Low data mode, and offline-friendly design (service worker included but not yet enabled).

## Limitations
- Everything users enter is self-declared and not verified by NextStep SA.
- Document timings are typical estimates, not guarantees.
- Scam Shield is keyword-based guidance. It can miss scams or flag safe messages.
- Helpline numbers were checked on 8 November 2026. Confirm them before relying on them.
- Machine translations need review, especially for Tshivenda, Xitsonga, siSwati and isiNdebele.
- Nothing here is legal or financial advice.

## Roadmap
Real, regularly checked listings; SMS and WhatsApp reminders; USSD with a telecom partner; zero-rated access; helper mode for libraries and youth centres; employer portal; pilot with a youth centre or TVET college.

## Team
[Add names, roles and skills.]

## License
[Choose a license, for example MIT, and add a `LICENSE` file.]

## Contact
[Add a contact email.]
