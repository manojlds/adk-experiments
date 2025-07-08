#!/usr/bin/env python3
"""
Long-Running Tool Logger for ADK Agents

This module provides comprehensive logging for long-running tool pause/resume cycles.
It can be integrated into your backend to track when agents pause and resume execution.
"""

import logging
from typing import Dict, Set, Optional
from google.adk.events import Event
from datetime import datetime

class LongRunningToolLogger:
    """
    Logger that tracks long-running tool lifecycle and agent pause/resume events.
    
    Usage:
        logger = LongRunningToolLogger()
        
        # In your event processing loop:
        for event in runner.run_async(...):
            logger.log_event(event)
    """
    
    def __init__(self, logger_name: str = "LONG_RUNNING_TOOLS"):
        self.logger = logging.getLogger(logger_name)
        self.pending_tools: Dict[str, dict] = {}
        self.completed_tools: Set[str] = set()
        
    def log_event(self, event: Event) -> None:
        """Analyze and log long-running tool events"""
        
        # 1. Check for agent PAUSE (long-running tool initiated)
        if event.long_running_tool_ids:
            for tool_id in event.long_running_tool_ids:
                if tool_id not in self.pending_tools:
                    self._log_agent_pause(tool_id, event)
        
        # 2. Check for PENDING status (agent waiting for external input)
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_response:
                    self._process_function_response(part.function_response, event)
                
                if part.function_call:
                    self._process_function_call(part.function_call, event)
    
    def _log_agent_pause(self, tool_id: str, event: Event) -> None:
        """Log when agent pauses for long-running tool"""
        self.pending_tools[tool_id] = {
            'started_at': datetime.now(),
            'event_id': event.id,
            'author': event.author
        }
        
        self.logger.info(
            f"🔄 AGENT PAUSED | Tool: {tool_id} | Event: {event.id} | "
            f"Time: {datetime.now().strftime('%H:%M:%S')}"
        )
    
    def _process_function_response(self, func_response, event: Event) -> None:
        """Process function responses for pause/resume detection"""
        response_id = func_response.id
        
        if response_id in self.pending_tools:
            response_data = func_response.response
            status = response_data.get('status', 'unknown')
            
            if status == 'pending':
                self.logger.info(
                    f"⏸️  AGENT WAITING | Tool: {response_id} | Status: {status} | "
                    f"Action: {response_data.get('action', 'unknown')} | "
                    f"Time: {datetime.now().strftime('%H:%M:%S')}"
                )
            
            elif status in ['approved', 'rejected']:
                start_time = self.pending_tools[response_id]['started_at']
                duration = datetime.now() - start_time
                
                self.pending_tools.pop(response_id, None)
                self.completed_tools.add(response_id)
                
                self.logger.info(
                    f"▶️  AGENT RESUMED | Tool: {response_id} | Status: {status} | "
                    f"Duration: {duration.total_seconds():.2f}s | "
                    f"Time: {datetime.now().strftime('%H:%M:%S')}"
                )
    
    def _process_function_call(self, func_call, event: Event) -> None:
        """Process function calls to detect agent execution"""
        if func_call.name != 'request_human_approval':
            self.logger.info(
                f"🚀 AGENT EXECUTING | Function: {func_call.name} | "
                f"ID: {func_call.id} | Time: {datetime.now().strftime('%H:%M:%S')}"
            )
    
    def get_status(self) -> dict:
        """Get current status of long-running tools"""
        return {
            'pending_count': len(self.pending_tools),
            'completed_count': len(self.completed_tools),
            'pending_tools': list(self.pending_tools.keys()),
            'agent_status': 'PAUSED' if self.pending_tools else 'ACTIVE'
        }
    
    def is_agent_paused(self) -> bool:
        """Check if agent is currently paused waiting for approval"""
        return len(self.pending_tools) > 0

# Global logger instance for easy integration
tool_logger = LongRunningToolLogger()

def setup_long_running_logging(level: int = logging.INFO) -> LongRunningToolLogger:
    """
    Setup long-running tool logging with proper configuration.
    
    Args:
        level: Logging level (default: INFO)
    
    Returns:
        Configured logger instance
    """
    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    return tool_logger

# Example integration
if __name__ == "__main__":
    import asyncio
    from google.adk.sessions import InMemorySessionService
    from google.adk.runners import Runner
    from google.genai import types
    from agents.chat.agent import root_agent
    
    async def demo():
        print("🔍 Long-Running Tool Logger Demo")
        print("=" * 40)
        
        # Setup logging
        logger = setup_long_running_logging()
        
        # Setup ADK
        session_service = InMemorySessionService()
        runner = Runner(agent=root_agent, app_name="chat", session_service=session_service)
        session = await session_service.create_session(app_name="chat", user_id="user1")
        
        # Send message requiring approval
        message = types.Content(
            role='user',
            parts=[types.Part(text="Send an email to demo@example.com with subject Demo")]
        )
        
        print("\n📧 Sending request that requires approval...")
        
        function_call_id = None
        async for event in runner.run_async(user_id="user1", session_id=session.id, new_message=message):
            logger.log_event(event)  # 🔥 This is where the magic happens!
            
            if event.long_running_tool_ids:
                function_call_id = list(event.long_running_tool_ids)[0]
        
        print(f"\n📊 Current status: {logger.get_status()}")
        print(f"🔍 Agent paused: {logger.is_agent_paused()}")
        
        if function_call_id:
            print(f"\n✅ Approving tool: {function_call_id}")
            
            approval = types.Content(
                role='user',
                parts=[types.Part(function_response=types.FunctionResponse(
                    id=function_call_id,
                    name='request_human_approval',
                    response={'status': 'approved', 'action': 'send_email'}
                ))]
            )
            
            async for event in runner.run_async(user_id="user1", session_id=session.id, new_message=approval):
                logger.log_event(event)  # 🔥 Logs resume + execution!
        
        print(f"\n📊 Final status: {logger.get_status()}")
        print(f"🔍 Agent paused: {logger.is_agent_paused()}")
    
    asyncio.run(demo())