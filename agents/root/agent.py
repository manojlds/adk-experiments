from google.adk.agents import LlmAgent

root_agent = LlmAgent(
    model="gemini-pro",
    instruction="You are a helpful chat assistant. Reply concisely to the user's messages."
)
