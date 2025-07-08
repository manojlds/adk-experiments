#!/usr/bin/env python3

import requests
import json
import sqlite3
import time

def check_database_state(description):
    """Check and display the current state of the SQLite database"""
    print(f"\n=== Database State: {description} ===")
    
    conn = sqlite3.connect('adk_sessions.db')
    cursor = conn.cursor()
    
    # Check sessions
    cursor.execute("SELECT COUNT(*) FROM sessions")
    session_count = cursor.fetchone()[0]
    print(f"Sessions count: {session_count}")
    
    # Check events
    cursor.execute("SELECT COUNT(*) FROM events")
    event_count = cursor.fetchone()[0]
    print(f"Events count: {event_count}")
    
    if session_count > 0:
        print("Sessions:")
        cursor.execute("SELECT app_name, user_id, id, create_time, update_time FROM sessions LIMIT 3")
        for row in cursor.fetchall():
            print(f"  {row}")
    
    if event_count > 0:
        print("Recent Events:")
        cursor.execute("SELECT id, author, timestamp, turn_complete, long_running_tool_ids_json FROM events ORDER BY timestamp DESC LIMIT 3")
        for row in cursor.fetchall():
            print(f"  {row}")
    
    conn.close()

def test_session_service():
    """Test if the session service is using SQLite"""
    print("🔍 Testing SQLite Session Service Integration")
    print("=" * 50)
    
    # Clear database
    print("🗑️  Clearing database...")
    conn = sqlite3.connect('adk_sessions.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events")
    cursor.execute("DELETE FROM sessions")
    conn.commit()
    conn.close()
    
    check_database_state("Initial (empty)")
    
    # Create a session
    print("\n📝 Creating session...")
    session_response = requests.post(
        "http://localhost:8000/apps/chat/users/test-user/sessions",
        headers={"Content-Type": "application/json"},
        json={}
    )
    
    if session_response.status_code != 200:
        print(f"❌ Failed to create session: {session_response.status_code}")
        print(session_response.text)
        return
    
    session_data = session_response.json()
    session_id = session_data["id"]
    print(f"✅ Session created: {session_id}")
    
    # Check database after session creation
    check_database_state("After session creation")
    
    # Send a message that triggers long-running tool
    print(f"\n📧 Sending email request...")
    run_response = requests.post(
        "http://localhost:8000/run",
        headers={"Content-Type": "application/json"},
        json={
            "app_name": "chat",
            "user_id": "test-user",
            "session_id": session_id,
            "new_message": {
                "role": "user",
                "parts": [{"text": "Send an email to test@example.com with subject Test and body Hello"}]
            }
        }
    )
    
    if run_response.status_code != 200:
        print(f"❌ Failed to send message: {run_response.status_code}")
        print(run_response.text)
        return
    
    run_data = run_response.json()
    print(f"✅ Message sent, response has {len(run_data)} parts")
    
    # Check for long-running tool
    long_running_ids = run_data[0].get("longRunningToolIds", [])
    print(f"Long-running tool IDs: {long_running_ids}")
    
    # Check database after agent pause
    check_database_state("After agent pauses for approval")
    
    # Check for paused events
    conn = sqlite3.connect('adk_sessions.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM events WHERE long_running_tool_ids_json IS NOT NULL AND long_running_tool_ids_json != '[]' AND turn_complete = 0")
    paused_count = cursor.fetchone()[0]
    print(f"Events with paused long-running tools: {paused_count}")
    conn.close()
    
    print("\n🎯 CONCLUSION:")
    if paused_count > 0:
        print("✅ SQLite session service is working correctly!")
        print("✅ Long-running tool states are being persisted in SQLite")
    else:
        print("❌ SQLite session service is NOT being used")
        print("❌ Data is being stored in default in-memory session service")
        print("💡 The backend configuration may not be taking effect")

if __name__ == "__main__":
    test_session_service()