from google.adk.cli.fast_api import get_fast_api_app
from dotenv import load_dotenv
import logging
from long_running_logger import LongRunningToolLogger

load_dotenv()

# Setup long-running tool logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

# Create logger instance
tool_logger = LongRunningToolLogger("ADK_LONG_RUNNING_TOOLS")

# Use the basic configuration - ADK will handle session management automatically
app = get_fast_api_app(
    agents_dir="agents",
    web=True,
    allow_origins=["http://localhost:3000"]
)

# Add event logging middleware
@app.middleware("http")
async def log_long_running_tools(request, call_next):
    """Middleware to log long-running tool events"""
    response = await call_next(request)
    
    # Add custom header to indicate if agent is paused
    if hasattr(request, 'state') and hasattr(request.state, 'events'):
        for event in request.state.events:
            tool_logger.log_event(event)
    
    response.headers["X-Agent-Status"] = "PAUSED" if tool_logger.is_agent_paused() else "ACTIVE"
    response.headers["X-Pending-Tools"] = str(len(tool_logger.pending_tools))
    
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)