#!/usr/bin/env python3
"""
Simple test script to debug the ADK backend
"""
import requests
import json

def test_backend():
    base_url = "http://localhost:8000"
    
    print("🔍 Testing ADK Backend Connection...")
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"✅ Server is running - Status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Server not accessible: {e}")
        return
    
    # Test 2: Create a session
    print("\n📝 Creating session...")
    try:
        session_payload = {}
        response = requests.post(
            f"{base_url}/apps/chat/users/user1/sessions",
            json=session_payload,
            timeout=10
        )
        print(f"Session creation - Status: {response.status_code}")
        if response.status_code == 200:
            session_data = response.json()
            print(f"Session ID: {session_data.get('id', 'Unknown')}")
            session_id = session_data.get('id')
        else:
            print(f"Session creation failed: {response.text}")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ Session creation failed: {e}")
        return
    
    # Test 3: Send a simple message
    print("\n💬 Sending test message...")
    try:
        message_payload = {
            "app_name": "chat",
            "user_id": "user1", 
            "session_id": session_id,
            "new_message": {
                "role": "user",
                "parts": [{"text": "Hello, can you respond?"}]
            }
        }
        
        print(f"Sending payload: {json.dumps(message_payload, indent=2)}")
        
        response = requests.post(
            f"{base_url}/run",
            json=message_payload,
            timeout=30
        )
        
        print(f"Message response - Status: {response.status_code}")
        
        if response.status_code == 200:
            events = response.json()
            print(f"✅ Received {len(events)} events")
            
            for i, event in enumerate(events):
                print(f"Event {i+1}: {event.get('type', 'unknown')} - {event}")
                
            # Look for content
            content_events = [e for e in events if e.get('type') == 'content']
            if content_events:
                content = content_events[0].get('data', {}).get('parts', [{}])[0].get('text', '')
                print(f"🤖 AI Response: {content}")
            else:
                print("❌ No content in response")
        else:
            print(f"❌ Message failed: {response.status_code} - {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Message request failed: {e}")

if __name__ == "__main__":
    test_backend()