"use client"

import { useState, useEffect, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import LLMResponse from "@/components/LLMResponse" // We import the Markdown renderer
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"




export function Chat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([])
  const [model, setModel] = useState("mistral")
  const [temperature, setTemperature] = useState(0.3)
  const availableModels = ["mistral", "tinyllama"]
  const [loading, setLoading] = useState(false)
  

  // Reference for automatic scrolling
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const resetConversation = async () => {
    try {
      await fetch("http://localhost:8000/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }), // send active model
      })

      setMessages([]) // Also clean the frontend”
      toast.success(`Conversation reset for model ” ${model}`)
    } catch (error) {
      toast.error("Could not reset the conversation")
    }
  }


const sendMessage = async () => {
  if (!input.trim()) return

  const userMessage = input
  setInput("")

  // Add user message and empty message for the assistant
  setMessages(prev => [...prev, { role: "user", text: userMessage }, { role: "assistant", text: "" }])
  setLoading(true)

  let assistantText = ""

  try {
    await streamAssistantResponse(userMessage, model, temperature, (token: string) => {
      assistantText += token

      // Update assistant message in real time
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: "assistant", text: assistantText }
        return updated
      })
    })
  } catch (error) {
    console.error("Streaming error:", error)
    toast.error("There was a problem generating the response.")
  } finally {
    setLoading(false)
  }
}




  async function streamAssistantResponse(
    userMessage: string,
    model: string,
    temperature: number,
    onToken: (token: string) => void
  ) {
    const response = await fetch("http://localhost:8000/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_input: userMessage,
        model,
        temperature
      })
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let done = false

    while (!done && reader) {
      const { value, done: doneReading } = await reader.read()
      done = doneReading
      const chunk = decoder.decode(value)
      onToken(chunk)
    }
  }



  return (
    <Card className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Controles */}
      <div className="flex gap-4 items-center">
        <div>
          <label className="block text-sm font-medium">Model:</label>
          <select
            className="border px-2 py-1 rounded-md"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-medium">
            Temperature: {temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
        </div>

        <Button variant="outline" onClick={resetConversation}>
          Reset ({model})
        </Button>
      </div>

      {model === "tinyllama" && (
        <div className="mt-2">
          <Alert variant="warning">
            <AlertDescription>
              This model can respond in English. For better results in Spanish, choose <strong>Mistral.</strong>
            </AlertDescription>
          </Alert>
        </div>
      )}



      {/* Área de mensajes */}
      <div className="h-[400px] overflow-y-auto space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === "user" ? "text-right" : "text-left"}>
            {msg.role === "user" ? (
              <span
                className={`inline-block px-4 py-2 rounded-xl max-w-[75%] text-sm whitespace-pre-wrap transition-colors
                  bg-blue-100 text-black dark:bg-blue-900 dark:text-white`}
              >
                {msg.text}
              </span>
            ) : (
              <LLMResponse content={msg.text} />
            )}
          </div>
        ))}

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center items-center space-x-2">
            <div className="h-4 w-4 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="h-4 w-4 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-4 w-4 bg-gray-400 rounded-full animate-bounce"></div>
            <span className="ml-2 text-sm text-gray-500">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} /> {/* Auto-scroll target */}
      </div>

      {/* Entrada */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-background text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />

        <Button onClick={sendMessage} disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
    </Card>
  )
}

