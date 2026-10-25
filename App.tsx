import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_INFERENCE_SETTINGS, generateLocalReply, getContextTokenCount, getInputTokenCount, loadLocalModel, unloadLocalModel, type ContextSize, type InferenceSettings, type ReasoningMode } from './src/services/localInference';
import { cancelModelDownload, deleteInstalledModel, downloadModel, formatBytes, getInstalledModelPath, getModelDownloadState, ModelDownloadCancelledError, models, type ModelDefinition } from './src/services/models';
import { MessageContent } from './src/components/MessageContent';
import { WelcomeHome } from './src/components/WelcomeHome';
import { ProviderGroup, groupModelsByProvider } from './src/components/ProviderGroup';
import { PaperclipIcon } from './src/components/PaperclipIcon';
import { messagesForInference, migrateChatAttachments, persistTextAttachment, readTextAttachment, type TextAttachment } from './src/services/textAttachments';
import { createChatId, ensureChatUuid } from './src/services/chatIds';
import { pickTextDocument } from './src/services/documentPicker';
import { chatHistoryLabels, restoreChatMetadata } from './src/services/chatHistory';
import { AppThemeProvider, useAppTheme, type ThemeColors } from './src/theme/AppTheme';
import { useSystemPromptSettings } from './src/hooks/useSystemPromptSettings';
import { SystemPromptSettings } from './src/components/SystemPromptSettings';
import { AppInfo } from './src/components/AppInfo';
import { ChatModelSelector } from './src/components/ChatModelSelector';
import { NavigationDrawer } from './src/components/NavigationDrawer';

type Screen = 'home' | 'chat' | 'models' | 'settings' | 'info';
type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string; attachments?: TextAttachment[] };
type Chat = { id: string; title: string; messages: Message[]; createdAt?: number; updatedAt?: number; systemPrompt?: string };
type ModelStatus = 'checking' | 'paused' | 'not-installed' | 'downloading' | 'installed' | 'loading' | 'ready' | 'error';

const APP_VERSION = 'v0.3.9';
const MODEL_GROUPS = groupModelsByProvider(models);
const STORAGE_KEY = '@phone-gpt/chats';
const INFERENCE_SETTINGS_KEY = '@phone-gpt/inference-settings';
const OUTPUT_TOKEN_OPTIONS: InferenceSettings['maxTokens'][] = [192, 384, 512, 768];
const CONTEXT_SIZE_OPTIONS: ContextSize[] = [1024, 2048, 4096];
const REASONING_OPTIONS: { value: ReasoningMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'short', label: 'Short' },
  { value: 'extended', label: 'Extended' },
];

export default function App() {
  return <AppThemeProvider><SafeAreaProvider><PhoneGptApp /></SafeAreaProvider></AppThemeProvider>;
}

