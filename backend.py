from google.adk.cli.fast_api import get_fast_api_app
from dotenv import load_dotenv

load_dotenv()

# Use SQLite-based session service via URI
db_url = "sqlite:///./adk_sessions.db"

# Configure ADK with SQLite session service
app = get_fast_api_app(
    agents_dir="agents",
    session_service_uri=db_url,
    web=True,
    allow_origins=["http://localhost:3000"]
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
