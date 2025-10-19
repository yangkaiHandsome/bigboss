
import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const App: React.FC = () => {
  // 系统提示词
  const SYSTEM_PROMPT = import.meta.env.VITE_SYSTEM_PROMPT || "你是杨凯的专属助手，请以专业、友好的态度提供帮助。";

  // OpenAI客户端配置
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
    dangerouslyAllowBrowser: true,
  });

  // 状态管理
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chats, setChats] = useState<ChatHistory[]>(() => {
    const saved = localStorage.getItem('chatHistories');
    return saved ? JSON.parse(saved).map((chat: any) => ({
      ...chat,
      messages: chat.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })),
      createdAt: new Date(chat.createdAt)
    })) : [];
  });
  const [currentChatId, setCurrentChatId] = useState<string>(() => {
    const saved = localStorage.getItem('currentChatId');
    return saved || '';
  });
  
  // refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取当前聊天
  const currentChat = chats.find(chat => chat.id === currentChatId) || 
    (chats.length > 0 ? chats[0] : null);

  // 自动调整textarea高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // 保存聊天历史到localStorage
  useEffect(() => {
    localStorage.setItem('chatHistories', JSON.stringify(chats));
  }, [chats]);

  // 保存当前聊天ID到localStorage
  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId);
    }
  }, [currentChatId]);

  // 滚动到最新消息
  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 创建新聊天
  const createNewChat = () => {
    const newChat: ChatHistory = {
      id: Date.now().toString(),
      title: '新聊天',
      messages: [],
      createdAt: new Date()
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    // 更新当前聊天ID（如果需要）
    let targetChatId = currentChatId;
    let updatedChats = [...chats];
    
    if (!currentChatId || !currentChat) {
      const newChat: ChatHistory = {
        id: Date.now().toString(),
        title: inputValue.trim().substring(0, 20) || '新聊天',
        messages: [],
        createdAt: new Date()
      };
      updatedChats = [newChat, ...updatedChats];
      targetChatId = newChat.id;
      setCurrentChatId(targetChatId);
    }

    // 更新聊天记录
    const chatIndex = updatedChats.findIndex(chat => chat.id === targetChatId);
    if (chatIndex !== -1) {
      updatedChats[chatIndex] = {
        ...updatedChats[chatIndex],
        messages: [...updatedChats[chatIndex].messages, userMessage],
        title: updatedChats[chatIndex].messages.length === 0 ? 
          inputValue.trim().substring(0, 20) || '新聊天' : 
          updatedChats[chatIndex].title
      };
    }
    setChats(updatedChats);
    setInputValue('');
    setIsLoading(true);

    try {
      // 构建消息历史
      const currentChat = updatedChats.find(chat => chat.id === targetChatId);
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...(currentChat?.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })) || [])
      ];

      // 调用OpenAI API
      const stream = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages,
        stream: true,
      });

      // 创建助手消息
      const assistantMessageId = Date.now().toString();
      setChats(prevChats => {
        const newChats = [...prevChats];
        const chatIndex = newChats.findIndex(chat => chat.id === targetChatId);
        if (chatIndex !== -1) {
          newChats[chatIndex] = {
            ...newChats[chatIndex],
            messages: [
              ...newChats[chatIndex].messages,
              {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date()
              }
            ]
          };
        }
        return newChats;
      });

      // 处理流式响应
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          // 添加调试日志，查看实际接收到的内容
          console.log('Received chunk:', JSON.stringify(content));
          
          setChats(prevChats => {
            const newChats = [...prevChats];
            const chatIndex = newChats.findIndex(chat => chat.id === targetChatId);
            if (chatIndex !== -1) {
              const messageIndex = newChats[chatIndex].messages.findIndex(
                msg => msg.id === assistantMessageId
              );
              if (messageIndex !== -1) {
                const currentContent = newChats[chatIndex].messages[messageIndex].content;
                
                // 检查新内容是否与当前内容的末尾重复
                let processedContent = content;
                if (currentContent.length > 0) {
                  const lastChars = currentContent.slice(-content.length * 2);
                  if (lastChars.includes(content)) {
                    // 如果发现重复，跳过这个内容块
                    console.log('Skipping duplicate content:', JSON.stringify(content));
                    return newChats;
                  }
                }
                
                const newContent = currentContent + processedContent;
                // 添加调试日志，查看更新后的内容
                console.log('Current content:', JSON.stringify(currentContent));
                console.log('New content:', JSON.stringify(newContent));
                newChats[chatIndex].messages[messageIndex].content = newContent;
              }
            }
            return newChats;
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      // 添加错误消息
      setChats(prevChats => {
        const newChats = [...prevChats];
        const chatIndex = newChats.findIndex(chat => chat.id === targetChatId);
        if (chatIndex !== -1) {
          newChats[chatIndex] = {
            ...newChats[chatIndex],
            messages: [
              ...newChats[chatIndex].messages,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content: '抱歉，我遇到了一些问题。请稍后再试。',
                timestamp: new Date()
              }
            ]
          };
        }
        return newChats;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 选择聊天历史
  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  // 删除聊天历史
  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
      setCurrentChatId(remainingChats.length > 0 ? remainingChats[0].id : '');
    }
  };

  // 清空当前对话
  const clearCurrentChat = () => {
    if (currentChatId) {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, messages: [] } 
            : chat
        )
      );
    }
  };

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="App">
      {/* 侧边栏 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={createNewChat}>
            <span>+</span> 新建聊天
          </button>
        </div>
        
        <div className="sidebar-history">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
              onClick={() => selectChat(chat.id)}
            >
              <div className="history-text">{chat.title}</div>
              <button 
                className="delete-history"
                onClick={(e) => deleteChat(chat.id, e)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        <div className="sidebar-footer">
        我是大老板群的专属AI助手
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="main-content">
        <div className="chat-container">
          {/* 聊天头部 */}
          <div className="chat-header">
            <div className="header-left">
              <div className="header-info">
                <h3>我是大老板群的专属AI助手</h3>
                <div className="status">在线</div>
              </div>
            </div>
            <div className="header-actions">
              <button className="clear-chat" onClick={clearCurrentChat}>
                清空对话
              </button>
            </div>
          </div>

          {/* 消息区 */}
          <div className="messages-container">
            {currentChat?.messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className={`message-avatar ${message.role}-avatar`}>
                  {message.role === 'user' ? '我' : 'AI'}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div key="loading" className="message assistant">
                <div className="message-avatar assistant-avatar">AI</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span key="1"></span>
                    <span key="2"></span>
                    <span key="3"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="message-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="发送消息..."
                disabled={isLoading}
                rows={1}
              />
              <button 
                className="send-button" 
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M1.428 13.95L15.522 8.22a1 1 0 0 0 0-1.876L1.428 2.05a1 1 0 0 0-1.2.986v3.128a1 1 0 0 0 .6.914l6.53 2.721l-6.53 2.72a1 1 0 0 0-.6.915v3.127a1 1 0 0 0 1.2.986z"/>
                </svg>
              </button>
            </div>
            <div className="input-footer">
              <span>我是大老板群的专属助手可以犯错，请注意核实重要信息。</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;