#!/usr/bin/env python3

import asyncio
import logging
import sys
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from agents.chat.agent import root_agent

# Configure comprehensive logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Enable all Google ADK related logging
loggers_to_enable = [
    'google.adk',
    'google.adk.runners',
    'google.adk.tools', 
    'google.adk.sessions',
    'google.adk.events',
    'google.adk.telemetry',
    'google',
    'opentelemetry'
]

for logger_name in loggers_to_enable:
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = True

print("🔍 Testing Long-Running Tool Logging")
print("====================================")

async def test_with_logging():
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
    
    print(f"\n📝 Created session: {session.id}")
    
    # Send message that triggers approval
    message = types.Content(
        role='user',
        parts=[types.Part(text="Send an email to test@example.com with subject Test and body Hello")]
    )
    
    print(f"\n📧 Sending message that requires approval...")
    print("=" * 50)
    
    events = []
    async for event in runner.run_async(
        user_id="user1",
        session_id=session.id,
        new_message=message
    ):
        events.append(event)
        print(f"\n🔥 EVENT: {event.author} - {event.id}")
        if event.longRunningToolIds:
            print(f"   🔄 LONG RUNNING TOOL IDS: {event.longRunningToolIds}")
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_call:
                    print(f"   📞 FUNCTION CALL: {part.function_call.name} - {part.function_call.id}")
                if part.function_response:
                    print(f"   📋 FUNCTION RESPONSE: {part.function_response.name} - Status: {part.function_response.response.get('status', 'N/A')}")
                if part.text:
                    print(f"   💬 TEXT: {part.text[:100]}...")
    
    print(f"\n🔍 Found {len(events)} events")
    
    # Find the long-running function call ID
    function_call_id = None
    for event in events:
        if event.longRunningToolIds:
            function_call_id = list(event.longRunningToolIds)[0]
            break
    
    if not function_call_id:
        print("❌ No long-running function call found!")
        return
        
    print(f"\n✅ Found long-running function call: {function_call_id}")
    
    # Now approve it
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
    
    print(f"\n✅ Sending approval...")
    print("=" * 50)
    
    resume_events = []
    async for event in runner.run_async(
        user_id="user1", 
        session_id=session.id,
        new_message=approval_message
    ):
        resume_events.append(event)
        print(f"\n🔥 RESUME EVENT: {event.author} - {event.id}")
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_call:
                    print(f"   📞 FUNCTION CALL: {part.function_call.name} - {part.function_call.id}")
                    print(f"   📧 EMAIL ARGS: {part.function_call.args}")
                if part.function_response:
                    print(f"   📋 FUNCTION RESPONSE: {part.function_response.name}")
                if part.text:
                    print(f"   💬 TEXT: {part.text[:100]}...")
    
    print(f"\n🔍 Found {len(resume_events)} resume events")
    print(f"\n🎉 Test completed! Total events: {len(events + resume_events)}")

if __name__ == "__main__":
    asyncio.run(test_with_logging())