# Chat Application with Google ADK

This repository contains a minimal chat application using the [Google ADK](https://github.com/google-gemini/agents) framework for the backend and a Next.js frontend.

## Backend

* **Framework:** FastAPI via Google ADK
* **Entry point:** `backend.py`
* **Agents directory:** `agents`
* **Python version:** see `.python-version`

Create a virtual environment with `uv` and install dependencies:

```bash
uv venv
uv pip install --system google-adk fastapi "uvicorn[standard]"
```

Run the server:

```bash
uvicorn backend:app --reload
```

The API follows the ADK FastAPI server conventions.

## Frontend

The frontend is under `frontend/` and was bootstrapped with `create-next-app`.

Start the development server:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` to use the chat interface.
