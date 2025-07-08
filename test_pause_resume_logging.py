#!/usr/bin/env python3

import asyncio
import logging
import sys
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from agents.chat.agent import root_agent

# Simple focused logging for pause/resume detection
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

# Custom logger for our analysis
logger = logging.getLogger('PAUSE_RESUME_TRACKER')
logger.setLevel(logging.INFO)

class LongRunningToolTracker:
    def __init__(self):
        self.pending_tools = set()
        self.completed_tools = set()
    
    def analyze_event(self, event):
        """Analyze events for pause/resume patterns"""
        
        # Check for long-running tool initiation (PAUSE)
        if event.long_running_tool_ids:
            for tool_id in event.long_running_tool_ids:
                if tool_id not in self.pending_tools:
                    self.pending_tools.add(tool_id)
                    logger.info(f"🔄 AGENT PAUSED - Long-running tool started: {tool_id}")
        
        # Check for function responses that might resume execution
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_response:
                    response_id = part.function_response.id
                    status = part.function_response.response.get('status', 'unknown')
                    
                    if response_id in self.pending_tools:
                        if status == 'pending':
                            logger.info(f"⏸️  AGENT WAITING - Tool {response_id} is pending approval")
                        elif status in ['approved', 'rejected']:
                            self.pending_tools.discard(response_id)
                            self.completed_tools.add(response_id)
                            logger.info(f"▶️  AGENT RESUMED - Tool {response_id} completed with status: {status}")
                
                # Check for regular function calls (shows agent continuing)
                if part.function_call and part.function_call.name != 'request_human_approval':
                    logger.info(f"🚀 AGENT EXECUTING - Calling {part.function_call.name}")

async def test_pause_resume():
    print("🔍 Testing Long-Running Tool Pause/Resume Detection")
    print("=" * 55)
    
    tracker = LongRunningToolTracker()
    
    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name="chat", 
        session_service=session_service
    )
    
    # Create session
    session = await session_service.create_session(
        app_name="chat",
        user_id="user1"
    )
    
    print(f"📝 Created session: {session.id}")
    
    # PHASE 1: Send message that triggers approval (should cause PAUSE)
    message = types.Content(
        role='user',
        parts=[types.Part(text="Send an email to test@example.com with subject Test and body Hello")]
    )
    
    print(f"\n📧 PHASE 1: Sending email request...")
    print("-" * 40)
    
    events = []
    function_call_id = None
    
    async for event in runner.run_async(
        user_id="user1",
        session_id=session.id,
        new_message=message
    ):
        events.append(event)
        tracker.analyze_event(event)
        
        # Capture the function call ID for later use
        if event.long_running_tool_ids:
            function_call_id = list(event.long_running_tool_ids)[0]
    
    print(f"\n✅ Phase 1 complete. Agent should be PAUSED waiting for approval.")
    print(f"📋 Captured function call ID: {function_call_id}")
    
    if not function_call_id:
        print("❌ No long-running function call found!")
        return
    
    # PHASE 2: Approve the action (should cause RESUME)
    approval_message = types.Content(
        role='user',
        parts=[types.Part(function_response=types.FunctionResponse(
            id=function_call_id,
            name='request_human_approval',
            response={
                'status': 'approved',
                'action': 'send_email',
                'approved': True
            }
        ))]
    )
    
    print(f"\n✅ PHASE 2: Sending approval to resume agent...")
    print("-" * 40)
    
    resume_events = []
    async for event in runner.run_async(
        user_id="user1", 
        session_id=session.id,
        new_message=approval_message
    ):
        resume_events.append(event)
        tracker.analyze_event(event)
    
    print(f"\n🎉 Test completed!")
    print("=" * 55)
    print(f"📊 Summary:")
    print(f"   • Total events: {len(events + resume_events)}")
    print(f"   • Completed tools: {len(tracker.completed_tools)}")
    print(f"   • Pending tools: {len(tracker.pending_tools)}")
    
    if len(tracker.completed_tools) > 0 and len(tracker.pending_tools) == 0:
        print("✅ SUCCESS: Agent properly paused and resumed!")
    else:
        print("❌ ISSUE: Pause/resume pattern not detected correctly")

if __name__ == "__main__":
    asyncio.run(test_pause_resume())