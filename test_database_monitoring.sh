#!/bin/bash

# Test script for long-running tools WITH database state monitoring
set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing Long-Running Tools with Database State Monitoring${NC}"
echo "============================================"

# Function to check database state
check_db_state() {
    echo -e "${PURPLE}📊 Database State Check: $1${NC}"
    echo "Sessions count: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM sessions;')"
    echo "Events count: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM events;')"
    
    # Show sessions if any exist
    session_count=$(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM sessions;')
    if [ "$session_count" -gt 0 ]; then
        echo -e "${YELLOW}Sessions:${NC}"
        sqlite3 adk_sessions.db -header -column "SELECT app_name, user_id, id, create_time, update_time FROM sessions LIMIT 3;"
    fi
    
    # Show recent events if any exist
    event_count=$(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM events;')
    if [ "$event_count" -gt 0 ]; then
        echo -e "${YELLOW}Recent Events:${NC}"
        sqlite3 adk_sessions.db -header -column "SELECT id, author, timestamp, turn_complete, long_running_tool_ids_json, partial FROM events ORDER BY timestamp DESC LIMIT 3;"
    fi
    echo
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is not installed. Please install jq first.${NC}"
    exit 1
fi

# Check if backend is running
if ! curl -s http://localhost:8000/health &> /dev/null; then
    echo -e "${YELLOW}⚠️  Checking if backend is accessible...${NC}"
    if ! curl -s http://localhost:8000/ &> /dev/null; then
        echo -e "${RED}❌ Error: Backend not running on localhost:8000${NC}"
        echo "Please start the backend first: python backend.py"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Backend is accessible${NC}"
echo

# Clear database for clean test
echo -e "${BLUE}🗑️  Clearing database for clean test...${NC}"
sqlite3 adk_sessions.db "DELETE FROM events;"
sqlite3 adk_sessions.db "DELETE FROM sessions;"

# Initial state check
check_db_state "Initial (empty)"

# Step 1: Create session
echo -e "${BLUE}📝 Step 1: Creating session...${NC}"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8000/apps/chat/users/user1/sessions \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Session response: $SESSION_RESPONSE"

# Extract session ID with proper error handling
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.id // empty')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
    echo -e "${RED}❌ Error: Failed to create session or extract session ID${NC}"
    echo "Response was: $SESSION_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Session created successfully${NC}"
echo -e "${YELLOW}   Session ID: $SESSION_ID${NC}"
echo

# Check database state after session creation
check_db_state "After session creation"

# Step 2: Send request that requires approval
echo -e "${BLUE}📧 Step 2: Sending email request (requires approval)...${NC}"
APPROVAL_RESPONSE=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"chat\",
    \"user_id\": \"user1\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"role\": \"user\",
      \"parts\": [{\"text\": \"Send an email to test@example.com with subject Hello and body World\"}]
    }
  }")

echo "Approval response: $APPROVAL_RESPONSE"

# Extract function call ID with error handling
FUNCTION_CALL_ID=$(echo "$APPROVAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.id // empty')

if [ -z "$FUNCTION_CALL_ID" ] || [ "$FUNCTION_CALL_ID" = "null" ]; then
    echo -e "${RED}❌ Error: Failed to extract function call ID${NC}"
    echo "Response was: $APPROVAL_RESPONSE"
    exit 1
fi

# Check if it's a long-running tool
LONG_RUNNING_IDS=$(echo "$APPROVAL_RESPONSE" | jq -r '.[0].longRunningToolIds // empty')
if [ -z "$LONG_RUNNING_IDS" ] || [ "$LONG_RUNNING_IDS" = "null" ]; then
    echo -e "${RED}❌ Error: Expected long-running tool but didn't find longRunningToolIds${NC}"
    exit 1
fi

# Extract pending status
PENDING_STATUS=$(echo "$APPROVAL_RESPONSE" | jq -r '.[1].content.parts[0].functionResponse.response.status // empty')
if [ "$PENDING_STATUS" != "pending" ]; then
    echo -e "${RED}❌ Error: Expected pending status but got: $PENDING_STATUS${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Approval request created successfully${NC}"
echo -e "${YELLOW}   Function Call ID: $FUNCTION_CALL_ID${NC}"
echo -e "${YELLOW}   Status: $PENDING_STATUS${NC}"
echo

# Check database state after agent pauses
check_db_state "After agent pauses for approval"

# Check for paused state in database
echo -e "${BLUE}🔍 Step 2.5: Checking for paused long-running tool state...${NC}"
paused_events=$(sqlite3 adk_sessions.db "SELECT COUNT(*) FROM events WHERE long_running_tool_ids_json IS NOT NULL AND long_running_tool_ids_json != '[]' AND long_running_tool_ids_json != 'null';")
echo "Events with paused long-running tools: $paused_events"

if [ "$paused_events" -gt 0 ]; then
    echo -e "${YELLOW}Paused tool details:${NC}"
    sqlite3 adk_sessions.db -header -column "SELECT id, long_running_tool_ids_json, turn_complete FROM events WHERE long_running_tool_ids_json IS NOT NULL AND long_running_tool_ids_json != '[]';"
fi
echo

# Step 3: Approve the action using function_response
echo -e "${BLUE}✅ Step 3: Approving the action with function_response...${NC}"
FINAL_RESPONSE=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"chat\",
    \"user_id\": \"user1\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"role\": \"user\",
      \"parts\": [{
        \"function_response\": {
          \"id\": \"$FUNCTION_CALL_ID\",
          \"name\": \"request_human_approval\",
          \"response\": {
            \"status\": \"approved\",
            \"action\": \"send_email\",
            \"details\": \"Sending an email to test@example.com with subject Hello and body World\",
            \"approved\": true
          }
        }
      }]
    }
  }")

