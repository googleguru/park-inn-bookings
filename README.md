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
- No paid services, databases or API keys. Step-by-step setup: open `/#/setup` on the website.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager

### Installation

```sh
git clone <YOUR_GIT_URL>
cd park-inn-bookings
npm install
```

### Development

Run the website against a local simulation of the Google backend:

```sh
OWNER_EMAIL=you@example.com node google-apps-script/dev/server.cjs 8787   # simulated Sheet/Calendar/Gmail
curl -X POST localhost:8787/dev/seed                                        # optional demo data
VITE_BOOKING_API_URL=http://localhost:8787/exec npm run dev
```

Sign-in codes appear at `http://localhost:8787/dev/outbox`.

### Tests

```sh
npm run test:backend   # runs Code.gs against simulated Google services
```

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

Supported deployment options:

- **Vercel** - Recommended for best performance
- **Netlify**
- **GitHub Pages**
- **Traditional hosting** - Any hosting that supports Node.js

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is private and proprietary to Dhanlakshmi Park Inn.
