#!/bin/bash

# Test script to monitor database state during long-running tool workflow

set -e

echo "=== Starting Database State Test ==="
echo "$(date): Starting test workflow"

# Function to check database state
check_db_state() {
    echo "--- Database State Check: $1 ---"
    echo "Sessions count: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM sessions;')"
    echo "Events count: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM events;')"
    
    # Show sessions if any exist
    session_count=$(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM sessions;')
    if [ "$session_count" -gt 0 ]; then
        echo "Sessions:"
        sqlite3 adk_sessions.db -header -column "SELECT app_name, user_id, id, create_time, update_time FROM sessions;"
    fi
    
    # Show recent events if any exist
    event_count=$(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM events;')
    if [ "$event_count" -gt 0 ]; then
        echo "Recent Events:"
        sqlite3 adk_sessions.db -header -column "SELECT id, author, timestamp, turn_complete, long_running_tool_ids_json, partial FROM events ORDER BY timestamp DESC LIMIT 3;"
    fi
    echo ""
}

# Clear any existing data
echo "Clearing existing database data..."
sqlite3 adk_sessions.db "DELETE FROM events;"
sqlite3 adk_sessions.db "DELETE FROM sessions;"

# Initial state check
check_db_state "Initial (empty)"

# Step 1: Create a new session
echo "=== Step 1: Creating new session ==="
session_response=$(curl -s -X POST http://localhost:8000/apps/chat/users/test-user/sessions \
  -H "Content-Type: application/json" \
  -d '{}')

session_id=$(echo "$session_response" | jq -r '.id')
echo "Created session ID: $session_id"

# Step 2: Trigger long-running tool
echo "=== Step 2: Triggering long-running tool ==="
response=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"appName\": \"chat\",
    \"userId\": \"test-user\",
    \"sessionId\": \"$session_id\",
    \"newMessage\": {
      \"parts\": [
        {
          \"text\": \"I need you to send an email to john@example.com with subject 'Test Email' and body 'This is a test email from our system.' Please use the send_email tool to do this.\"
        }
      ]
    }
  }")

echo "Response received"
echo "$response" | jq '.'

echo "Using session ID: $session_id"

# Check database state after agent pauses
sleep 2
check_db_state "After agent pauses for approval"

# Step 2: Check for paused state in database
echo "=== Step 2: Checking for paused long-running tool state ==="
paused_events=$(sqlite3 adk_sessions.db "SELECT COUNT(*) FROM events WHERE long_running_tool_ids_json IS NOT NULL AND long_running_tool_ids_json != '[]' AND turn_complete = 0;")
echo "Events with paused long-running tools: $paused_events"

if [ "$paused_events" -gt 0 ]; then
    echo "Paused tool details:"
    sqlite3 adk_sessions.db -header -column "SELECT id, long_running_tool_ids_json, turn_complete FROM events WHERE long_running_tool_ids_json IS NOT NULL AND long_running_tool_ids_json != '[]';"
fi

# Step 3: Approve the tool call
echo "=== Step 3: Approving the tool call ==="
approval_response=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"appName\": \"chat\",
    \"userId\": \"test-user\",
    \"sessionId\": \"$session_id\",
    \"newMessage\": {
      \"parts\": [
        {
          \"text\": \"approve\"
        }
      ]
    }
  }")

echo "Approval response:"
echo "$approval_response" | jq '.'

# Check database state after approval
sleep 2
check_db_state "After approval and completion"

# Step 4: Check final state
echo "=== Step 4: Final state analysis ==="
completed_events=$(sqlite3 adk_sessions.db "SELECT COUNT(*) FROM events WHERE turn_complete = 1;")
echo "Completed events: $completed_events"

echo "Final event details:"
sqlite3 adk_sessions.db -header -column "SELECT id, author, turn_complete, long_running_tool_ids_json, partial FROM events ORDER BY timestamp DESC LIMIT 5;"

echo "=== Test Complete ==="
echo "$(date): Test workflow finished"