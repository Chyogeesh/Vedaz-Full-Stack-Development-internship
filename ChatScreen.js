import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, Button } from 'react-native';
import API from '../api';
import io from 'socket.io-client';

let socket;
let typingTimeout;

export default function ChatScreen({ route }) {
  const { user } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState({});
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const flatListRef = useRef();

  useEffect(() => {
    fetchMessages();
    const token = localStorage.getItem('token');
    socket = io('http://localhost:5000', { auth: { token } });

    socket.on('message:new', (msg) => {
      if ((msg.from === user._id && msg.to === currentUser.id) || (msg.from === currentUser.id && msg.to === user._id)) {
        setMessages(prev => [...prev, msg]);
        if (msg.from === user._id) {
          socket.emit('message:read', { messageId: msg._id });
          setStatus(prev => ({ ...prev, [msg._id]: 'read' }));
        }
      }
    });

    socket.on('typing:start', ({ from }) => {
      if (from === user._id) setTyping(true);
    });

    socket.on('typing:stop', ({ from }) => {
      if (from === user._id) setTyping(false);
    });

    socket.on('message:read', ({ messageId }) => {
      setStatus(prev => ({ ...prev, [messageId]: 'read' }));
    });

    return () => socket.disconnect();
  }, [user._id]);

  const fetchMessages = async () => {
    const { data } = await API.get(`/conversations/${user._id}/messages`);
    setMessages(data);
    // Set initial statuses
    const initialStatus = {};
    data.forEach(msg => {
      initialStatus[msg._id] = msg.status;
    });
    setStatus(initialStatus);
  };

  const sendMessage = () => {
    if (text.trim()) {
      socket.emit('message:send', { to: user._id, text });
      setText('');
    }
  };

  const handleTyping = () => {
    socket.emit('typing:start', { to: user._id });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('typing:stop', { to: user._id });
    }, 2000);
  };

  const renderMessage = ({ item }) => {
    const isSent = item.from._id === currentUser.id;
    return (
      <View style={{ alignSelf: isSent ? 'flex-end' : 'flex-start', margin: 5 }}>
        <Text>{item.text}</Text>
        <Text style={{ fontSize: 10 }}>{status[item._id] || 'sent'}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item._id}
        onContentSizeChange={() => flatListRef.current.scrollToEnd()}
      />
      {typing && <Text>{user.name} is typing...</Text>}
      <View style={{ flexDirection: 'row' }}>
        <TextInput
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          onKeyPress={handleTyping}
          placeholder="Type a message"
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
}