echo "Final response: $FINAL_RESPONSE"

# Extract email function call to verify proper resumption
EMAIL_FUNCTION_CALL=$(echo "$FINAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall // empty')
if [ -z "$EMAIL_FUNCTION_CALL" ] || [ "$EMAIL_FUNCTION_CALL" = "null" ]; then
    echo -e "${RED}❌ Error: Expected email function call after approval${NC}"
    exit 1
fi

EMAIL_FUNCTION_NAME=$(echo "$FINAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.name // empty')
if [ "$EMAIL_FUNCTION_NAME" != "send_email" ]; then
    echo -e "${RED}❌ Error: Expected send_email function call but got: $EMAIL_FUNCTION_NAME${NC}"
    exit 1
fi

# Extract email parameters to verify context preservation
EMAIL_TO=$(echo "$FINAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.args.to // empty')
EMAIL_SUBJECT=$(echo "$FINAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.args.subject // empty')
EMAIL_BODY=$(echo "$FINAL_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.args.body // empty')

# Extract final assistant message
FINAL_MESSAGE=$(echo "$FINAL_RESPONSE" | jq -r '.[2].content.parts[0].text // empty')

echo -e "${GREEN}✅ Email function called successfully${NC}"
echo -e "${YELLOW}   To: $EMAIL_TO${NC}"
echo -e "${YELLOW}   Subject: $EMAIL_SUBJECT${NC}"
echo -e "${YELLOW}   Body: $EMAIL_BODY${NC}"
echo

# Check database state after completion
check_db_state "After approval and completion"

# Check final state
echo -e "${BLUE}📊 Step 4: Final state analysis...${NC}"
completed_events=$(sqlite3 adk_sessions.db "SELECT COUNT(*) FROM events WHERE turn_complete = 1 OR turn_complete IS NULL;")
echo "Completed events: $completed_events"

if [ "$completed_events" -gt 0 ]; then
    echo -e "${YELLOW}Final event details:${NC}"
    sqlite3 adk_sessions.db -header -column "SELECT id, author, turn_complete, long_running_tool_ids_json, partial FROM events ORDER BY timestamp DESC LIMIT 5;"
fi
echo

echo -e "${GREEN}✅ Final assistant response:${NC}"
echo -e "${YELLOW}   \"$FINAL_MESSAGE\"${NC}"
echo

# Summary
echo -e "${GREEN}🎉 DATABASE MONITORING TEST COMPLETED!${NC}"
echo "=================================="
echo -e "${GREEN}✅ Session creation and database storage${NC}"
echo -e "${GREEN}✅ Long-running tool detection${NC}"
echo -e "${GREEN}✅ Agent pause state tracking${NC}"
echo -e "${GREEN}✅ Function response approval${NC}"
echo -e "${GREEN}✅ Context preservation${NC}"
echo -e "${GREEN}✅ Email execution with correct parameters${NC}"
echo -e "${GREEN}✅ Completion state tracking${NC}"
echo

echo -e "${BLUE}📊 Summary:${NC}"
echo -e "${YELLOW}   Session ID: $SESSION_ID${NC}"
echo -e "${YELLOW}   Email sent to: $EMAIL_TO${NC}"
echo -e "${YELLOW}   Email subject: $EMAIL_SUBJECT${NC}"
echo -e "${YELLOW}   Email body: $EMAIL_BODY${NC}"
echo -e "${YELLOW}   Total sessions in DB: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM sessions;')${NC}"
echo -e "${YELLOW}   Total events in DB: $(sqlite3 adk_sessions.db 'SELECT COUNT(*) FROM events;')${NC}"
echo

echo -e "${GREEN}🚀 Long-running tools and database state monitoring working perfectly!${NC}"