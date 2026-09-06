import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/api';
import { speak } from '@/services/audio';
import { speechTagFor } from '@/services/speech';
import { useLearningStore } from '@/store/learning';
import { track } from '@/services/analytics';

/**
 * AI conversation practice.
 *
 * The learner is judged on whether they achieved the scenario's goals, not on
 * matching a script, so the goals are visible throughout and tick off as they
 * are met. Corrections appear as a separate note rather than interrupting the
 * character — a partner who stops to correct grammar ends the conversation.
 */
export default function Conversation() {
  const { scenarioKey } = useLocalSearchParams<{ scenarioKey: string }>();
  const { theme, spacing, radius, type } = useTheme();
  const { t } = useTranslation();
  const languageCode = useLearningStore((s) => s.languageCode) ?? 'es';
  const variantCode = useLearningStore((s) => s.variantCode);
  const scrollRef = useRef<ScrollView>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [achieved, setAchieved] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [limitReached, setLimitReached] = useState<{ used: number; limit: number } | null>(null);

  const scenarioQuery = useQuery({
    queryKey: ['scenario', scenarioKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_scenarios')
        .select('key, title, setting, partner_role, learner_role, goals, opening_line, cefr')
        .eq('key', scenarioKey)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(scenarioKey),
  });

  const scenario = scenarioQuery.data;

  const send = async (text: string) => {
    if (busy) return;
    setBusy(true);
    setInput('');

    if (text.trim()) {
      setTurns((current) => [...current, { role: 'learner', text }]);
    }

    const result = await callFunction<ConversationReply>('ai-conversation', {
      sessionId: sessionId ?? undefined,
      scenarioKey,
      languageCode,
      text,
    });

    setBusy(false);

    if (!result.ok) {
      if (result.error.code === 'ai_not_configured') {
        setNotConfigured(true);
        return;
      }
      if (result.error.code === 'ai_limit_reached') {
        setLimitReached({ used: 0, limit: 0 });
        return;
      }
      setTurns((current) => [
        ...current,
        { role: 'system', text: t(result.error.messageKey, { defaultValue: t('error.unknown') }) },
      ]);
      return;
    }

    const reply = result.value;
    if (!sessionId) {
      setSessionId(reply.sessionId);
      setGoals(reply.goals);
      track('ai_practice_started', {
        kind: 'conversation',
        cefr: (scenario?.cefr ?? 'A1') as never,
        scenarioKey,
      });
    }

    setTurns((current) => [
      ...current,
      {
        role: 'partner',
        text: reply.reply,
        translation: reply.translation,
        correction: reply.correction,
      },
    ]);
    setAchieved(reply.goalsAchieved);

    if (reply.conversationComplete) {
      setComplete(true);
      track('ai_practice_completed', {
        kind: 'conversation',
        cefr: (scenario?.cefr ?? 'A1') as never,
        turns: turns.length + 1,
        goalsAchieved: reply.goalsAchieved.length,
        durationMs: 0,
      });
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Kick the scenario off with an empty turn so the character speaks first.
  React.useEffect(() => {
    if (scenario && !sessionId && !busy && turns.length === 0 && !notConfigured) {
      void send('');
    }
  }, [scenario, sessionId, busy, turns.length, notConfigured]);

  if (scenarioQuery.isLoading) return <Screen loading />;
  if (!scenario) return <Screen empty={{ title: t('error.not_found') }} />;

  if (notConfigured) {
    return (
      <Screen>
        <Card>
          <Badge label={t('common.notConfigured')} tone="warning" glyph="!" />
          <Text variant="body" style={{ marginTop: spacing.md }}>
            {t('ai.notConfigured')}
          </Text>
          <Button
            label={t('common.back')}
            onPress={() => router.back()}
            variant="secondary"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      </Screen>
    );
  }

  if (limitReached) {
    return (
      <Screen>
        <Card>
          <Text variant="heading">{t('ai.limitTitle')}</Text>
          <Text variant="body" color="muted" style={{ marginTop: spacing.sm }}>
            {t('ai.limitBody', { used: limitReached.used, limit: limitReached.limit })}
          </Text>
          <Button
            label={t('paywall.title')}
            onPress={() => router.push('/paywall')}
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text variant="subheading">{scenario.title}</Text>
        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
          {scenario.setting}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
          {goals.map((goal) => (
            <Badge
              key={goal}
              label={goal}
              tone={achieved.includes(goal) ? 'success' : 'neutral'}
              glyph={achieved.includes(goal) ? '✓' : '○'}
            />
          ))}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg }}>
        {turns.map((turn, index) => (
          <TurnBubble
            key={`${turn.role}-${index}`}
            turn={turn}
            languageCode={languageCode}
            variantCode={variantCode}
          />
        ))}
        {busy ? (
          <Text variant="body" color="muted" style={{ marginTop: spacing.md }}>
            {t('ai.thinking')}
          </Text>
        ) : null}
      </ScrollView>

      {complete ? (
        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text variant="subheading" align="center">
            {t('ai.goalsAchieved', { achieved: achieved.length, total: goals.length })}
          </Text>
          <Button
            label={t('common.done')}
            onPress={() => router.back()}
            fullWidth
            size="large"
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
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
              placeholder={t('ai.typeMessage')}
              placeholderTextColor={theme.textMuted}
              multiline
              accessibilityLabel={t('ai.typeMessage')}
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
              label={t('ai.send')}
              onPress={() => void send(input)}
              disabled={!input.trim() || busy}
              size="small"
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

interface Turn {
  role: 'learner' | 'partner' | 'system';
  text: string;
  translation?: string;
  correction?: { learnerSaid: string; better: string; why: string } | null;
}

interface ConversationReply {
  sessionId: string;
  reply: string;
  translation: string;
  correction: { learnerSaid: string; better: string; why: string } | null;
  goals: string[];
  goalsAchieved: string[];
  conversationComplete: boolean;
}

function TurnBubble({
  turn,
  languageCode,
  variantCode,
}: {
  turn: Turn;
  languageCode: string;
  variantCode: string | null;
}) {
  const { theme, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [showTranslation, setShowTranslation] = useState(false);

  if (turn.role === 'system') {
    return (
      <Text variant="caption" color="danger" align="center" style={{ marginVertical: spacing.md }}>
        {turn.text}
      </Text>
    );
  }

  const isLearner = turn.role === 'learner';

  return (
    <View style={{ marginBottom: spacing.md, alignItems: isLearner ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: isLearner ? theme.primaryMuted : theme.surface,
          borderWidth: isLearner ? 0 : 1,
          borderColor: theme.border,
        }}
      >
        <Text variant="body" targetLanguage={languageCode}>
          {turn.text}
        </Text>

        {!isLearner && turn.translation ? (
          <>
            <Text
              variant="caption"
              color="primary"
              onPress={() => setShowTranslation((value) => !value)}
              style={{ marginTop: spacing.sm }}
              accessibilityRole="button"
            >
              {showTranslation ? t('ai.hideTranslation') : t('ai.showTranslation')}
            </Text>
            {showTranslation ? (
              <Text variant="small" color="muted" style={{ marginTop: spacing.xs }}>
                {turn.translation}
              </Text>
            ) : null}
          </>
        ) : null}

        {!isLearner ? (
          <Text
            variant="caption"
            color="muted"
            onPress={() => void speak(turn.text, speechTagFor(languageCode, variantCode))}
            style={{ marginTop: spacing.xs }}
            accessibilityRole="button"
            accessibilityLabel={t('activity.playModel')}
          >
            {`♪ ${t('activity.playModel')}`}
          </Text>
        ) : null}
      </View>

      {/* Corrections sit outside the bubble so the character stays in character. */}
      {turn.correction ? (
        <View
          style={{
            marginTop: spacing.xs,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: theme.warningMuted,
            maxWidth: '85%',
          }}
        >
          <Text variant="caption" color="muted">
            {t('ai.correctionNote')}
          </Text>
          <Text variant="small" targetLanguage={languageCode} style={{ marginTop: 2 }}>
            {turn.correction.better}
          </Text>
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {turn.correction.why}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
