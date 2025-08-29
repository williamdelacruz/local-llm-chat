"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { useTheme } from "next-themes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, AlertTriangle, Lightbulb, Flame, CheckCircle } from "lucide-react"

import "highlight.js/styles/github.css"
import "highlight.js/styles/atom-one-dark.css"

interface LLMResponseProps {
  content: string
}

const alertIconMap: Record<string, React.ReactNode> = {
  "💡": <Lightbulb className="h-4 w-4" />,
  "⚠️": <AlertTriangle className="h-4 w-4" />,
  "🔥": <Flame className="h-4 w-4" />,
  "✅": <CheckCircle className="h-4 w-4" />,
  "❗": <AlertTriangle className="h-4 w-4 text-red-500" />,
  "ℹ️": <Info className="h-4 w-4" />,
}

const EmojiAlert = ({ emoji, text }: { emoji: string; text: string }) => (
  <Alert className="my-4">
    {alertIconMap[emoji] || <Info className="h-4 w-4" />}
    <AlertDescription>{text}</AlertDescription>
  </Alert>
)

const LLMResponse: React.FC<LLMResponseProps> = ({ content }) => {
  const { resolvedTheme } = useTheme()

  // Detect lines that start with a special emoji and separate them as alerts
  const processedLines = content.split("\n").map((line, idx) => {
    const match = line.match(/^([💡⚠️🔥✅❗ℹ️])\s+(.*)/)
    if (match) {
      const [, emoji, text] = match
      return <EmojiAlert key={idx} emoji={emoji} text={text} />
    } else {
      return line
    }
  })

  return (
    <div
      className={`prose max-w-none prose-pre:rounded-md prose-pre:p-3 prose-code:before:hidden prose-code:after:hidden
        ${resolvedTheme === "dark" ? "hljs-dark" : "hljs-light"}`}
    >
      <ReactMarkdown
        children={processedLines
          .map((line) => (typeof line === "string" ? line : ""))
          .join("\n")}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      />
      {/* Render the alerts at the end */}
      {processedLines.map((line, idx) =>
        typeof line !== "string" ? <React.Fragment key={idx}>{line}</React.Fragment> : null
      )}
    </div>
  )
}

export default LLMResponse


