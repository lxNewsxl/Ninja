// src/components/MessageFeed.js
import { formatTimestamp, sanitizeHTML, generateColor } from '../utils/helpers.js';

export class MessageFeed {
  constructor(messages, profile, onSendMessage) {
    this.messages = messages;
    this.profile = profile;
    this.onSendMessage = onSendMessage;
    this.container = null;
    this.feedContainer = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'flex-1 flex flex-col bg-gray-900';

    // Messages container
    this.feedContainer = document.createElement('div');
    this.feedContainer.className = 'flex-1 overflow-y-auto p-4 space-y-3';

    // Render existing messages
    this.messages.forEach(msg => {
      this.feedContainer.appendChild(this.renderMessage(msg));
    });

    // Auto-scroll to bottom
    setTimeout(() => this.scrollToBottom(), 0);

    // Input area
    const inputArea = this.renderInputArea();

    this.container.appendChild(this.feedContainer);
    this.container.appendChild(inputArea);

    return this.container;
  }

  renderMessage(message) {
    const messageEl = document.createElement('div');
    const isOwnMessage = message.userId === this.profile.id;
    
    messageEl.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-xl px-4 py-2 rounded-lg ${
      isOwnMessage 
        ? 'bg-purple-600 text-white' 
        : 'bg-gray-800 text-gray-100'
    }`;

    // Username
    if (!isOwnMessage) {
      const username = document.createElement('div');
      username.className = 'text-xs font-semibold mb-1';
      username.style.color = generateColor(message.username);
      username.textContent = message.username;
      bubble.appendChild(username);
    }

    // Message text
    const text = document.createElement('div');
    text.className = 'break-words';
    text.textContent = message.text;
    bubble.appendChild(text);

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.className = `text-xs mt-1 ${
      isOwnMessage ? 'text-purple-200' : 'text-gray-500'
    }`;
    timestamp.textContent = formatTimestamp(message.timestamp);
    bubble.appendChild(timestamp);

    messageEl.appendChild(bubble);
    return messageEl;
  }

  renderInputArea() {
    const inputArea = document.createElement('div');
    inputArea.className = 'border-t border-gray-800 p-4 bg-gray-800';

    const form = document.createElement('form');
    form.className = 'flex gap-2';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleSendMessage(form);
    };

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'message';
    input.placeholder = 'Type a message...';
    input.className = 'flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white';
    input.required = true;

    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition';
    sendBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
    `;

    form.appendChild(input);
    form.appendChild(sendBtn);
    inputArea.appendChild(form);

    return inputArea;
  }

  handleSendMessage(form) {
    const formData = new FormData(form);
    const message = formData.get('message');

    if (message.trim()) {
      this.onSendMessage(message.trim());
      form.reset();
    }
  }

  addMessage(message) {
    const messageEl = this.renderMessage(message);
    this.feedContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.feedContainer) {
      this.feedContainer.scrollTop = this.feedContainer.scrollHeight;
    }
  }
}
