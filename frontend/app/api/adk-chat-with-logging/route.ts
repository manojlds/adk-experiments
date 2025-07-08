import { NextRequest, NextResponse } from 'next/server'

// Simple pause/resume logging for demonstration
function logLongRunningToolEvent(event: any, phase: string) {
  const timestamp = new Date().toISOString()
  
  if (event.longRunningToolIds && event.longRunningToolIds.length > 0) {
    console.log(`🔄 [${timestamp}] AGENT PAUSED - Long-running tool started: ${event.longRunningToolIds[0]} (${phase})`)
  }
  
  if (event.content?.parts) {
    for (const part of event.content.parts) {
      if (part.functionResponse?.name === 'request_human_approval') {
        const status = part.functionResponse.response?.status
        const toolId = part.functionResponse.id
        
        if (status === 'pending') {
          console.log(`⏸️  [${timestamp}] AGENT WAITING - Tool ${toolId} pending approval (${phase})`)
        } else if (status === 'approved') {
          console.log(`▶️  [${timestamp}] AGENT RESUMED - Tool ${toolId} approved (${phase})`)
        } else if (status === 'rejected') {
          console.log(`▶️  [${timestamp}] AGENT RESUMED - Tool ${toolId} rejected (${phase})`)
        }
      }
      
      if (part.functionCall && part.functionCall.name !== 'request_human_approval') {
        console.log(`🚀 [${timestamp}] AGENT EXECUTING - Function: ${part.functionCall.name} (${phase})`)
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, resumeWithFunctionResponse } = await req.json()
    
    let newMessage
    let lastMessage
    let phase = 'INITIAL_REQUEST'
    
    if (resumeWithFunctionResponse) {
      // Resuming with function response - send function_response to ADK
      newMessage = {
        role: 'user',
        parts: [{
          function_response: {
            id: resumeWithFunctionResponse.toolCallId,
            name: 'request_human_approval',
            response: {
              status: resumeWithFunctionResponse.approved ? 'approved' : 'rejected',
              action: resumeWithFunctionResponse.action,
              details: resumeWithFunctionResponse.details,
              approved: resumeWithFunctionResponse.approved
            }
          }
        }]
      }
      lastMessage = { content: `Function response: ${resumeWithFunctionResponse.approved ? 'approved' : 'rejected'}` }
      phase = 'RESUME_AFTER_APPROVAL'
      
      console.log(`🔄 [${new Date().toISOString()}] RESUMING AGENT - Tool ${resumeWithFunctionResponse.toolCallId} ${resumeWithFunctionResponse.approved ? 'APPROVED' : 'REJECTED'}`)
    } else {
      // Normal message flow
      lastMessage = messages[messages.length - 1]
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('No user message found')
      }
      newMessage = {
        role: 'user',
        parts: [{ text: lastMessage.content }]
      }
      phase = 'INITIAL_REQUEST'
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
      new_message: newMessage
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
    console.log(`📊 [${new Date().toISOString()}] Received ${events.length} events from ADK (${phase})`)

    // Log each event for pause/resume detection
    events.forEach((event: any, index: number) => {
      logLongRunningToolEvent(event, `${phase}_EVENT_${index}`)
    })

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
              console.log(`🔔 [${new Date().toISOString()}] APPROVAL REQUEST - Action: ${approvalData.action}`)
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