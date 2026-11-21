# Dhanlakshmi Park Inn - Event Booking Website

A modern event venue booking platform for Dhanlakshmi Park Inn, allowing customers to browse availability, check pricing, and book their special events online.

## Features

### Customer Features
- **Interactive Booking Calendar**: See available, requested and booked dates
- **Email-code sign-in**: Customers get a 6-digit code by email (no passwords)
- **Approval before booking**: The admin approves each customer once
- **My bookings**: Customers see and cancel their pending requests

### Admin Features (`/admin`)
- **Dashboard**: Upcoming events, requests waiting, monthly income, expenses and profit, top event types and customers
- **Bookings**: Confirm/reject requests, add phone bookings, record payments, lock/unlock confirmed bookings
- **Customers**: Approve, reject or block customers
- **Income & Expenses**: Booking payments, catering commissions, electricity (current) bills, cleaning bills and other costs
- **Activity**: Every sign-in and change
- **Settings**: Open/close online booking, notification email, admins, import old bookings

### How data is stored (free, in the admin's own Google account)
- A **Google Apps Script** (`google-apps-script/Code.gs`) attached to a Google Sheet is the backend.
- Each table is a tab in that Sheet: Bookings, Customers, Money, Admins, Activity, Settings.
- Confirmed bookings go to a **Park Inn Bookings** Google Calendar; events added there block dates on the website.
- Sign-in codes and notifications are sent from the admin's Gmail.
- No paid services, databases or API keys. Owner installation instructions are below.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager

### Installation

```sh
git clone https://github.com/googleguru/park-inn-bookings.git
cd park-inn-bookings
npm ci
```

### Development

Run the simulator in one terminal:

```sh
DEV_OUTBOX=1 OWNER_EMAIL=you@example.com node google-apps-script/dev/server.cjs 8787
```

In a second terminal, seed optional demo bookings and start the website:

```sh
curl -X POST 127.0.0.1:8787/dev/seed                                        # optional demo data
VITE_BOOKING_API_URL=http://127.0.0.1:8787/exec npm run dev
```

Open `http://localhost:8080/park-inn-bookings/`. With demo data, sign in as `priya.sharma@example.com` to try an approved customer booking.

The simulator listens on IPv4 loopback and accepts the local frontend on port 8080. With `DEV_OUTBOX=1`, simulated sign-in emails appear at `http://127.0.0.1:8787/dev/outbox`.

### Tests

```sh
npm run test:backend   # runs Code.gs against simulated Google services
```

Pull requests also run `.github/workflows/booking-checks.yml`, which type-checks,
builds, and drives a real booking end to end in Chrome.

### Agentic security scan (optional)

