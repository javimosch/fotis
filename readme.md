# 📸 Fotis POC - Media Viewer

## 🧩 Overview

This project is a Proof of Concept (POC) for a Google Photos-style media viewer application. It can read media files (images and videos) from the local filesystem or a remote SFTP server, generate low-resolution thumbnails, and display them in a clean, scrollable web interface. It also includes an administration section for managing media sources and monitoring indexing progress.

## ✨ Features

-   **Multiple Source Types**: Supports indexing media from local directories and SFTP servers.
-   **Thumbnail Generation**: Automatically generates thumbnails for images (`sharp`) and videos (`ffmpeg`).
-   **Web Interface**:
    -   Frontend built with Next.js and Tailwind CSS.
    -   Infinite scroll gallery grid.
    -   Filter media by year and month.
    -   Clickable thumbnails to open a larger preview modal.
-   **Backend API**:
    -   Built with Node.js and Express.js.
    -   Uses MongoDB to store media metadata and source configurations.
    -   Provides endpoints for media retrieval, source management, and indexing control.
-   **Admin View**: A dedicated page (`/admin`) to:
    -   Add, view, and manage media sources (local/SFTP).
    -   Trigger and monitor media indexing jobs.
    -   View thumbnail generation status.
-   **Command-Line Interface (CLI)**: A separate CLI tool (`backend/cli`) for interacting with the backend API, useful for testing and administration tasks.

## ⚙️ Tech Stack

-   **Backend**: Node.js, Express.js, MongoDB (native driver), Sharp, FFmpeg (requires installation), ssh2-sftp-client, dotenv
-   **Frontend**: Next.js, React, Tailwind CSS
-   **Database**: MongoDB (can be run via Docker Compose)
-   **CLI**: Node.js, Commander.js, Axios, Chalk, Ora, Conf, Inquirer

## 🚀 Getting Started

### Prerequisites

-   Node.js (check `.nvmrc` or project specifics for version)
-   npm or yarn
-   MongoDB (can be run using Docker)
-   Docker and Docker Compose (optional, for running MongoDB)
-   FFmpeg (must be installed on the system for video thumbnail generation)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd fotis-poc
    ```

2.  **Setup MongoDB:**
    -   You can use a local MongoDB installation or run it via Docker Compose:
      ```bash
      docker compose up -d mongo
      ```
    -   Ensure the MongoDB connection URI is correctly set in the backend's `.env` file.

3.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install
    ```

4.  **Configure Backend:**
    -   Create a `.env` file in the `backend` directory by copying `.env.example` (if it exists) or based on `spec.md`.
    -   Key variables: `MONGO_URI`, `CACHE_DIR`, `THUMB_WIDTH`, `THUMB_HEIGHT`.

5.  **Install Frontend Dependencies:**
    ```bash
    cd ../frontend
    npm install
    ```

6.  **Configure Frontend:**
    -   Create a `.env.local` file in the `frontend` directory.
    -   Key variable: `NEXT_PUBLIC_API_URL` (e.g., `http://localhost:3001`).

7.  **Install CLI Dependencies (Optional):**
    ```bash
    cd ../backend/cli
    npm install
    npm link # Makes 'fotis' command available globally
    ```

### Running the Application

1.  **Start the Backend Server:**
    ```bash
    cd backend
    npm start
    # Or for development with auto-reload:
    # npm run dev
    ```
    The backend should be running on the port specified in `.env` (default: 3001).

2.  **Start the Frontend Development Server:**
    ```bash
    cd frontend
    npm run dev
    ```
    The frontend should be accessible at `http://localhost:3000` (or another port if 3000 is busy).

3.  **Using the CLI (Optional):**
    -   If you linked the CLI, you can use the `fotis` command:
      ```bash
      fotis --help
      fotis admin sources list
      # etc.
      ```

## 🔧 Environment Variables

-   **Backend (`backend/.env`)**: Configure database connection, cache locations, thumbnail dimensions, etc. See `spec.md` or `backend/knowledge.md` for details.
-   **Frontend (`frontend/.env.local`)**: Configure the backend API URL (`NEXT_PUBLIC_API_URL`).

## 📁 Project Structure

```
.
├── backend/        # Node.js/Express backend server
│   ├── cli/        # Command-line interface tool
│   ├── public/     # Static assets (if any served by backend)
│   ├── routes/     # API route handlers
│   ├── services/   # Core logic (indexing, thumbnails, SFTP)
│   ├── utils/      # Utility functions
│   ├── index.js    # Backend entry point
│   ├── package.json
│   └── ...
├── frontend/       # Next.js frontend application
│   ├── src/
│   │   ├── app/    # Next.js App Router structure
│   │   └── ...
│   ├── public/     # Static assets for frontend
│   ├── package.json
│   └── ...
├── compose.yml     # Docker Compose for MongoDB
├── spec.md         # Project specification
└── readme.md       # This file
```