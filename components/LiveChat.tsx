import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Pin, Trash2, Send, Smile, Shield, Crown, X } from 'lucide-react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  pinChatMessage,
  subscribeToChat,
  type LiveStreamWithCreator,
} from '../lib/live';
import type { LiveChatMessage, Profile } from '../lib/supabase';

interface ChatMessageWithProfile extends LiveChatMessage {
  profiles?: Profile;
}

interface LiveChatProps {
  stream: LiveStreamWithCreator;
  isCreator: boolean;
  isAdmin: boolean;
  isSubscriber: boolean;
}

const EMOJIS = ['😀', '😂', '❤️', '🔥', '👏', '🎉', '👍', '😮', '😢', '😡', '💯', '✨'];

export default function LiveChat({ stream, isCreator, isAdmin, isSubscriber }: LiveChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageWithProfile | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessageWithProfile | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageTime = useRef<number>(0);

  const canModerate = isCreator || isAdmin;
  const canChat = stream.chat_enabled && (!stream.subscriber_only_chat || isSubscriber || canModerate);

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await getChatMessages(stream.id, 100);
      const reversed = [...msgs].reverse();
      setMessages(reversed);
      const pinned = reversed.find((m) => m.is_pinned && !m.is_deleted);
      setPinnedMessage(pinned || null);
    } catch (e) {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [stream.id]);

  useEffect(() => {
    loadMessages();
    const subscription = subscribeToChat(stream.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new as ChatMessageWithProfile;
        if (newMsg && !newMsg.is_deleted) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.is_pinned) {
            setPinnedMessage(newMsg);
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as ChatMessageWithProfile;
        if (updated) {
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
          if (updated.is_pinned) {
            setPinnedMessage(updated);
          } else if (pinnedMessage?.id === updated.id) {
            setPinnedMessage(null);
          }
        }
      } else if (payload.eventType === 'DELETE') {
        const deleted = payload.old as ChatMessageWithProfile;
        if (deleted) {
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
          if (pinnedMessage?.id === deleted.id) {
            setPinnedMessage(null);
          }
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [stream.id, pinnedMessage?.id]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    if (stream.slow_mode) {
      const now = Date.now();
      const elapsed = (now - lastMessageTime.current) / 1000;
      if (elapsed < stream.slow_mode_interval) {
        Alert.alert('Slow Mode', `Please wait ${Math.ceil(stream.slow_mode_interval - elapsed)} seconds before sending another message.`);
        return;
      }
    }
    const messageText = input.trim();
    setInput('');
    setShowEmojis(false);
    setReplyTo(null);
    lastMessageTime.current = Date.now();
    try {
      await sendChatMessage(stream.id, user.id, messageText, replyTo?.id);
    } catch (e) {
      setInput(messageText);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleDelete = (messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChatMessage(messageId);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete message.');
          }
        },
      },
    ]);
  };

  const handlePin = async (message: ChatMessageWithProfile) => {
    try {
      if (message.is_pinned) {
        await pinChatMessage(message.id, false);
        setPinnedMessage(null);
      } else {
        if (pinnedMessage) {
          await pinChatMessage(pinnedMessage.id, false);
        }
        await pinChatMessage(message.id, true);
        setPinnedMessage(message);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pin message.');
    }
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const renderMessage = ({ item }: { item: ChatMessageWithProfile }) => {
    const isOwn = item.user_id === user?.id;
    const profile = item.profiles;
    const isReply = !!item.parent_id;
    const parentMsg = messages.find((m) => m.id === item.parent_id);

    return (
      <Animated.View entering={SlideInRight.duration(200)} style={styles.messageWrapper}>
        {isReply && parentMsg && (
          <View style={styles.replyPreview}>
            <Text style={styles.replyText} numberOfLines={1}>
              Replying to {parentMsg.profiles?.full_name || 'User'}: {parentMsg.body}
            </Text>
          </View>
        )}
        <View style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageAuthor} numberOfLines={1}>
                {profile?.full_name || 'Unknown User'}
              </Text>
              {profile?.is_admin && <Shield size={12} color={Colors.primary} fill={Colors.primary} />}
              {stream.creator_id === item.user_id && <Crown size={12} color="#FFD700" fill="#FFD700" />}
              {item.is_moderator && <Text style={styles.modBadge}>MOD</Text>}
              {item.is_super_chat && (
                <View style={styles.superChatBadge}>
                  <Text style={styles.superChatText}>SUPER</Text>
                </View>
              )}
            </View>
            <Text style={styles.messageBody}>{item.body}</Text>
          </View>
          {canModerate && !isOwn && (
            <View style={styles.moderatorActions}>
              <TouchableOpacity onPress={() => handlePin(item)} style={styles.modBtn}>
                <Pin size={14} color={item.is_pinned ? Colors.primary : Colors.text.muted} fill={item.is_pinned ? Colors.primary : 'transparent'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.modBtn}>
                <Trash2 size={14} color={Colors.status.error} />
              </TouchableOpacity>
            </View>
          )}
          {!canModerate && isOwn && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.modBtn}>
              <Trash2 size={14} color={Colors.status.error} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {pinnedMessage && (
        <View style={styles.pinnedBar}>
          <Pin size={14} color={Colors.primary} fill={Colors.primary} />
          <Text style={styles.pinnedText} numberOfLines={1}>
            {pinnedMessage.body}
          </Text>
          {canModerate && (
            <TouchableOpacity onPress={() => handlePin(pinnedMessage)}>
              <X size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading chat...</Text>
          ) : (
            <Text style={styles.emptyText}>Be the first to chat!</Text>
          )
        }
      />

      {showEmojis && (
        <View style={styles.emojiBar}>
          {EMOJIS.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => addEmoji(emoji)} style={styles.emojiBtn}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {replyTo && (
        <View style={styles.replyBar}>
          <Text style={styles.replyBarText} numberOfLines={1}>
            Replying to {replyTo.profiles?.full_name || 'User'}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <X size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      )}

      {canChat ? (
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={() => setShowEmojis(!showEmojis)} style={styles.emojiToggle}>
            <Smile size={22} color={Colors.text.muted} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Send a message..."
            placeholderTextColor={Colors.text.muted}
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} disabled={!input.trim()} style={styles.sendBtn}>
            <Send size={18} color={input.trim() ? Colors.primary : Colors.text.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.lockedChat}>
          <Text style={styles.lockedText}>
            {stream.subscriber_only_chat ? 'Subscribe to chat' : 'Chat is disabled'}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pinnedText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  listContent: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  messageWrapper: { marginBottom: Spacing.sm },
  replyPreview: {
    marginLeft: 28,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  replyText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  ownMessageRow: {},
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  messageContent: { flex: 1 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  messageAuthor: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.secondary },
  modBadge: { fontSize: 9, fontWeight: FontWeights.bold, color: '#06B6D4', backgroundColor: 'rgba(6, 182, 212, 0.15)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  superChatBadge: { backgroundColor: '#FFD700', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  superChatText: { fontSize: 9, fontWeight: FontWeights.bold, color: '#000' },
  messageBody: { fontSize: FontSizes.sm, color: Colors.text.primary, lineHeight: 20 },
  moderatorActions: { flexDirection: 'row', gap: 4 },
  modBtn: { padding: 4 },
  emptyText: { textAlign: 'center', color: Colors.text.muted, fontSize: FontSizes.sm, paddingVertical: Spacing.lg },
  emojiBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  emojiBtn: { padding: Spacing.xs },
  emojiText: { fontSize: 24 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.05)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBarText: { fontSize: FontSizes.xs, color: Colors.text.muted, flex: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  emojiToggle: { padding: 4 },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: { padding: Spacing.sm },
  lockedChat: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lockedText: { fontSize: FontSizes.sm, color: Colors.text.muted },
});
