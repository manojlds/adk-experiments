from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import LongRunningFunctionTool, FunctionTool
import uuid

def request_human_approval(action: str, details: str) -> dict:
    """
    Request human approval for an action. This creates a long-running operation
    that requires human confirmation.
    
    Args:
        action: The action requiring approval
        details: Additional details about the action
        
    Returns:
        dict: Status information for the approval request
    """
    # Generate a unique ticket ID for this approval request
    ticket_id = f"approval-{uuid.uuid4().hex[:8]}"
    
    # Return the initial status - this will pause the agent execution
    return {
        'status': 'pending',
        'action': action,
        'details': details,
        'ticket_id': ticket_id,
        'message': f'Human approval requested for: {action}. Details: {details}. Please approve or reject this request.'
    }

def send_email(to: str, subject: str, body: str) -> str:
    """
    Send an email to the specified recipient.
    
    Args:
        to: Email address of the recipient
        subject: Subject line of the email
        body: Email body content
        
    Returns:
        str: Confirmation message
    """
    # This is a dummy implementation - in real use, this would send an actual email
    print(f"🔧 DUMMY EMAIL TOOL CALLED:")
    print(f"   To: {to}")
    print(f"   Subject: {subject}")
    print(f"   Body: {body}")
    print(f"   Status: Email would be sent in production")
    return f"Email sent successfully to {to} with subject '{subject}'"

def delete_files(path: str, confirm: bool = False) -> str:
    """
    Delete files at the specified path.
    
    Args:
        path: Path to files to delete
        confirm: Confirmation flag
        
    Returns:
        str: Result of the deletion
    """
    # This is a dummy implementation - in real use, this would delete actual files
    if not confirm:
        return "File deletion requires confirmation. Please confirm to proceed."
    return f"Files at {path} have been deleted successfully"

# Create the tools
approval_tool = LongRunningFunctionTool(func=request_human_approval)
send_email_tool = FunctionTool(func=send_email)
delete_files_tool = FunctionTool(func=delete_files)

root_agent = LlmAgent(
    name="chat",
    model=LiteLlm(model="gpt-4o-mini"),
    instruction="""You are a helpful chat assistant with human-in-the-loop capabilities.

IMPORTANT: Before performing ANY action using the available tools (send_email, delete_files), you MUST:
1. First use the request_human_approval tool to get approval
2. Wait for the human to respond with approval or rejection
3. Only then proceed with the actual action if approved

Available actions that require approval:
- Sending emails (send_email tool)
- Deleting files (delete_files tool)
- Any other potentially sensitive operations

When a user asks you to send an email or delete files:
1. Immediately use request_human_approval with the action details
2. Tell the user you're requesting approval
3. Wait for their response before proceeding

Always be helpful and explain what you're doing.""",
    tools=[approval_tool, send_email_tool, delete_files_tool],
)
