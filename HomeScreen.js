import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import API from '../api';
import io from 'socket.io-client';

let socket;

export default function HomeScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});

  useEffect(() => {
    fetchUsers();
    const token = localStorage.getItem('token');
    socket = io('http://localhost:5000', { auth: { token } });

    socket.on('user:status', ({ userId, online }) => {
      setOnlineStatus(prev => ({ ...prev, [userId]: online }));
    });

    return () => socket.disconnect();
  }, []);

  const fetchUsers = async () => {
    const { data } = await API.get('/users');
    setUsers(data);
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('Chat', { user: item })}>
      <View style={{ flexDirection: 'row', padding: 10 }}>
        <Text>{item.name} {onlineStatus[item._id] ? '(Online)' : '(Offline)'}</Text>
        <Text style={{ color: 'gray' }}> - {item.lastMessage || 'No messages'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <FlatList data={users} renderItem={renderUser} keyExtractor={item => item._id} />
    </View>
  );
}