function PhoneGptApp() {
  const promptSettings = useSystemPromptSettings();
  const { colors, isDark, ready: themeReady, setDarkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const messageListRef = useRef<ScrollView>(null);
  const messageInputRef = useRef<TextInput>(null);
  const refocusAfterGeneration = useRef(false);
  const selectedModelRef = useRef<ModelDefinition>(models[0]);
  const downloadingModelIds = useRef(new Set<string>());
  const downloadProgressByModel = useRef(new Map<string, number>());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const switchingChatModel = useRef(false);
  const [isSwitchingChatModel, setIsSwitchingChatModel] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [message, setMessage] = useState('');
  const [attachedText, setAttachedText] = useState<TextAttachment | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [draftChatId, setDraftChatId] = useState(createChatId);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking');
  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(models[0]);
  const [expandedModelId, setExpandedModelId] = useState(models[0].id);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInFlight = useRef(false);
  const [streamingReply, setStreamingReply] = useState<{ chatId: string; message: Message } | null>(null);
  const [inferenceSettings, setInferenceSettings] = useState<InferenceSettings>(DEFAULT_INFERENCE_SETTINGS);
  const [contextTokens, setContextTokens] = useState(0);
  // Async recovery must never replace a user operation or an active context.
  const recoveryRevision = useRef(0);
  const liveModelState = useRef({ modelStatus, isGenerating });
  liveModelState.current = { modelStatus, isGenerating };

  const handleBackPress = useCallback(() => {
    if (modelSelectorOpen) { setModelSelectorOpen(false); return true; }
    if (!drawerOpen && screen === 'home') return false;
    Keyboard.dismiss();
    refocusAfterGeneration.current = false;
    if (drawerOpen) {
      setDrawerOpen(false);
      setScreen('chat');
    } else {
      setScreen(screen === 'chat' ? 'home' : 'chat');
    }
    return true;
  }, [drawerOpen, screen, modelSelectorOpen]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (savedChats) => {
        if (!savedChats) return;
        const restored = (JSON.parse(savedChats) as Chat[]).map(restoreChatMetadata).map(ensureChatUuid);
        // Preserve a conversation if storage is temporarily unavailable; retry
        // its legacy attachment migration on the next launch.
        setChats(await Promise.all(restored.map((chat) => migrateChatAttachments(chat).catch(() => chat))));
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    if (historyLoaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chats)).catch(() => undefined);
  }, [chats, historyLoaded]);

  useEffect(() => {
    AsyncStorage.getItem(INFERENCE_SETTINGS_KEY)
      .then((savedSettings) => { if (savedSettings) setInferenceSettings({ ...DEFAULT_INFERENCE_SETTINGS, ...(JSON.parse(savedSettings) as Partial<InferenceSettings>) }); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(INFERENCE_SETTINGS_KEY, JSON.stringify(inferenceSettings)).catch(() => undefined);
  }, [inferenceSettings]);

  useEffect(() => {
    let active = true;
    let checking = false;
    const model = selectedModel;
    const canRecover = () => active && selectedModelRef.current.id === model.id
      && !downloadingModelIds.current.has(model.id)
      && !liveModelState.current.isGenerating
      && !['ready', 'loading'].includes(liveModelState.current.modelStatus);
    const recover = async () => {
      if (checking || !canRecover()) return;
      checking = true;
      const revision = recoveryRevision.current;
      const isCurrent = () => canRecover() && revision === recoveryRevision.current;
      try {
        // Query the task first: a partially downloaded file is not installed.
        const state = await getModelDownloadState(model);
        if (!isCurrent()) return;
        if (['pending', 'running', 'paused'].includes(state.status)) {
          setModelPath(null);
          setModelProgress(Math.max(0, Math.min(1, state.progress)));
          setModelError(null);
          setModelStatus(state.status === 'paused' ? 'paused' : 'downloading');
        } else if (state.status === 'failed') {
          setModelPath(null);
          setModelProgress(0);
          setModelError(state.error ?? 'The model download failed. Please try again.');
          setModelStatus('error');
        } else {
          const path = await getInstalledModelPath(model);
          if (!isCurrent()) return;
          setModelPath(path);
          setModelProgress(path ? 1 : 0);
          setModelError(null);
          setModelStatus(path ? 'installed' : 'not-installed');
        }
      } catch (error) {
        if (isCurrent()) {
          setModelStatus('error');
          setModelError(error instanceof Error ? error.message : 'Could not check the model download.');
        }
      } finally {
        checking = false;
      }
    };
    if (downloadingModelIds.current.has(model.id)) {
      setModelPath(null);
      setModelStatus('downloading');
      setModelProgress(downloadProgressByModel.current.get(model.id) ?? 0);
    } else {
      void recover();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recover();
    });
    const timer = (modelStatus === 'downloading' || modelStatus === 'paused') ? setInterval(() => {
      if (AppState.currentState === 'active') void recover();
    }, 2000) : undefined;
    return () => {
      active = false;
      subscription.remove();
      if (timer) clearInterval(timer);
    };
  }, [selectedModel, modelStatus === 'downloading' || modelStatus === 'paused']);

  useEffect(() => () => { void unloadLocalModel(); }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
  }, [currentChat?.messages.length, isGenerating]);

  // Android ignores focus requests while the disabled composer is still being
  // committed. Wait for the enabled render, then focus the native TextInput.
  useEffect(() => {
    if (isGenerating || !refocusAfterGeneration.current) return;
    refocusAfterGeneration.current = false;
    const timer = setTimeout(() => messageInputRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [isGenerating]);

  useEffect(() => {
    let active = true;
    void messagesForInference(currentChat?.messages ?? []).then(getContextTokenCount)
      .then((count) => { if (active) setContextTokens(count); })
      .catch(() => { if (active) setContextTokens(0); });
    return () => { active = false; };
  }, [currentChat?.messages, modelStatus]);

  const go = (next: Screen) => { setModelSelectorOpen(false); setScreen(next); setDrawerOpen(false); };
  const newChat = () => { setCurrentChat(null); setDraftChatId(createChatId()); setMessage(''); setAttachedText(null); go('chat'); };

  const pickTextFile = async () => {
    if (isGenerating || isPickingFile) return;
    setIsPickingFile(true);
    try {
      const result = await pickTextDocument();
      if (!result.canceled) setAttachedText(await readTextAttachment(result.assets[0]));
    } catch (error) {
      Alert.alert('Could not attach text file', error instanceof Error ? error.message : 'Please choose a .txt file.');
    } finally {
      setIsPickingFile(false);
    }
  };

  const selectModel = async (model: ModelDefinition) => {
    setExpandedModelId((current) => current === model.id ? '' : model.id);
    if (model.id === selectedModel.id || isGenerating || modelStatus === 'loading' || switchingChatModel.current) return;
    recoveryRevision.current += 1;
    await unloadLocalModel();
    selectedModelRef.current = model;
    setSelectedModel(model);
    setModelPath(null);
    setModelProgress(0);
    setModelError(null);
    setModelStatus('checking');
  };

  const loadModel = async (model: ModelDefinition, path: string, contextSize = inferenceSettings.contextSize) => {
    recoveryRevision.current += 1;
    const isStillSelected = () => selectedModelRef.current.id === model.id;
    if (isStillSelected()) {
      setModelStatus('loading');
      setModelProgress(0);
      setModelError(null);
    }
    try {
      await loadLocalModel(model, path, contextSize, (progress) => { if (isStillSelected()) setModelProgress(progress); });
      if (isStillSelected()) {
        setModelStatus('ready');
        setModelProgress(1);
        setScreen('chat');
      }
    } catch (error) {
      if (isStillSelected()) {
        setModelStatus('error');
        setModelError(error instanceof Error ? error.message : 'The model could not be loaded.');
      }
    }
  };

  const switchChatModel = async (model: ModelDefinition) => {
    if (switchingChatModel.current || isGenerating || modelStatus === 'loading') return;
    if (selectedModelRef.current.id === model.id && modelStatus === 'ready') return;
    switchingChatModel.current = true;
    setIsSwitchingChatModel(true);
    try {
      // Recheck before unloading: a stale list must never trigger a download.
      const state = await getModelDownloadState(model);
      const path = ['pending', 'running', 'paused', 'failed'].includes(state.status)
        ? null : await getInstalledModelPath(model);
      if (!path) throw new Error('This model is no longer available. Check it on the Models page.');
      recoveryRevision.current += 1;
      setModelStatus('loading');
      setModelProgress(0);
      setModelError(null);
      await unloadLocalModel();
      selectedModelRef.current = model;
      setSelectedModel(model);
      setExpandedModelId(model.id);
      setModelPath(path);
      // Keep the current conversation and composer intact when changing models.
      await loadModel(model, path);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Could not switch models.';
      if (liveModelState.current.modelStatus === 'loading') {
        setModelStatus('error');
        setModelError(description);
      }
      Alert.alert('Could not switch model', description);
    } finally {
      switchingChatModel.current = false;
      setIsSwitchingChatModel(false);
    }
  };

  const downloadAndLoadModel = async () => {
    const modelToDownload = selectedModel;
    if (downloadingModelIds.current.has(modelToDownload.id)) return;
    const isStillSelected = () => selectedModelRef.current.id === modelToDownload.id;
    recoveryRevision.current += 1;
    downloadingModelIds.current.add(modelToDownload.id);
    downloadProgressByModel.current.set(modelToDownload.id, 0);
    setModelStatus('downloading');
    setModelProgress(0);
    setModelError(null);
    try {
      const path = await downloadModel(modelToDownload, (progress) => {
        downloadProgressByModel.current.set(modelToDownload.id, progress);
        if (isStillSelected()) setModelProgress(progress);
      });
      // The download owns `modelToDownload`, so browsing another card cannot
      // cancel it. If the user moved on, leave it installed for later loading.
      if (!isStillSelected() || switchingChatModel.current) return;
      setModelPath(path);
      setModelStatus('installed');
      await loadModel(modelToDownload, path);
    } catch (error) {
      if (isStillSelected()) {
        if (error instanceof ModelDownloadCancelledError) {
          setModelStatus('not-installed');
          setModelError(null);
        } else {
          setModelStatus('error');
          setModelError(error instanceof Error ? error.message : 'The model download failed.');
        }
      }
    } finally {
      downloadingModelIds.current.delete(modelToDownload.id);
      downloadProgressByModel.current.delete(modelToDownload.id);
    }
  };

  const removeModel = async () => {
    recoveryRevision.current += 1;
    await unloadLocalModel();
    const modelToRemove = selectedModel;
    await deleteInstalledModel(modelToRemove);
    setModelPath(null);
    setModelProgress(0);
    setModelStatus('not-installed');
  };

  const cancelDownload = async () => {
    recoveryRevision.current += 1;
    const modelToCancel = selectedModel;
    const wasCancelled = await cancelModelDownload(modelToCancel);
    if (!wasCancelled || selectedModelRef.current.id !== modelToCancel.id) return;
    setModelPath(null);
    setModelProgress(0);
    setModelError(null);
    setModelStatus('not-installed');
  };

  const saveChat = (updatedChat: Chat, activate = true) => {
    const now = Date.now();
    updatedChat = { ...updatedChat, createdAt: updatedChat.createdAt ?? now, updatedAt: now };
    setChats((items) => {
      const existing = items.some((chat) => chat.id === updatedChat.id);
      return existing ? items.map((chat) => chat.id === updatedChat.id ? updatedChat : chat) : [updatedChat, ...items];
    });
    setCurrentChat((current) => activate || current?.id === updatedChat.id ? updatedChat : current);
  };

  const send = async () => {
    const cleanMessage = message.trim();
    if ((!cleanMessage && !attachedText) || generationInFlight.current || isGenerating || isPickingFile || switchingChatModel.current || !promptSettings.ready) return;
    if (modelStatus !== 'ready') {
      Alert.alert('Model not ready', 'Choose a downloaded model above, or download one from Menu → Models.');
      return;
    }
    generationInFlight.current = true;
    setIsGenerating(true);

    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', content: cleanMessage, ...(attachedText ? { attachments: [attachedText] } : {}) };
    const nextChat: Chat = currentChat
      ? { ...currentChat, messages: [...currentChat.messages, userMessage] }
      : { id: draftChatId, title: draftChatId, messages: [userMessage], createdAt: Date.now(), systemPrompt: promptSettings.savedPrompt };

    // Validate hidden prompts and files without saving an oversized request.
    if (attachedText || nextChat.systemPrompt?.trim()) {
      try {
        const tokens = await getInputTokenCount(await messagesForInference(nextChat.messages), inferenceSettings, nextChat.systemPrompt);
        if (tokens + inferenceSettings.maxTokens + 192 > inferenceSettings.contextSize) {
          Alert.alert('Message exceeds available context', 'Use a shorter system prompt or file, start a fresh chat, or increase Conversation context in Models.');
          generationInFlight.current = false;
          setIsGenerating(false);
          return;
        }
        if (attachedText) userMessage.attachments = [await persistTextAttachment(attachedText, nextChat.id, userMessage.id)];
      } catch (error) {
        Alert.alert('Could not prepare message', error instanceof Error ? error.message : 'Please try again.');
        generationInFlight.current = false;
        setIsGenerating(false);
        return;
      }
    }

    saveChat(nextChat);
    setMessage('');
    setAttachedText(null);
    setIsGenerating(true);
    const assistantId = `${Date.now()}-assistant`;
    let partialReply = '';
    let streamTimer: ReturnType<typeof setTimeout> | undefined;
    const publishReply = () => {
      streamTimer = undefined;
      setStreamingReply({ chatId: nextChat.id, message: { id: assistantId, role: 'assistant', content: partialReply } });
    };
    try {
      // `nextChat.messages` is the full transcript for this one chat. It is
      // persisted as JSON in AsyncStorage and sent again with every new turn.
      const conversationForModel = await messagesForInference(nextChat.messages);
      const response = await generateLocalReply(conversationForModel, inferenceSettings, nextChat.systemPrompt, (text) => {
        const firstChunk = !partialReply;
        partialReply = text;
        // Show the first chunk immediately; batch subsequent native events so
        // markdown layout remains responsive without writing storage per token.
        if (firstChunk) publishReply();
        else if (!streamTimer) streamTimer = setTimeout(publishReply, 50);
      });
      saveChat({ ...nextChat, messages: [...nextChat.messages, { id: assistantId, role: 'assistant', content: response }] }, false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown local inference error.';
      const partialMessages: Message[] = partialReply ? [{ id: assistantId, role: 'assistant', content: partialReply }] : [];
      saveChat({ ...nextChat, messages: [...nextChat.messages, ...partialMessages, { id: `${Date.now()}-error`, role: 'assistant', content: `I could not generate a reply: ${reason}` }] }, false);
    } finally {
      if (streamTimer) clearTimeout(streamTimer);
      setStreamingReply(null);
      generationInFlight.current = false;
      refocusAfterGeneration.current = true;
      setIsGenerating(false);
    }
  };

  const modelButton = () => {
    if (modelStatus === 'not-installed' || modelStatus === 'error') return <Pressable onPress={downloadAndLoadModel} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Download {formatBytes(selectedModel.sizeBytes)}</Text></Pressable>;
    if (modelStatus === 'installed' && modelPath) return <Pressable onPress={() => loadModel(selectedModel, modelPath)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Load model</Text></Pressable>;
    if (modelStatus === 'downloading' || modelStatus === 'paused') return <View style={styles.downloadRow}><Text style={styles.modelStatus}>{modelStatus === 'paused' ? 'Waiting for network' : 'Downloading'} {Math.round(modelProgress * 100)}%</Text><Pressable accessibilityLabel="Cancel model download" hitSlop={10} onPress={() => { void cancelDownload(); }} style={styles.cancelButton}><Text style={styles.cancelText}>×</Text></Pressable></View>;
    if (modelStatus === 'loading') return <Text style={styles.modelStatus}>Loading {Math.round(modelProgress * 100)}%</Text>;
    if (modelStatus === 'ready') return <View style={styles.readyRow}><Text style={styles.readyText}>Ready for offline chat</Text><Pressable onPress={removeModel}><Text style={styles.deleteText}>Delete</Text></Pressable></View>;
    return <Text style={styles.modelStatus}>Checking installed models…</Text>;
  };

  const inferenceControlsDisabled = isGenerating || isSwitchingChatModel || modelStatus === 'loading' || modelStatus === 'checking';
  const modelControls = <View style={styles.modelControls}>
    <Text style={styles.controlLabel}>Reasoning</Text>
    <Text style={styles.controlHint}>How much thinking to request. Support varies by model.</Text>
    <View style={styles.choiceRow}>{REASONING_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: inferenceSettings.reasoningMode === option.value, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => setInferenceSettings((current) => ({ ...current, reasoningMode: option.value }))} style={[styles.choiceButton, inferenceSettings.reasoningMode === option.value && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.reasoningMode === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>
    <Text style={styles.controlLabel}>Maximum reply length</Text>
    <Text style={styles.controlHint}>Measured in tokens, not words. Longer replies take more time.</Text>
    <View style={styles.choiceRow}>{OUTPUT_TOKEN_OPTIONS.map((tokens) => <Pressable key={tokens} accessibilityRole="button" accessibilityLabel={`${tokens} reply tokens`} accessibilityState={{ selected: inferenceSettings.maxTokens === tokens, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => setInferenceSettings((current) => ({ ...current, maxTokens: tokens }))} style={[styles.choiceButton, inferenceSettings.maxTokens === tokens && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.maxTokens === tokens && styles.choiceTextActive]}>{tokens}</Text></Pressable>)}</View>
    <Text style={styles.controlLabel}>Conversation context</Text>
    <View style={styles.choiceRow}>{CONTEXT_SIZE_OPTIONS.map((tokens) => <Pressable key={tokens} accessibilityRole="button" accessibilityLabel={`${tokens} context tokens`} accessibilityState={{ selected: inferenceSettings.contextSize === tokens, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => {
      setInferenceSettings((current) => ({ ...current, contextSize: tokens }));
      if (modelPath && modelStatus === 'ready') void loadModel(selectedModel, modelPath, tokens);
    }} style={[styles.choiceButton, inferenceSettings.contextSize === tokens && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.contextSize === tokens && styles.choiceTextActive]}>{tokens}</Text></Pressable>)}</View>
    <Text style={styles.controlHint}>Context is the chat the model can remember at once. Changing it reloads the model. Larger windows use more phone memory.</Text>
    {inferenceControlsDisabled && <Text accessibilityLiveRegion="polite" style={styles.controlHint}>Options are available when the model finishes its current task.</Text>}
  </View>;

  const usedContextTokens = Math.min(inferenceSettings.contextSize, contextTokens);
  const contextPercent = Math.min(100, Math.round((usedContextTokens / inferenceSettings.contextSize) * 100));
  const visibleMessages = currentChat
    ? [...currentChat.messages, ...(streamingReply?.chatId === currentChat.id ? [streamingReply.message] : [])]
    : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {screen === 'home' && <SimpleScreen title="PhoneGPT" onMenu={() => setDrawerOpen(true)}><WelcomeHome version={APP_VERSION} onChat={() => go('chat')} onModels={() => go('models')} /></SimpleScreen>}
        {screen === 'chat' && <View style={styles.screen}>
          <View style={styles.topBar}><Pressable accessibilityLabel="Open menu" hitSlop={10} onPress={() => { setModelSelectorOpen(false); setDrawerOpen(true); }} style={styles.iconButton}><Text style={styles.menuIcon}>☰</Text></Pressable><View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}><Text selectable style={{ color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{currentChat?.id ?? draftChatId}</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose downloaded model" accessibilityState={{ expanded: modelSelectorOpen, disabled: isGenerating || modelStatus === 'loading' || isSwitchingChatModel }} disabled={isGenerating || modelStatus === 'loading' || isSwitchingChatModel} onPress={() => { Keyboard.dismiss(); setModelSelectorOpen((open) => !open); }} style={{ minHeight: 44, justifyContent: 'center', opacity: isGenerating || modelStatus === 'loading' || isSwitchingChatModel ? 0.5 : 1 }}><Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 12 }}>{modelStatus === 'ready' ? selectedModel.displayName : modelStatus === 'loading' || isSwitchingChatModel ? `Loading ${selectedModel.displayName}…` : 'Choose downloaded model'} {modelSelectorOpen ? '▴' : '▾'}</Text></Pressable></View></View>
          <ChatModelSelector open={modelSelectorOpen} onClose={() => setModelSelectorOpen(false)} onSelect={switchChatModel} loadedModelId={modelStatus === 'ready' ? selectedModel.id : undefined} />
          {modelError && <Text accessibilityRole="alert" style={[styles.errorText, { marginHorizontal: 18, marginBottom: 8 }]}>{modelError}</Text>}
          {modelStatus === 'ready' && currentChat && <>
          <View style={styles.contextBanner}><View style={styles.contextHeading}><Text style={styles.contextText}>Conversation: ~{usedContextTokens.toLocaleString()} / {inferenceSettings.contextSize.toLocaleString()} tokens</Text><Text style={styles.contextPercent}>{contextPercent}%</Text></View><View style={styles.contextTrack}><View style={[styles.contextFill, { width: `${contextPercent}%` }]} /></View><Text style={styles.contextHint}>Current chat only · reply limit: {inferenceSettings.maxTokens} tokens</Text></View></>}
          <ScrollView ref={messageListRef} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={[styles.chatArea, currentChat && styles.messagesArea]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => messageListRef.current?.scrollToEnd({ animated: !isGenerating })}>
            {!currentChat && <Text style={styles.versionText}>PhoneGPT {APP_VERSION}</Text>}
            {visibleMessages.map((item) => <View key={item.id} style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><View style={{ minWidth: 0, maxWidth: '100%' }}>{item.attachments?.map((file, index) => <Text key={`${file.name}-${index}`} selectable style={[styles.attachmentText, { color: item.role === 'user' ? colors.userText : colors.secondary, marginBottom: 6 }]}>📄 {file.name}</Text>)}<MessageContent content={item.content} color={item.role === 'user' ? colors.userText : colors.text} /></View></View>)}
            {isGenerating && <Text style={styles.generatingText}>Generating locally…</Text>}
          </ScrollView>
          <View style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom, 12) }]}>{attachedText && <View style={styles.attachmentRow}><Text numberOfLines={1} style={[styles.attachmentText, { flexShrink: 1 }]}>{attachedText.name}</Text><Pressable accessibilityLabel="Remove text attachment" disabled={isGenerating || isPickingFile} onPress={() => setAttachedText(null)}><Text style={styles.attachmentRemove}>×</Text></Pressable></View>}<View style={[styles.composer, isGenerating && styles.composerBusy]} pointerEvents={isGenerating ? 'none' : 'auto'}>
            <Pressable accessibilityRole="button" accessibilityLabel="Attach text file" accessibilityHint="Choose a .txt file up to 32 KB" disabled={isGenerating || isPickingFile} onPress={() => { void pickTextFile(); }} style={[styles.imageButton, (isGenerating || isPickingFile) && styles.imageButtonDisabled]}><PaperclipIcon /></Pressable>
            <TextInput ref={messageInputRef} value={message} onChangeText={setMessage} placeholder={isPickingFile ? 'Reading text file…' : isGenerating ? 'Generating locally…' : modelStatus === 'ready' ? 'Ask PhoneGPT' : 'Download a model from Menu → Models'} placeholderTextColor={colors.muted} keyboardAppearance={isDark ? 'dark' : 'light'} style={styles.input} multiline textAlignVertical="center" editable={!isGenerating && !isPickingFile} />
            <Pressable accessibilityLabel="Send message" disabled={(!message.trim() && !attachedText) || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading'} onPress={send} style={[styles.sendButton, ((!message.trim() && !attachedText) || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading') && styles.sendButtonDisabled]}><Text style={styles.sendIcon}>↑</Text></Pressable>
          </View></View>
        </View>}
        {screen === 'models' && <SimpleScreen title="Models" onMenu={() => setDrawerOpen(true)}><ScrollView style={styles.modelScroll} contentContainerStyle={styles.modelList}><Text style={styles.sectionLabel}>Available models</Text>{MODEL_GROUPS.map((group) => <ProviderGroup key={group.name} name={group.name} count={group.models.length} initiallyExpanded={group.models.some((model) => model.id === selectedModel.id)}>{group.models.map((model) => <View key={model.id} style={[styles.catalogCard, selectedModel.id === model.id && styles.catalogCardSelected]}><Pressable onPress={() => { void selectModel(model); }}><View style={styles.catalogHeader}><Text style={styles.modelName}>{model.displayName}</Text>{selectedModel.id === model.id && <Text style={styles.selectedText}>Selected</Text>}</View><Text style={styles.catalogProvider}>{model.provider}</Text><Text style={styles.catalogDetail}>{model.capabilities.join(' · ')} · {formatBytes(model.sizeBytes)}</Text><Text style={styles.expandText}>{expandedModelId === model.id ? 'Hide options ▲' : 'Show options ▼'}</Text></Pressable>{expandedModelId === model.id && selectedModel.id === model.id && <View style={styles.modelExpansion}>{modelButton()}{modelControls}{modelError && <Text style={styles.errorText}>{modelError}</Text>}</View>}</View>)}</ProviderGroup>)}</ScrollView></SimpleScreen>}
        {screen === 'settings' && <SimpleScreen title="Settings" onMenu={() => setDrawerOpen(true)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}><View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Dark mode</Text><Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 5 }}>Use a darker appearance throughout PhoneGPT.</Text></View><Switch accessibilityLabel="Dark mode" value={isDark} onValueChange={setDarkMode} disabled={!themeReady} trackColor={{ false: colors.track, true: colors.primary }} thumbColor={isDark ? colors.onPrimary : '#FFFFFF'} ios_backgroundColor={colors.track} /></View><Text style={{ color: colors.muted, fontSize: 12, marginTop: 14 }}>Your appearance preference is saved on this device.</Text><SystemPromptSettings settings={promptSettings} /><View style={{ marginTop: 28 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Generation preferences</Text><Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 6 }}>Saved on this device and shared with the options on the Models page.</Text>{modelControls}</View></ScrollView></SimpleScreen>}
        {screen === 'info' && <SimpleScreen title="App Info" onMenu={() => setDrawerOpen(true)}><ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}><AppInfo version={APP_VERSION} /></ScrollView></SimpleScreen>}
        <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onRequestClose={() => { handleBackPress(); }}><SafeAreaView edges={['top', 'bottom', 'left']} style={styles.drawer}>
          <View style={styles.drawerTop}><Text style={styles.drawerTitle}>PhoneGPT</Text><Pressable accessibilityLabel="Close menu" hitSlop={10} onPress={() => setDrawerOpen(false)}><Text style={styles.closeIcon}>×</Text></Pressable></View>
          <Pressable onPress={() => go('home')} style={styles.navItem}><Text style={styles.navText}>Home</Text></Pressable><Pressable onPress={newChat} style={styles.navItem}><Text style={styles.navText}>Chat</Text></Pressable><Pressable onPress={() => go('models')} style={styles.navItem}><Text style={styles.navText}>Models</Text></Pressable><Pressable onPress={() => go('settings')} style={styles.navItem}><Text style={styles.navText}>Settings</Text></Pressable><Pressable onPress={() => go('info')} style={styles.navItem}><Text style={styles.navText}>App Info</Text></Pressable>
          <View style={styles.divider} /><Text style={styles.historyHeading}>Chat History</Text><ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>{chats.map((chat) => {
            const labels = chatHistoryLabels(chat);
            return <Pressable key={chat.id} accessibilityRole="button" accessibilityLabel={`${labels.title}, ${labels.date}, ${labels.time}`} onPress={() => { setCurrentChat(chat); setAttachedText(null); setMessage(''); go('chat'); }} style={styles.historyItem}><View style={styles.dot} /><Text numberOfLines={1} style={styles.historyText}>{labels.title}</Text><View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 3 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{labels.date}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{labels.time}</Text></View></Pressable>;
          })}</ScrollView>
        </SafeAreaView></NavigationDrawer>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function SimpleScreen({ title, onMenu, children }: { title: string; onMenu: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.screen}><View style={styles.topBar}><Pressable accessibilityLabel="Open menu" hitSlop={10} onPress={onMenu} style={styles.iconButton}><Text style={styles.menuIcon}>☰</Text></Pressable><Text style={styles.title}>{title}</Text></View><View style={styles.pageContent}>{children}</View></View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, keyboardContainer: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.background },
  topBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 }, menuIcon: { color: colors.text, fontSize: 25, lineHeight: 28 }, title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' }, modelBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 34, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface }, modelStatusDot: { width: 7, height: 7, borderRadius: 4 }, modelStatusDotReady: { backgroundColor: colors.success }, modelStatusDotInactive: { backgroundColor: colors.muted }, modelBannerText: { flex: 1, color: colors.secondary, fontSize: 13, fontWeight: '600' }, contextBanner: { paddingHorizontal: 18, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.background }, contextHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, contextText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextPercent: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.track }, contextFill: { height: '100%', borderRadius: 2, backgroundColor: colors.fill }, contextHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  chatArea: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18, justifyContent: 'center' }, messagesArea: { justifyContent: 'flex-start' }, versionText: { alignSelf: 'center', color: colors.muted, fontSize: 13, fontWeight: '600' }, generatingText: { alignSelf: 'flex-start', color: colors.secondary, fontSize: 14, fontWeight: '600', marginVertical: 8 }, messageBubble: { maxWidth: '92%', minWidth: 0, flexShrink: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 }, userBubble: { alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: colors.userBubble, borderBottomRightRadius: 4 }, assistantBubble: { alignSelf: 'flex-start', width: '92%', backgroundColor: colors.assistantBubble, borderBottomLeftRadius: 4 }, messageText: { color: colors.text, fontSize: 16, lineHeight: 22 }, userMessageText: { color: colors.userText },
  composerWrap: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.background }, attachmentRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6, backgroundColor: colors.raised, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 }, attachmentText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, attachmentRemove: { color: colors.error, fontSize: 19, lineHeight: 19 }, composer: { minHeight: 56, maxHeight: 124, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.raised, borderRadius: 20, paddingLeft: 6, paddingRight: 6, paddingVertical: 6 }, composerBusy: { opacity: 0.55 }, imageButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, imageButtonDisabled: { opacity: 0.3 }, input: { flex: 1, alignSelf: 'stretch', color: colors.text, fontSize: 16, maxHeight: 104, paddingTop: 10, paddingBottom: 10 }, sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, sendButtonDisabled: { backgroundColor: colors.disabled }, sendIcon: { color: colors.onPrimary, fontSize: 22, fontWeight: '700', marginTop: -2 },
  drawer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 }, drawerTop: { height: 68, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, drawerTitle: { color: colors.text, fontSize: 23, fontWeight: '800' }, closeIcon: { color: colors.text, fontSize: 30, lineHeight: 30 }, navItem: { paddingVertical: 13 }, navText: { color: colors.text, fontSize: 17, fontWeight: '600' }, divider: { height: 1, backgroundColor: colors.border, marginTop: 18, marginBottom: 22 }, historyHeading: { color: colors.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 11 }, historyList: { paddingBottom: 24, gap: 4 }, historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted }, historyText: { flex: 1, color: colors.secondary, fontSize: 15 },
  pageContent: { flex: 1, padding: 20 }, modelScroll: { flex: 1, marginHorizontal: -20 }, modelList: { padding: 20, gap: 10, paddingBottom: 36 }, sectionLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }, catalogCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.background }, catalogCardSelected: { borderColor: colors.text, borderWidth: 2 }, catalogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, catalogProvider: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginTop: 4 }, catalogDetail: { color: colors.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 }, expandText: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginTop: 12 }, modelExpansion: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 }, modelCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 }, modelName: { color: colors.text, fontSize: 16, fontWeight: '700' }, modelDetail: { color: colors.secondary, fontSize: 14, marginTop: 5, marginBottom: 16 }, modelStatus: { color: colors.secondary, fontSize: 14 }, downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cancelButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.errorSurface, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.error, fontSize: 22, lineHeight: 25 }, primaryButton: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, primaryButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' }, readyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 }, readyText: { color: colors.success, fontSize: 14, fontWeight: '700' }, deleteText: { color: colors.error, fontSize: 14, fontWeight: '700' }, modelControls: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 18, paddingTop: 16 }, controlLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, choiceButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background }, choiceButtonActive: { borderColor: colors.text, backgroundColor: colors.primary }, choiceText: { color: colors.secondary, fontSize: 13, fontWeight: '700' }, choiceTextActive: { color: colors.onPrimary }, controlHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -5 }, errorText: { color: colors.error, fontSize: 13, marginTop: 12 }, placeholderText: { color: colors.secondary, fontSize: 16 },
});
