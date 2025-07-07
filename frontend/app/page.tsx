'use client'
import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'model';
  content: string;
  isApprovalRequest?: boolean;
  approvalAction?: string;
  approvalDetails?: string;
  ticketId?: string;
  timestamp?: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const sessionIdRef = useRef<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userId = 'user1'
  const appName = 'chat'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessage])

  useEffect(() => {
    // create session on first load
    async function createSession() {
      const res = await fetch(`/apps/${appName}/users/${userId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      sessionIdRef.current = data.id
    }
    createSession()
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return
    setMessages((msgs) => [...msgs, { role: 'user', content: text, timestamp: new Date() }])
    setInput('')
    setIsLoading(true)
    setStreamingMessage('')

    const payload = {
      app_name: appName,
      user_id: userId,
      session_id: sessionIdRef.current,
      new_message: { role: 'user', parts: [{ text }] },
    }
    
    try {
      // Start with regular endpoint for debugging, then try streaming
      console.log('Sending payload:', payload)
      const response = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const events = await response.json()
      console.log('Received events:', events)
      
      // ADK returns an array of events, each with a 'content' field
      if (Array.isArray(events) && events.length > 0) {
        const lastEvent = events[events.length - 1]
        
        // Check if this is a content response
        if (lastEvent.content && lastEvent.content.parts) {
          const textResp = lastEvent.content.parts[0]?.text || ''
          if (textResp) {
            setMessages((msgs) => [...msgs, { role: 'model', content: textResp, timestamp: new Date() }])
          }
        }
        
        // Check for function responses with approval requests
        for (const event of events) {
          if (event.content?.parts) {
            for (const part of event.content.parts) {
              // Check for function response from approval tool
              if (part.functionResponse?.name === 'request_human_approval') {
                const approvalData = part.functionResponse.response
                if (approvalData?.status === 'pending') {
                  setMessages((msgs) => [...msgs, { 
                    role: 'model', 
                    content: approvalData.message,
                    isApprovalRequest: true,
                    approvalAction: approvalData.action,
                    approvalDetails: approvalData.details,
                    ticketId: approvalData.ticket_id,
                    timestamp: new Date()
                  }])
                  return // Don't add duplicate message
                }
              }
            }
          }
        }
      } else {
        console.warn('Unexpected response format:', events)
        setMessages((msgs) => [...msgs, { 
          role: 'model', 
          content: 'Received response but could not parse it properly.',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Request failed:', error)
      setMessages((msgs) => [...msgs, { 
        role: 'model', 
        content: 'Sorry, I\'m having trouble connecting to the server. Please check that the backend is running on port 8000 and the agent is properly configured.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
      setStreamingMessage('')
    }
  }

  function handleStreamingEvent(event: any) {
    console.log('Streaming event:', event)
    
    switch (event.type) {
      case 'content':
        // Handle partial content updates
        if (event.data?.parts?.[0]?.text) {
          setStreamingMessage(event.data.parts[0].text)
        }
        break
      case 'tool_call':
        // Handle tool calls (like LongRunningFunctionTool)
        if (event.data?.name === 'request_human_approval') {
          setStreamingMessage('Requesting human approval...')
        }
        break
      case 'tool_response':
        // Handle tool responses
        if (event.data?.name === 'request_human_approval') {
          const toolResult = event.data.result
          if (toolResult?.status === 'pending') {
            setMessages((msgs) => [...msgs, { 
              role: 'model', 
              content: toolResult.message,
              isApprovalRequest: true,
              approvalAction: toolResult.action,
              approvalDetails: toolResult.details,
              ticketId: toolResult.ticket_id,
              timestamp: new Date()
            }])
            setStreamingMessage('')
          }
        }
        break
      case 'run_complete':
        // Final message when run is complete
        if (streamingMessage) {
          setMessages((msgs) => [...msgs, { role: 'model', content: streamingMessage, timestamp: new Date() }])
          setStreamingMessage('')
        }
        break
    }
  }

  async function handleApproval(approve: boolean, messageIndex: number) {
    const message = messages[messageIndex]
    if (!message.isApprovalRequest || !message.ticketId) return

    const responseText = approve ? 'APPROVED' : 'REJECTED'
    // Don't add the approval response to messages - just send it to backend
    setIsLoading(true)
    setStreamingMessage('')

    // Send the approval response to continue the long-running operation
    const payload = {
      app_name: appName,
      user_id: userId,
      session_id: sessionIdRef.current,
      new_message: { role: 'user', parts: [{ text: responseText }] },
    }
    
    try {
      const response = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const events = await response.json()
      console.log('Approval response events:', events)
      
      // Handle ADK response format
      if (Array.isArray(events) && events.length > 0) {
        const lastEvent = events[events.length - 1]
        if (lastEvent.content && lastEvent.content.parts) {
          const textResp = lastEvent.content.parts[0]?.text || ''
          if (textResp) {
            setMessages((msgs) => [...msgs, { role: 'model', content: textResp, timestamp: new Date() }])
          }
        }
      }
    } catch (error) {
      console.error('Error sending approval:', error)
      setMessages((msgs) => [...msgs, { role: 'model', content: 'Error: Failed to send approval', timestamp: new Date() }])
    } finally {
      setIsLoading(false)
      setStreamingMessage('')
    }
  }

  const formatTime = (date?: Date) => {
    if (!date) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 text-center">
          <h1 className="text-2xl font-bold">🤖 AI Assistant with Human-in-the-Loop</h1>
          <p className="text-blue-100 mt-1">ADK Backend with approval workflows</p>
          <a 
            href="/ai" 
            className="inline-block mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
          >
            Try AI SDK Version →
          </a>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Welcome to AI Chat</h3>
              <p className="text-gray-400">Start a conversation and explore human-in-the-loop AI assistance</p>
              <div className="mt-4 text-sm text-gray-400">
                Try: "Can you send an email to my team?" or "Help me delete some files"
              </div>
            </div>
          )}
          
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${m.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  m.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-auto' 
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <div className={`whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : 'text-gray-900'}`}>{m.content}</div>
                  
                  {m.isApprovalRequest && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-amber-800 font-medium mb-3">🔔 Human Approval Required</div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproval(true, idx)}
                          className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isLoading}
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleApproval(false, idx)}
                          className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isLoading}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <div className={`text-xs text-gray-400 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {formatTime(m.timestamp)}
                </div>
              </div>
              
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                m.role === 'user' 
                  ? 'bg-blue-500 text-white order-1 mr-3' 
                  : 'bg-gray-200 text-gray-600 order-2 ml-3'
              }`}>
                {m.role === 'user' ? '👤' : '🤖'}
              </div>
            </div>
          ))}
          
          {/* Streaming Message */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[70%]">
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-gray-600">{streamingMessage}</span>
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold ml-3">
                🤖
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {isLoading && !streamingMessage && (
            <div className="flex justify-center">
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-3">
                <div className="flex items-center space-x-3 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-6 bg-white">
          <div className="flex space-x-4">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-gray-900"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) sendMessage() }}
              disabled={isLoading}
              placeholder="Type your message... (Try asking for an action that needs approval)"
            />
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
              onClick={sendMessage}
              disabled={isLoading}
            >
              {isLoading ? '🔄' : '📤'} Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
