
import React, { useState, useRef, useEffect } from 'react';
import { OpenAI } from 'openai';
import './App.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const openai = new OpenAI({
  apiKey: 'sk-fa9ab9e27bdc40ffae00d382b07838b5',
  baseURL: 'https://api.deepseek.com',
  dangerouslyAllowBrowser: true
});

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // 创建一个空的助手消息用于流式更新
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages([...updatedMessages, assistantMessage]);

      // 启用流式输出
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: updatedMessages.map(({ role, content }) => ({ role, content })),
        stream: true
      });

      // 处理流式响应
      let fullContent = '';
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          // 更新最后一条消息（助手消息）的内容
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = fullContent;
            }
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error('Error calling API:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="App">
      <div className="ai-chat-container">
        <div className="chat-header">
          <div className="header-left">
            <div className="ai-avatar">
              <span>AI</span>
            </div>
            <div className="header-info">
              <h3>DeepSeek Assistant</h3>
              <span className="status">Online</span>
            </div>
          </div>
          <button className="clear-chat" onClick={() => setMessages([{
            role: 'assistant',
            content: 'Hello! How can I assist you today?',
            timestamp: new Date()
          }])}>
            Clear Chat
          </button>
        </div>

        <div className="messages-container">
          {messages
            .filter(msg => msg.role !== 'system')
            .map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? (
                    <div className="user-avatar">You</div>
                  ) : (
                    <div className="assistant-avatar">AI</div>
                  )}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < message.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">
                <div className="assistant-avatar">AI</div>
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message DeepSeek Assistant..."
              disabled={isLoading}
              rows={1}
              className="message-input"
            />
            <button 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim()}
              className="send-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <div className="input-footer">
            <span>DeepSeek Assistant can make mistakes. Consider checking important information.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;