import { useState, useRef, useEffect } from "react";
import { useAiChat } from "@workspace/api-client-react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AiChatMessage {
  role: string;
  content: string;
}

export default function AiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your UniVerse agricultural study coach. Ask me about your courses, soil science, crop management, or general study advice." }
  ]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Explain photosynthesis simply",
    "How to prepare for my botany exam?",
    "What are good study habits?"
  ]);
  
  const chatMutation = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMutation.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setInput("");
    
    chatMutation.mutate(
      { data: { messages: newMessages as any } },
      {
        onSuccess: (data) => {
          setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
          }
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">AI Study Coach</h1>
          <p className="text-sm text-muted-foreground">Powered by agricultural knowledge base</p>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col mb-4 min-h-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 pb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-secondary text-secondary-foreground rounded-tr-sm' 
                    : 'bg-muted/50 border border-border text-foreground rounded-tl-sm'
                }`}>
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="mb-1 last:mb-0">{line}</p>
                  ))}
                </div>
              </div>
            ))}
            
            {chatMutation.isPending && (
              <div className="flex gap-4 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-muted/50 border border-border rounded-tl-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {suggestions.length > 0 && (
          <div className="p-4 border-t border-border/50 bg-muted/20 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(suggestion)}
                className="whitespace-nowrap text-xs bg-background border border-border px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-colors font-medium shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-border bg-background shrink-0">
          <div className="relative flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="min-h-[60px] max-h-[200px] resize-none pr-12 bg-background border-border focus-visible:ring-primary/20"
              rows={1}
            />
            <Button 
              onClick={() => handleSend(input)} 
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="absolute right-2 bottom-2 h-10 w-10 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            AI can make mistakes. Verify important academic information.
          </p>
        </div>
      </div>
    </div>
  );
}
