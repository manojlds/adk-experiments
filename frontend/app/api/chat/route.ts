import { createOpenAI } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Create a tool for requesting human approval
const requestApproval = tool({
  description: 'Request human approval for an action',
  parameters: z.object({
    action: z.string().describe('The action requiring approval'),
    details: z.string().describe('Details about the action'),
  }),
  execute: async ({ action, details }) => {
    // Return approval request data
    return {
      type: 'approval_request',
      action,
      details,
      ticketId: `approval-${Date.now()}`,
      message: `Human approval requested for: ${action}. Details: ${details}`,
    }
  },
})

// Create a tool for sending emails
const sendEmail = tool({
  description: 'Send an email to a recipient',
  parameters: z.object({
    to: z.string().describe('Email address of recipient'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
  }),
  execute: async ({ to, subject, body }) => {
    // This would send an actual email in production
    return `Email sent successfully to ${to} with subject "${subject}"`
  },
})

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages,
    tools: {
      requestApproval,
      sendEmail,
    },
    system: `You are a helpful assistant with human-in-the-loop capabilities.

IMPORTANT: Before sending emails or performing sensitive actions, you MUST:
1. Use the requestApproval tool to get human approval
2. Wait for the human to approve or reject
3. Only proceed if approved

When asked to send emails, always request approval first with detailed information.`,
  })

  return result.toDataStreamResponse()
}