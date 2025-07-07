import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('No user message found')
    }

    // Create session
    let sessionId = ''
    try {
      const sessionResponse = await fetch('http://localhost:8000/apps/chat/users/user1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const sessionData = await sessionResponse.json()
      sessionId = sessionData.id
    } catch (error) {
      console.error('Failed to create session:', error)
      throw new Error('Failed to create session')
    }

    // Send to ADK backend
    const payload = {
      app_name: 'chat',
      user_id: 'user1',
      session_id: sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: lastMessage.content }]
      }
    }

    const response = await fetch('http://localhost:8000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`ADK request failed: ${response.status}`)
    }

    const events = await response.json()
    console.log('ADK events:', events)

    // Process response for approval requests
    let approvalRequest = null
    let responseText = ''

    for (const event of events) {
      if (event.content?.parts) {
        for (const part of event.content.parts) {
          // Check for approval requests
          if (part.functionResponse?.name === 'request_human_approval') {
            const approvalData = part.functionResponse.response
            if (approvalData?.status === 'pending') {
              approvalRequest = {
                action: approvalData.action,
                details: approvalData.details,
                ticketId: approvalData.ticket_id,
                message: approvalData.message
              }
            }
          }
        }
      }
      
      // Get text content
      if (event.content?.parts?.[0]?.text) {
        responseText = event.content.parts[0].text
      }
    }

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the response text word by word
          if (responseText) {
            const words = responseText.split(' ')
            for (let i = 0; i < words.length; i++) {
              const chunk = i === 0 ? words[i] : ' ' + words[i]
              const data = JSON.stringify({
                type: 'text',
                content: chunk,
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              await new Promise(resolve => setTimeout(resolve, 50))
            }
          }

          // If there's an approval request, send it
          if (approvalRequest) {
            const toolData = JSON.stringify({
              type: 'tool_call',
              toolCallId: approvalRequest.ticketId,
              toolName: 'request_approval',
              args: {
                action: approvalRequest.action,
                details: approvalRequest.details,
              },
              result: {
                ...approvalRequest,
                originalMessage: lastMessage.content // Pass through original user message
              },
            })
            controller.enqueue(encoder.encode(`data: ${toolData}\n\n`))
          }

          // End stream
          controller.enqueue(encoder.encode(`data: {"type": "done"}\n\n`))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in ADK chat route:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}