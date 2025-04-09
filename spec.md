# Fotis POC spec

---

# 📸 Media Viewer POC Spec

## 🧩 Overview

POC for a Google Photos-style media viewer app that reads from local filesystem or remote SFTP, generates low-quality thumbnails, and presents them in a clean, scrollable UI. Includes an admin view for managing sources.

---

## ⚙️ Stack

### Backend (Node.js)

- **Framework**: Express.js
- **Database**: MongoDB (native driver only)
- **Thumbnailing**:
    - Images: `sharp`
    - Videos: `ffmpeg`
- **SFTP**: `ssh2-sftp-client`
- **Env Management**: `dotenv`

### Frontend (Next.js)

- **Styling**: Tailwind CSS
- **Image Loading**: Next Image + custom thumb loader
- **State Management**: None or lightweight context/hooks

---

## 📦 Backend Structure

```
backend/
├── index.js
├── routes/
│   └── media.js
├── services/
│   ├── indexer.js
│   ├── sftp.js
│   └── thumbnails.js
├── utils/
│   └── fileUtils.js
├── cache/              # For thumbnails
└── .env

```

### Key Backend Routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/media` | Get indexed media (pagination, filter by date) |
| POST | `/admin/index` | Trigger indexing job |
| POST | `/admin/sources` | Add local/SFTP source |
| GET | `/admin/sources` | List all sources |
| GET | `/admin/stats` | Get indexing status per source |
| GET | `/thumb/:hash` | Serve thumbnail image |

### `/media` Route Specification

**Purpose**: Feed infinite scroll media grid. Also supports filtering by year and month.

**Method**: `GET`

**Query Params**:

- `offset` (number): how many items to skip
- `limit` (number): how many items to return (default: 50, max: 100)
- `year` (number, optional): only return media from this year
- `month` (number, optional): only return media from this month (1–12, requires `year`)

**Response**:

```json
[
  {
    "_id": "...",
    "path": "/absolute/or/sftp/path.jpg",
    "hash": "thumb_hash",
    "timestamp": "2023-06-21T13:45:00.000Z",
    "type": "image" | "video"
  },
  ...
]

```

**MongoDB Indexes**:

- `timestamp`
- `sourceId`

---

## 🖼 Frontend Structure (Next.js)

```
frontend/
├── app/
│   ├── page.tsx          # `/`
│   ├── admin/
│   │   └── page.tsx      # `/admin`
│   ├── components/
│   │   ├── GalleryGrid.tsx
│   │   ├── YearSidebar.tsx
│   │   ├── PreviewModal.tsx
│   │   └── IndexStatusCard.tsx
│   └── lib/
│       ├── api.ts        # API wrapper
│       └── types.ts
├── public/
├── tailwind.config.ts
├── .env.local
└── next.config.js

```

### `/` View (User Gallery)

- Infinite scroll grid
- Sticky year sidebar (click year → filters grid, then show month selector)
- Modal: click to open image/video preview, supports cycling
- Load 10–100 items per page (viewport-based heuristics)
- Manual fallback: **"Load more"** button appears when scroll fails

### `/admin` View

- Add/edit local or SFTP source configs
- Trigger indexing for selected sources
- Show number of media files and thumb status
- Display real-time indexing progress using polling (every 10s by default)

### Frontend Guidelines

- Use functional components + hooks
- Minimal dependencies
- Keep UI modular (grid, sidebar, modal, status card)
- Use `.env.local` to configure backend API URL

---

## 🔐 ENV Files

### `.env` (backend)

```
CACHE_DIR=./cache
THUMB_WIDTH=300
THUMB_HEIGHT=300
MONGO_URI=mongodb://localhost:27017/media-viewer
POLL_INTERVAL_MS=10000
MAX_FILE_READS_PER_SECOND=10

```

### `.env.local` (frontend)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_POLL_INTERVAL=10000

```

---

## ✅ Summary

This POC provides a minimal full-stack base to:

- Load and display media from FS/SFTP.
- Generate and cache thumbnails.
- Browse images in a responsive, clean UI.
- Control sources/admin tasks in a protected view.
- Track indexing progress in real time.
- Throttle indexing speed to prevent hardware stress.
- Filter media by year and month.
- Support infinite scroll + load more fallback for gallery display.

Next steps: scaffold repo and stub endpoints/components.