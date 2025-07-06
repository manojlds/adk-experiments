from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

root_agent = LlmAgent(
    model=LiteLlm(model="gpt-3.5-turbo"),
    instruction="You are a helpful chat assistant. Reply concisely to the user's messages.",
)
