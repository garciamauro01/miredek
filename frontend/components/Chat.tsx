import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import '../styles/Chat.css';

interface Message {
    sender: 'me' | 'remote';
    text: string;
    timestamp: number;
}

interface ChatProps {
    isOpen: boolean;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onClose: () => void;
}

export function Chat({ isOpen, messages, onSendMessage, onClose }: ChatProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`chat-panel ${isOpen ? 'open' : 'closed'}`}>
            <div className="chat-header">
                <h3>Chat</h3>
                <button className="chat-close-btn" onClick={onClose} title="Fechar Chat">
                    <X size={18} />
                </button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '20px', fontSize: '12px' }}>
                        Nenhuma mensagem ainda.
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div key={index} className={`message-item ${msg.sender}`}>
                            <div className="message-content">{msg.text}</div>
                            <div className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area" onKeyDown={(e) => e.stopPropagation()}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Digite sua mensagem..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className="chat-send-btn" onClick={handleSend} disabled={!inputValue.trim()}>
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