`.github/workflows/strix-security.yml` runs [Strix](https://github.com/usestrix/strix) —
autonomous AI pentesting agents — against the app weekly and on demand
(**Actions -> Strix security scan -> Run workflow**, where you can pick the scan
mode and point it at the repository or a running URL).

It is off until you add two repository secrets under
**Settings -> Secrets and variables -> Actions**:

| Secret | Value |
| --- | --- |
| `STRIX_LLM` | model name, e.g. `openrouter/z-ai/glm-5.3` |
| `LLM_API_KEY` | API key for that provider |

Without `LLM_API_KEY` the job skips cleanly rather than failing. Scans cost LLM
tokens, so it deliberately does not run on every push, and it is non-blocking:
a finding is reported in the run summary and an artifact, and never stands
between you and a deploy.

### Building for Production

```sh
npm run build
```

## Technologies Used

- **Vite**, **React**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Motion**
- **Google Apps Script**, **Google Sheets**, **Google Calendar** - backend and storage
- **React Query** - server state
- **React Router** - client-side routing

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── lib/            # Utility functions
├── integrations/   # External service integrations
├── App.tsx         # Main application component
└── main.tsx        # Application entry point
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Deployment

This project is configured to deploy to GitHub Pages.

- **Automatic deploy**: The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and publishes the site from `main`.
- **Manual deploy**: Run `npm install` then `npm run deploy`.
- **Site URL**: `https://googleguru.github.io/park-inn-bookings/`
- **Connecting the Google backend**: add a repository variable `BOOKING_API_URL` (GitHub → Settings → Secrets and variables → Actions → Variables) set to the Apps Script web-app URL, then re-run the deploy workflow. Until it is set, the site shows "Online booking opens soon".

Supported deployment options:

- **Vercel** - Recommended for best performance
- **Netlify**
- **GitHub Pages**
- **Traditional hosting** - Any hosting that supports Node.js

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is private and proprietary to Dhanlakshmi Park Inn.


## Calendar and monthly PDF automation (version 2)

The existing Google-account backend remains in use. No paid PDF service, 3D asset subscription, or new database has been added. Google Apps Script quotas and Drive storage limits still apply; free usage is not unlimited. See https://developers.google.com/apps-script/guides/services/quotas.

### Activate in the owner's Google account

1. Open the existing bookings Sheet → Extensions → Apps Script.
2. Replace `Code.gs` with `google-apps-script/Code.gs`.
3. Run `setup` again and authorise Drive access. This preserves existing rows and the configured calendar, replaces this app's old scheduled triggers, installs 15-minute calendar sync and a daily report check around 06:00 Asia/Kolkata, and creates a private `Park Inn Monthly Reports` folder.
4. Deploy → Manage deployments → Edit → New version → Deploy. Keep the existing web-app URL. If this is a first installation, set the GitHub Actions repository variable `BOOKING_API_URL` to that URL and rerun deployment.
5. Sign in as the owner, open Settings, check automation status, and generate a test report. Review Apps Script Executions for authorisation or quota failures.

Confirmed website bookings write to the owner's dedicated Park Inn Bookings calendar immediately. Scheduled sync imports Calendar date changes and cancellations; unrelated events in that calendar block availability. It does not access all personal calendars or turn arbitrary Calendar events into customer records. Custom event time edits are not mapped to booking slots; change slots in the booking admin. Avoid editing the same booking simultaneously in Calendar and the website.

The report job creates the previous calendar month's PDF on its first daily run, retries failures on later days, and skips a month already completed. The first run also archives the previous month. Earlier historical months can be generated individually by the super admin in Settings. Reports group bookings by **event date** and financial entries by **transaction date**, both in Asia/Kolkata. All booking statuses are included; quoted amounts and received payments are separate. An empty month still produces a report. Regeneration replaces that month's PDF, with the old file moved to Drive trash only after the new file is saved. Later edits to closed months require manual regeneration.

PDFs are private to the Google account unless the owner changes Drive sharing. Admin staff cannot generate reports; public/customer endpoints do not return report content. No emails or public file-sharing permissions are created by the report job.

The refreshed interface uses a CSS 3D venue portrait, layered floating controls, dimensional cards and reduced-motion support. The image is the existing local venue asset.

GitHub deployment publishes only the frontend. It does **not** deploy or authorise the Apps Script: the Google-account steps above are required. CI runs backend regression tests, TypeScript checking and the production build before publishing.

### Google sign-in for the booking dashboard

Run setup as the owner of the booking Sheet. The owner becomes the first super admin. Other staff must be added by a super admin in Settings. In Google Cloud, configure an OAuth **Web application** client with the exact authorised redirect URI `https://googleguru.github.io/park-inn-bookings/`. Configure the consent audience for the venue accounts. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in **Apps Script → Project Settings → Script properties**. Keep the secret server-side. Deploy a new web-app version and set the existing GitHub Actions variable `BOOKING_API_URL` to its /exec URL, then redeploy Pages. Staff choose **Sign in with Google** and manage bookings within the dashboard. Google sign-in requests identity and email only. Once configured, staff email-code login is disabled. Customer sign-in is separate.
