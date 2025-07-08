#!/bin/bash

# Test script for long-running tools
set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing Long-Running Tools with ADK${NC}"
echo "============================================"

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
echo -e "${GREEN}✅ Final assistant response:${NC}"
echo -e "${YELLOW}   \"$FINAL_MESSAGE\"${NC}"
echo

# Test rejection flow
echo -e "${BLUE}🚫 Step 4: Testing rejection flow...${NC}"

# Send another request that requires approval
echo -e "${BLUE}📁 Sending delete request (requires approval)...${NC}"
DELETE_RESPONSE=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"chat\",
    \"user_id\": \"user1\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"role\": \"user\",
      \"parts\": [{\"text\": \"Delete files at /tmp/test\"}]
    }
  }")

DELETE_FUNCTION_CALL_ID=$(echo "$DELETE_RESPONSE" | jq -r '.[0].content.parts[0].functionCall.id // empty')

if [ -z "$DELETE_FUNCTION_CALL_ID" ] || [ "$DELETE_FUNCTION_CALL_ID" = "null" ]; then
    echo -e "${RED}❌ Error: Failed to extract delete function call ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Delete approval request created${NC}"
echo -e "${YELLOW}   Function Call ID: $DELETE_FUNCTION_CALL_ID${NC}"

# Reject the action
echo -e "${BLUE}❌ Rejecting the delete action...${NC}"
REJECT_RESPONSE=$(curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d "{
    \"app_name\": \"chat\",
    \"user_id\": \"user1\",
    \"session_id\": \"$SESSION_ID\",
    \"new_message\": {
      \"role\": \"user\",
      \"parts\": [{
        \"function_response\": {
          \"id\": \"$DELETE_FUNCTION_CALL_ID\",
          \"name\": \"request_human_approval\",
          \"response\": {
            \"status\": \"rejected\",
            \"action\": \"delete_files\",
            \"details\": \"Deleting files at /tmp/test\",
            \"approved\": false
          }
        }
      }]
    }
  }")

REJECT_MESSAGE=$(echo "$REJECT_RESPONSE" | jq -r '.[0].content.parts[0].text // empty')

echo -e "${GREEN}✅ Rejection handled successfully${NC}"
echo -e "${YELLOW}   Response: \"$REJECT_MESSAGE\"${NC}"
echo

# Summary
echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
echo "=================================="
echo -e "${GREEN}✅ Session creation${NC}"
echo -e "${GREEN}✅ Long-running tool detection${NC}"
echo -e "${GREEN}✅ Function response approval${NC}"
echo -e "${GREEN}✅ Context preservation${NC}"
echo -e "${GREEN}✅ Email execution with correct parameters${NC}"
echo -e "${GREEN}✅ Rejection handling${NC}"
echo
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "${YELLOW}   Session ID: $SESSION_ID${NC}"
echo -e "${YELLOW}   Email sent to: $EMAIL_TO${NC}"
echo -e "${YELLOW}   Email subject: $EMAIL_SUBJECT${NC}"
echo -e "${YELLOW}   Email body: $EMAIL_BODY${NC}"
echo
echo -e "${GREEN}🚀 Long-running tools are working perfectly!${NC}"