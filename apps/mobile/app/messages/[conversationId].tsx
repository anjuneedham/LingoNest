import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import {
  blockUser,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  reportEntity,
  sendMessage,
} from '@/services/messages';
import { useSessionStore } from '@/store/session';

/**
 * A conversation thread.
 *
 * `messages_insert`'s RLS policy is the real gate on who may send here (a
 * blocked pair, a minor outside a booking-scoped thread) — this screen
 * surfaces whatever it returns rather than re-deciding those rules itself.
 */
export default function Thread() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useSessionStore((s) => s.profile);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', profile?.id],
    queryFn: () => fetchConversations(profile!.id),
    enabled: Boolean(profile?.id),
  });
  const conversation = conversationsQuery.data?.ok
    ? conversationsQuery.data.value.find((c) => c.id === conversationId)
    : null;

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: Boolean(conversationId),
    refetchInterval: 10_000,
  });

  const messages = messagesQuery.data?.ok ? messagesQuery.data.value : [];

  useEffect(() => {
    if (profile?.id && conversationId) void markConversationRead(conversationId, profile.id);
  }, [profile?.id, conversationId, messages.length]);

  async function send() {
    const body = input.trim();
    if (!body || !profile?.id) return;
    setSending(true);
    const result = await sendMessage(conversationId, profile.id, body);
    setSending(false);
    if (result.ok) {
      setInput('');
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations', profile.id] });
    } else {
      Alert.alert(t('common.somethingWentWrong'), t(result.error.messageKey, { defaultValue: t('error.unknown') }));
    }
  }

  function confirmBlock() {
    if (!conversation || !profile?.id) return;
    Alert.alert(t('community.blockConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.block'),
        style: 'destructive',
        onPress: () => void blockUser(profile.id, conversation.otherUserId),
      },
    ]);
  }

  function confirmReport() {
    if (!conversation || !profile?.id) return;
    Alert.alert(t('community.reportConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.report'),
        onPress: () => {
          void reportEntity(profile.id, 'user', conversation.otherUserId, 'reported_from_thread');
          Alert.alert(t('community.reported'));
        },
      },
    ]);
  }

  return (
    <Screen
      scroll={false}
      loading={messagesQuery.isLoading}
      error={messagesQuery.data && !messagesQuery.data.ok ? messagesQuery.data.error : null}
      onRetry={() => void messagesQuery.refetch()}
      padded={false}
    >
      <Stack.Screen options={{ title: conversation?.otherDisplayName ?? '' }} />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          padding: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Button label={t('community.report')} onPress={confirmReport} variant="ghost" size="small" />
        <Button label={t('community.block')} onPress={confirmBlock} variant="ghost" size="small" />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {messages.map((message) => {
          const mine = message.senderId === profile?.id;
          return (
            <View
              key={message.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                marginBottom: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: mine ? theme.primaryMuted : theme.surfaceMuted,
              }}
            >
              <Text variant="body">{message.redacted ? t('messages.redacted') : message.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('messages.placeholder')}
            placeholderTextColor={theme.textMuted}
            multiline
            accessibilityLabel={t('messages.placeholder')}
            style={[
              type('body'),
              {
                flex: 1,
                maxHeight: 120,
                minHeight: 48,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.background,
                color: theme.text,
                marginRight: spacing.sm,
              },
            ]}
          />
          <Button
            label={t('messages.send')}
            onPress={() => void send()}
            disabled={!input.trim() || sending}
            loading={sending}
            size="small"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
