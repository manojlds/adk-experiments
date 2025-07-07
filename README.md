# 🤖 AI Assistant with Human-in-the-Loop

[![Google ADK](https://img.shields.io/badge/Google-ADK-4285F4?style=for-the-badge&logo=google)](https://google.github.io/adk-docs/)
[![AI SDK](https://img.shields.io/badge/Vercel-AI_SDK-000000?style=for-the-badge&logo=vercel)](https://sdk.vercel.ai/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

> 🚀 **Dual-implementation** chat application showcasing **human-in-the-loop AI workflows** with beautiful, interactive approval interfaces.

## ✨ Features

- 🎯 **Human-in-the-Loop Workflows** - AI requests approval before performing actions
- 🤖 **Dual Backends** - Choose between Google ADK or AI SDK implementations  
- 💬 **Beautiful Chat UI** - Modern, responsive interface with real-time streaming
- 🔧 **Tool Integration** - Email sending, file operations with approval gates
- ⚡ **Real-time Streaming** - See AI responses as they're generated
- 🎨 **Interactive Approvals** - Visual approve/reject buttons for sensitive actions

## 🏗️ Architecture

### **ADK Backend** (`/`)
- **Framework:** [Google ADK](https://google.github.io/adk-docs/) + FastAPI
- **Features:** LongRunningFunctionTool, persistent sessions, advanced agent orchestration
- **Use Case:** Production-ready AI agent workflows

### **AI SDK Frontend** (`/ai`)  
- **Framework:** [Vercel AI SDK](https://sdk.vercel.ai/) + Next.js
- **Features:** Generative UI, real-time tool calls, modern streaming
- **Use Case:** Rapid prototyping and modern UX patterns

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- OpenAI API Key

### 1. Backend Setup (ADK)

```bash
# Create virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install google-adk fastapi "uvicorn[standard]" litellm python-dotenv

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start ADK backend
uvicorn backend:app --reload
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies  
npm install

# Configure AI SDK (for /ai route)
cp .env.local.example .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Start frontend
npm run dev
```

### 3. Experience the Magic ✨

🌐 **ADK Version:** [http://localhost:3000](http://localhost:3000)
- Full Google ADK agent with LongRunningFunctionTool
- Enterprise-grade session management
- Advanced tool orchestration

🌟 **AI SDK Version:** [http://localhost:3000/ai](http://localhost:3000/ai)  
- Modern streaming with generative UI
- Real-time tool call visualization
- Sleek user experience

## 🎮 Try These Commands

```
💬 "Hello! How can you help me?"
📧 "Send an email to john@example.com with subject 'Meeting Reminder'"
🗂️ "Delete my old project files"
⚡ "What actions require approval?"
```

## 🛠️ How It Works

### Human-in-the-Loop Flow

1. **🗣️ User Request** - "Send an email to my team"
2. **🤖 AI Analysis** - Agent understands the request
3. **⏸️ Approval Gate** - AI requests human approval with details
4. **✅ Human Decision** - User approves/rejects via UI buttons  
5. **🚀 Action Execution** - AI proceeds only if approved
6. **📝 Confirmation** - User sees results and logs

### Tool Architecture

```python
# ADK Implementation
@LongRunningFunctionTool
def request_human_approval(action: str, details: str) -> dict:
    return {
        'status': 'pending',
        'action': action,
        'details': details,
        'ticket_id': f'approval-{uuid.uuid4().hex[:8]}'
    }

# AI SDK Implementation  
const requestApproval = tool({
    description: 'Request human approval for an action',
    parameters: z.object({
        action: z.string(),
        details: z.string(),
    }),
    execute: async ({ action, details }) => ({
        type: 'approval_request',
        action, details,
        ticketId: `approval-${Date.now()}`
    })
})
```

## 📂 Project Structure

```
adk-experiments/
├── 🐍 backend.py              # ADK FastAPI server
├── 🤖 agents/chat/agent.py    # ADK agent with tools
├── 📁 frontend/
│   ├── 🎨 app/page.tsx        # ADK chat interface  
│   ├── ⚡ app/ai/page.tsx     # AI SDK interface
│   └── 🔌 app/api/chat/       # AI SDK API route
└── 📖 README.md               # You are here!
```

## 🔧 Tools & Capabilities

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| 📧 `send_email` | Send emails to recipients | ✅ Yes |
| 🗂️ `delete_files` | Delete files and directories | ✅ Yes |
| 🔍 `request_human_approval` | Gate for sensitive operations | 🎯 Core Tool |

## 🎯 Advanced Features

- **🔄 Session Persistence** - Conversations maintained across restarts
- **📊 Usage Tracking** - Monitor token usage and costs
- **🛡️ Security Gates** - Multiple approval layers for sensitive operations
- **📱 Responsive Design** - Works beautifully on all devices
- **🎨 Generative UI** - Dynamic interfaces based on AI responses
- **⚡ Real-time Streaming** - See AI thinking in real-time

## 🤝 Contributing

We welcome contributions! Areas for enhancement:

- 🔌 **New Tools** - Add more approval-gated actions
- 🎨 **UI Components** - Enhanced generative UI patterns  
- 🛡️ **Security** - Advanced approval workflows
- 📊 **Analytics** - Usage monitoring and insights

## 📚 Learn More

- 📖 [Google ADK Documentation](https://google.github.io/adk-docs/)
- ⚡ [Vercel AI SDK Guide](https://sdk.vercel.ai/docs)
- 🎯 [Human-in-the-Loop AI Patterns](https://example.com)
- 🔧 [Tool Development Guide](https://example.com)

## 📄 License

MIT License - see LICENSE file for details.

---

<div align="center">

**🚀 Built with cutting-edge AI frameworks**

Made with ❤️ for the AI community

[⭐ Star this repo](https://github.com/user/adk-experiments) • [🐛 Report Issues](https://github.com/user/adk-experiments/issues) • [💬 Discussions](https://github.com/user/adk-experiments/discussions)

</div>
