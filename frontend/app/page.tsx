'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolInvocations?: ToolInvocation[]
}

interface ToolInvocation {
  toolCallId: string
  toolName: string
  args: any
  result: any
}

interface ApprovalRequest {
  action: string
  details: string
  ticketId: string
  message: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, ApprovalRequest>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    try {
      const response = await fetch('/api/adk-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let toolInvocations: ToolInvocation[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'text') {
                  assistantContent += data.content
                  setStreamingContent(assistantContent)
                } else if (data.type === 'tool_call') {
                  const toolInvocation: ToolInvocation = {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    args: data.args,
                    result: data.result,
                  }
                  toolInvocations.push(toolInvocation)
                  
                  // Handle approval requests
                  if (data.toolName === 'request_approval') {
                    setPendingApprovals(prev => new Map(prev.set(data.toolCallId, data.result)))
                  }
                } else if (data.type === 'done') {
                  // Finalize the message
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date(),
                    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
                  }
                  setMessages(prev => [...prev, assistantMessage])
                  setStreamingContent('')
                }
              } catch (e) {
                console.warn('Failed to parse streaming data:', line)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  const handleApproval = async (toolCallId: string, approved: boolean) => {
    const approval = pendingApprovals.get(toolCallId)
    if (!approval) return

    // Remove from pending
    setPendingApprovals(prev => {
      const newMap = new Map(prev)
      newMap.delete(toolCallId)
      return newMap
    })

    // Send approval directly to backend instead of through chat
    try {
      const approvalResponse = await fetch('/api/adk-chat/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolCallId,
          approved,
          action: approval.action,
          details: approval.details
        }),
      })
      
      if (approvalResponse.ok) {
        // Trigger agent to continue with the approved action, including original context
        const originalContext = approval.originalMessage ? ` Based on the original request: "${approval.originalMessage}"` : ''
        const continueMessage = approved 
          ? `APPROVED: Please proceed with the approved action: ${approval.action}.${originalContext} Execute the action now.` 
          : `REJECTED: The action "${approval.action}" was rejected. Please acknowledge and offer alternatives if appropriate.`
        
        setInput(continueMessage)
        
        // Auto-submit
        setTimeout(() => {
          const form = document.querySelector('form')
          if (form) form.requestSubmit()
        }, 100)
      }
    } catch (error) {
      console.error('Failed to send approval:', error)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 text-center">
          <h1 className="text-2xl font-bold">🤖 AI Assistant with Human-in-the-Loop</h1>
          <p className="text-blue-100 mt-1">AI SDK + ADK Backend with Real Streaming</p>
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
          
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-auto' 
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <div className={`whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                    {message.content}
                  </div>
                  
                  {/* Tool calls for approval requests */}
                  {message.toolInvocations?.map((toolInvocation) => (
                    <div key={toolInvocation.toolCallId} className="mt-3">
                      {toolInvocation.toolName === 'request_approval' && toolInvocation.result && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="text-amber-800 font-medium mb-3">🔔 Human Approval Required</div>
                          <div className="text-gray-700 mb-3">
                            <strong>Action:</strong> {toolInvocation.result.action}<br/>
                            <strong>Details:</strong> {toolInvocation.result.details}
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApproval(toolInvocation.toolCallId, true)}
                              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={isLoading}
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleApproval(toolInvocation.toolCallId, false)}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={isLoading}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Timestamp */}
                <div className={`text-xs text-gray-400 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
              
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white order-1 mr-3' 
                  : 'bg-gray-200 text-gray-600 order-2 ml-3'
              }`}>
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
            </div>
          ))}

          {/* Streaming Content */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[70%] order-1">
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-4 py-3">
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {streamingContent}
                    <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1"></span>
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold order-2 ml-3">
                🤖
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-center">
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-3">
                <div className="flex items-center space-x-3 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>AI is streaming response...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-6 bg-white">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-gray-900"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Try: 'Send an email to john@example.com with subject Test'"
            />
            <button 
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
              disabled={isLoading}
            >
              {isLoading ? '🔄' : '📤'} Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
