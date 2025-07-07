'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'

interface ApprovalRequest {
  type: 'approval_request'
  action: string
  details: string
  ticketId: string
  message: string
}

export default function AIChat() {
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, ApprovalRequest>>(new Map())

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'requestApproval') {
        const approvalData = toolCall.result as ApprovalRequest
        setPendingApprovals(prev => new Map(prev.set(toolCall.toolCallId, approvalData)))
        return `Approval request created with ID: ${toolCall.toolCallId}`
      }
      return undefined
    },
  })

  const handleApproval = async (toolCallId: string, approved: boolean) => {
    const approval = pendingApprovals.get(toolCallId)
    if (!approval) return

    // Remove from pending
    setPendingApprovals(prev => {
      const newMap = new Map(prev)
      newMap.delete(toolCallId)
      return newMap
    })

    // Continue the conversation with approval decision
    const response = approved ? 'APPROVED' : 'REJECTED'
    
    // This would typically send the approval back to continue the conversation
    // For now, we'll add a message to indicate the decision
    console.log(`Approval ${response} for ${approval.action}`)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 text-center">
          <h1 className="text-2xl font-bold">🤖 AI SDK Chat with Human-in-the-Loop</h1>
          <p className="text-blue-100 mt-1">Enhanced with AI SDK and Generative UI</p>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Welcome to AI SDK Chat</h3>
              <p className="text-gray-400">Try asking me to send an email or perform an action</p>
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
                  <div className="whitespace-pre-wrap text-gray-900">{message.content}</div>
                  
                  {/* Tool calls */}
                  {message.toolInvocations?.map((toolInvocation) => (
                    <div key={toolInvocation.toolCallId} className="mt-3">
                      {toolInvocation.toolName === 'requestApproval' && toolInvocation.result && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="text-amber-800 font-medium mb-3">🔔 Human Approval Required</div>
                          <div className="text-gray-700 mb-3">
                            <strong>Action:</strong> {(toolInvocation.result as any).action}<br/>
                            <strong>Details:</strong> {(toolInvocation.result as any).details}
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApproval(toolInvocation.toolCallId, true)}
                              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleApproval(toolInvocation.toolCallId, false)}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {toolInvocation.toolName === 'sendEmail' && toolInvocation.result && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="text-green-800 text-sm">
                            📧 {toolInvocation.result}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Timestamp */}
                <div className={`text-xs text-gray-400 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {formatTime(message.createdAt || new Date())}
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
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-6 bg-white">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-gray-900"
              value={input}
              onChange={handleInputChange}
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