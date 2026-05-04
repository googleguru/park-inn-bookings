# Dhanlakshmi Park Inn - Event Booking Website

A modern event venue booking platform for Dhanlakshmi Park Inn, allowing customers to browse availability, check pricing, and book their special events online.

## Features

### Customer Features
- **Interactive Booking Calendar**: View availability and book dates
- **Booking Form**: Collect customer details for events
- **Responsive Design**: Works on all devices

### Admin Features
- **Admin Dashboard** (`/admin`): View and manage all booking requests
- **Approval Workflow**: Approve or reject booking requests
- **Status Management**: Track booking status (pending, approved, rejected, booked)
- **Google Calendar Integration**: Automatically create events in Google Calendar when bookings are approved

### Technical Features
- **Real-time Database**: Supabase for data storage and real-time updates
- **Type-safe**: Full TypeScript support
- **Modern UI**: Built with shadcn/ui components
- **Edge Functions**: Serverless functions for Google Calendar integration

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager

### Installation

Clone the repository and install dependencies:

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd park-inn-bookings

# Install dependencies
npm install
```

### Development

Start the development server:

```sh
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```sh
npm run build
```

## Technologies Used

This project is built with:

- **Vite** - Fast frontend build tool and dev server
- **React** - UI library
- **TypeScript** - Static type checking
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Supabase** - Backend database and authentication
- **React Query** - Server state management
- **React Router** - Client-side routing

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

### GitHub Pages validation checklist

After each deploy, verify:

1. Repository **Settings → Pages** is configured to serve from the `gh-pages` branch (`/root`).
2. The latest **Deploy to GitHub Pages** workflow run on `main` completed successfully.
3. URL matrix:
   - Home: `https://googleguru.github.io/park-inn-bookings/`
   - Admin: `https://googleguru.github.io/park-inn-bookings/#/admin`
   - Unknown route should show app 404 page: `https://googleguru.github.io/park-inn-bookings/#/does-not-exist`

Supported deployment options:

- **Vercel** - Recommended for best performance
- **Netlify**
- **GitHub Pages**
- **Traditional hosting** - Any hosting that supports Node.js

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is private and proprietary to Dhanlakshmi Park Inn.
