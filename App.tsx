import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_INFERENCE_SETTINGS, GenerationStoppedError, generateLocalReply, effectiveSystemPrompt, shouldSearchWithLocalModel, getContextTokenCount, getTextTokenCount, getInputTokenCount, loadLocalModel, unloadLocalModel, type InferenceSettings, type ReasoningMode } from './src/services/localInference';
import { cancelModelDownload, deleteInstalledModel, downloadModel, formatBytes, getInstalledModelPath, getModelDownloadState, ModelDownloadCancelledError, models, type ModelDefinition, type ModelDownloadState } from './src/services/models';
import { MessageContent } from './src/components/MessageContent';
import { AppIcon } from './src/components/AppIcon';
import { WelcomeHome } from './src/components/WelcomeHome';
import { ProviderGroup, groupModelsByProvider } from './src/components/ProviderGroup';
import { PaperclipIcon } from './src/components/PaperclipIcon';
import { messagesForInference, migrateChatAttachments, persistTextAttachment, readTextAttachment, type TextAttachment } from './src/services/textAttachments';
import { createChatId, ensureChatUuid } from './src/services/chatIds';
import { startNewConversation } from './src/services/chatNavigation';
import { pickTextDocument } from './src/services/documentPicker';
import { conversationTitle, restoreChatMetadata } from './src/services/chatHistory';
import { AppThemeProvider, useAppTheme, type ThemeColors } from './src/theme/AppTheme';
import { useSystemPromptSettings } from './src/hooks/useSystemPromptSettings';
import { AppInfo } from './src/components/AppInfo';
import { ChatModelSelector } from './src/components/ChatModelSelector';
import { useVoiceTyping } from './src/hooks/useVoiceTyping';
import { appendTranscript } from './src/services/voice';
import { VoiceModels } from './src/components/VoiceModels';
import { MicrophoneIcon } from './src/components/MicrophoneIcon';
import { useLastLoadedModel } from './src/hooks/useLastLoadedModel';
import { AudioLevelMeter } from './src/components/AudioLevelMeter';
import { LiveDraftEditor } from './src/services/liveDraft';
import { FontScaleProvider } from './src/theme/FontScale';
import { DownloadControls } from './src/components/DownloadControls';
import { NewChatButton } from './src/components/NewChatButton';
import { removeChatFiles } from './src/services/deleteChat';
import { ChatExport } from './src/components/ChatExport';
import { TokenLimitControl } from './src/components/TokenLimitControl';
import { availableReplyTokens, MIN_CONTEXT_TOKENS, MIN_REPLY_TOKENS, UNKNOWN_CONTEXT_LIMIT, normalizeTokenSettings, replyLimit } from './src/services/tokenLimits';
import { WEB_SEARCH_FEATURE_ENABLED, restoreWebPreference } from './src/config/webSearch';
import { classifyWebQuery, explicitlyRequestsWebSearch, searchWeb, WebSearchRateLimitError, type SearchRateLimitDetails } from './src/services/webSearch';
import { validateWebCitationMarkers } from './src/services/webCitations';
import { fitWebEvidence } from './src/services/webGrounding';
import type { WebSearchProvenance } from './src/services/webSearchTypes';
import { WebSearchControls } from './src/components/WebSearchControls';
import { WebSources } from './src/components/WebSources';
import { SEARCH_LIMIT_FALLBACK_PROMPT, searchLimitNotice } from './src/services/searchFallback';
import { resolveWebUsage, webUsageTotal, type WebContextUsage, type WebTurnUsage } from './src/services/webContextUsage';
import { WebSearchOverlay } from './src/components/WebSearchOverlay';
import { SearchDecision, type SearchDecisionState } from './src/components/SearchDecision';
import { CONTROL, controlSurface } from './src/theme/controlStyles';
import { ChatsScreen } from './src/components/ChatsScreen';
import { BottomTabs } from './src/components/BottomTabs';
import { SettingsContent } from './src/components/SettingsContent';
import { ActionButton, DownloadStatus } from './src/components/UiKit';
import { ScaledText as Text, ScaledTextInput } from './src/components/ScaledText';

type Screen = 'home' | 'chats' | 'chat' | 'models' | 'settings' | 'info';
type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string; attachments?: TextAttachment[]; web?: WebSearchProvenance; contextUsage?: WebContextUsage; searchDecision?: SearchDecisionState; searchLimit?: SearchRateLimitDetails };
type Chat = { id: string; title: string; messages: Message[]; createdAt?: number; updatedAt?: number; systemPrompt?: string; modelId?: string; origin?: 'dev' | 'production' };
type ModelStatus = 'checking' | 'paused' | 'not-installed' | 'downloading' | 'installed' | 'loading' | 'ready' | 'error';

const APP_VERSION = 'v0.5.12';
const MODEL_GROUPS = groupModelsByProvider(models);
const STORAGE_KEY = '@phone-gpt/chats';
const INFERENCE_SETTINGS_KEY = '@phone-gpt/inference-settings';
const WEB_PREFERENCE_KEY = '@phone-gpt/web-search-enabled';
const WEB_DISCLOSURE_KEY = '@phone-gpt/web-search-disclosure-v1';
const REASONING_OPTIONS: { value: ReasoningMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'short', label: 'Short' },
  { value: 'extended', label: 'Extended' },
];

export default function App() {
  return <AppThemeProvider><FontScaleProvider><SafeAreaProvider><PhoneGptApp /></SafeAreaProvider></FontScaleProvider></AppThemeProvider>;
}

function PhoneGptApp() {
  const lastLoaded = useLastLoadedModel();
  const promptSettings = useSystemPromptSettings();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const messageListRef = useRef<ScrollView>(null);
  const followLatest = useRef(true);
  const readingWithGesture = useRef(false);
  const pendingSendScroll = useRef(false);
  const lastScrollGeometry = useRef<{ y: number; height: number; viewport: number } | null>(null);
  const messageInputRef = useRef<TextInput>(null);
  const refocusAfterGeneration = useRef(false);
  const selectedModelRef = useRef<ModelDefinition>(models[0]);
  const downloadingModelIds = useRef(new Set<string>());
  const downloadProgressByModel = useRef(new Map<string, number>());
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const switchingChatModel = useRef(false);
  const [isSwitchingChatModel, setIsSwitchingChatModel] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [message, setMessage] = useState('');
  const draftRef = useRef(message);
  draftRef.current = message;
  const liveDraft = useRef(new LiveDraftEditor());
  const editMessage = (text: string) => {
    liveDraft.current.edit(draftRef.current, text);
    draftRef.current = text;
    setMessage(text);
  };
  const [attachedText, setAttachedText] = useState<TextAttachment | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const currentChatRef = useRef(currentChat);
  currentChatRef.current = currentChat;
  const chatDeletionInFlight = useRef(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const historyWrites = useRef<Promise<void>>(Promise.resolve());
  const persistHistory = useCallback((snapshot: Chat[]) => {
    const write = historyWrites.current.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)));
    historyWrites.current = write;
    return write;
  }, []);
  const conversationDrafts = useRef(new Map<string, { message: string; attachedText: TextAttachment | null }>());
  const [draftChatId, setDraftChatId] = useState(createChatId);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('checking');
  const [downloadState, setDownloadState] = useState<ModelDownloadState>({ status: 'none', progress: 0 });
  const [selectedModel, setSelectedModel] = useState<ModelDefinition>(models[0]);
  const [expandedModelId, setExpandedModelId] = useState('');
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInFlight = useRef(false);
  const webRequestActive = useRef(false);
  const generationAbort = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [webPreferenceReady, setWebPreferenceReady] = useState(false);
  const [webDisclosureSeen, setWebDisclosureSeen] = useState(false);
  const webDisclosureShowing = useRef(false);
  const [searchLimitForTurn, setSearchLimitForTurn] = useState<{ chatId: string; userId: string; details: SearchRateLimitDetails } | null>(null);
  const [webPhase, setWebPhase] = useState<'idle' | 'deciding' | 'searching' | 'generating'>('idle');
  useEffect(() => {
    let active = true;
    if (!WEB_SEARCH_FEATURE_ENABLED) { setWebPreferenceReady(true); return; }
    Promise.all([AsyncStorage.getItem(WEB_PREFERENCE_KEY), AsyncStorage.getItem(WEB_DISCLOSURE_KEY)]).then(([value, seen]) => {
      if (active) { setWebEnabled(restoreWebPreference(value)); setWebDisclosureSeen(seen === 'true'); }
    }).catch(() => undefined).finally(() => { if (active) setWebPreferenceReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!WEB_SEARCH_FEATURE_ENABLED || !webPreferenceReady || !webEnabled || webDisclosureSeen || screen !== 'chat' || webDisclosureShowing.current) return;
    webDisclosureShowing.current = true;
    Alert.alert('Web search', 'Search queries are sent online. Replies are generated on your phone. You can turn Web off at any time.', [{
      text: 'Got it', onPress: () => {
        setWebDisclosureSeen(true);
        // Keep the notice dismissed for this session even if storage is unavailable.
        void AsyncStorage.setItem(WEB_DISCLOSURE_KEY, 'true').catch(() => undefined);
        webDisclosureShowing.current = false;
      },
    }], { cancelable: false });
  }, [webPreferenceReady, webEnabled, webDisclosureSeen, screen]);
  const toggleWebSearch = () => {
    if (!WEB_SEARCH_FEATURE_ENABLED || !webPreferenceReady || generationInFlight.current) return;
    const enabled = !webEnabled;
    AsyncStorage.setItem(WEB_PREFERENCE_KEY, String(enabled)).then(() => setWebEnabled(enabled)).catch(() => Alert.alert('Could not save search preference', 'Please try again.'));
  };
  const [streamingReply, setStreamingReply] = useState<{ chatId: string; message: Message } | null>(null);
  const [inferenceSettings, setInferenceSettings] = useState<InferenceSettings>(DEFAULT_INFERENCE_SETTINGS);
  const [contextTokens, setContextTokens] = useState(0);
  const [webTurnUsage, setWebTurnUsage] = useState<WebTurnUsage | null>(null);
  const [modelLimits, setModelLimits] = useState<{ modelId: string; maxContextTokens: number | null } | null>(null);
  const [inferenceSettingsReady, setInferenceSettingsReady] = useState(false);
  const voice = useVoiceTyping(`${screen}:${currentChat?.id ?? draftChatId}`, (text, liveId) => {
    const next = liveId ? liveDraft.current.update(draftRef.current, liveId, text) : appendTranscript(draftRef.current, text);
    draftRef.current = next;
    setMessage(next);
    refocusAfterGeneration.current = true;
  });
  useEffect(() => {
    if (screen === 'models') setExpandedModelId('');
  }, [screen]);
  // Fast Refresh can retain a loaded selection removed by a rollout flag.
  useEffect(() => {
    if (models.some(model => model.id === selectedModel.id)) return;
    generationAbort.current?.abort();
    selectedModelRef.current = models[0];
    setSelectedModel(models[0]);
    setModelStatus('checking');
    setModelPath(null);
    void unloadLocalModel().catch(() => undefined);
  }, [selectedModel.id]);
  // Async recovery must never replace a user operation or an active context.
  const recoveryRevision = useRef(0);
  const liveModelState = useRef({ modelStatus, isGenerating });
  liveModelState.current = { modelStatus, isGenerating };

  const openChatExport = () => {
    if (isGenerating || voice.busy || isPickingFile || isDeletingChat || !historyLoaded) return;
    Keyboard.dismiss();
    setModelSelectorOpen(false);
    setExportOpen(true);
  };
  const handleBackPress = useCallback(() => {
    if (exportOpen) { setExportOpen(false); return true; }
    if (modelSelectorOpen) { setModelSelectorOpen(false); return true; }
    if (screen === 'home') return false;
    if (webRequestActive.current && generationInFlight.current) generationAbort.current?.abort();
    Keyboard.dismiss();
    refocusAfterGeneration.current = false;
    setScreen(screen === 'info' ? 'settings' : screen === 'chat' ? 'chats' : 'home');
    return true;
  }, [screen, modelSelectorOpen, exportOpen]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (savedChats) => {
        if (!savedChats) return;
        const restored = (JSON.parse(savedChats) as Chat[]).map(restoreChatMetadata).map(ensureChatUuid).map(chat => ({ ...chat, title: conversationTitle(chat) }));
        // Preserve a conversation if storage is temporarily unavailable; retry
        // its legacy attachment migration on the next launch.
        setChats(await Promise.all(restored.map((chat) => migrateChatAttachments(chat).catch(() => chat))));
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    if (historyLoaded) void persistHistory(chats).catch(() => undefined);
  }, [chats, historyLoaded, persistHistory]);

  useEffect(() => {
    AsyncStorage.getItem(INFERENCE_SETTINGS_KEY)
      .then((savedSettings) => { if (savedSettings) {
        const saved = JSON.parse(savedSettings);
        setInferenceSettings(normalizeTokenSettings({ ...DEFAULT_INFERENCE_SETTINGS, ...saved, reasoningMode: ['off', 'short', 'extended'].includes(saved.reasoningMode) ? saved.reasoningMode : 'off' }, Number.MAX_SAFE_INTEGER));
      } })
      .catch(() => undefined).finally(() => setInferenceSettingsReady(true));
  }, []);

  useEffect(() => {
    if (inferenceSettingsReady) AsyncStorage.setItem(INFERENCE_SETTINGS_KEY, JSON.stringify(inferenceSettings)).catch(() => undefined);
  }, [inferenceSettings, inferenceSettingsReady]);

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
        setDownloadState(state);
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

  const scrollToLatest = useCallback(() => {
    if (followLatest.current && !readingWithGesture.current) {
      messageListRef.current?.scrollToEnd({ animated: false });
    }
  }, []);

  const updateScrollPosition = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = { y: contentOffset.y, height: contentSize.height, viewport: layoutMeasurement.height };
    const previous = lastScrollGeometry.current;
    lastScrollGeometry.current = next;
    const gap = Math.max(0, next.height - next.viewport - next.y);
    // A previous fling/layout event must not cancel the scroll requested by
    // Send. A fresh touch/drag/wheel/keyboard gesture explicitly cancels it.
    if (pendingSendScroll.current) {
      if (gap <= 24) pendingSendScroll.current = false;
      return;
    }
    // Layout/markdown/keyboard changes can move the offset without user intent.
    // Wheel and accessibility scrolling, however, may never emit native drag events.
    const stableLayout = previous && Math.abs(next.height - previous.height) <= 1 && Math.abs(next.viewport - previous.viewport) <= 1;
    if (previous && (stableLayout || readingWithGesture.current)) {
      if (next.y < previous.y - 1) followLatest.current = false;
      else if (next.y > previous.y + 1 && gap <= 24) followLatest.current = true;
    }
    if (readingWithGesture.current && gap > 24) followLatest.current = false;
  }, []);
  const pauseFollowing = useCallback(() => {
    pendingSendScroll.current = false;
    readingWithGesture.current = true;
    followLatest.current = false;
  }, []);

  useEffect(() => {
    followLatest.current = true;
    readingWithGesture.current = false;
    lastScrollGeometry.current = null;
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [currentChat?.id, scrollToLatest]);

  // Keep the existing post-response focus behavior, after the response render
  // and any voice operation have settled.
  useEffect(() => {
    if (isGenerating || voice.busy || exportOpen || screen !== 'chat' || !refocusAfterGeneration.current) return;
    refocusAfterGeneration.current = false;
    const timer = setTimeout(() => messageInputRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [isGenerating, voice.busy, exportOpen, screen]);

  useEffect(() => {
    let active = true;
    void messagesForInference(currentChat?.messages ?? []).then(getContextTokenCount)
      .then((count) => { if (active) setContextTokens(count); })
      .catch(() => { if (active) setContextTokens(0); });
    return () => { active = false; };
  }, [currentChat?.messages, modelStatus]);

  useEffect(() => {
    return () => { if (WEB_SEARCH_FEATURE_ENABLED) generationAbort.current?.abort(); };
  }, []);

  const go = (next: Screen) => { if (webRequestActive.current && generationInFlight.current) generationAbort.current?.abort(); Keyboard.dismiss(); refocusAfterGeneration.current = false; setExportOpen(false); setModelSelectorOpen(false); setScreen(next); };
  const rememberDraft = () => conversationDrafts.current.set(currentChat?.id ?? draftChatId, { message: draftRef.current, attachedText });
  const openConversation = (chat: Chat) => {
    if (voice.busy || isPickingFile || isDeletingChat || isSwitchingChatModel || (generationInFlight.current && currentChat?.id !== chat.id)) return;
    if (currentChat?.id !== chat.id) {
      rememberDraft();
      const draft = conversationDrafts.current.get(chat.id);
      setCurrentChat(chat);
      draftRef.current = draft?.message ?? '';
      setMessage(draft?.message ?? '');
      setAttachedText(draft?.attachedText ?? null);
    }
    go('chat');
  };
  const newChat = () => {
    if (isGenerating || voice.busy || isSwitchingChatModel || isPickingFile) return;
    rememberDraft();
    const state = { currentChat, draftChatId, message, attachedText };
    const next = startNewConversation(state, createChatId);
    if (next !== state) {
      setCurrentChat(next.currentChat);
      setDraftChatId(next.draftChatId);
      draftRef.current = next.message;
      setMessage(next.message);
      setAttachedText(next.attachedText);
    }
    go('chat');
  };

  const deleteChat = async (chat: Chat) => {
    if (!historyLoaded || chatDeletionInFlight.current || generationInFlight.current || voice.busy || isPickingFile) {
      throw new Error('Wait for the current operation to finish before deleting a chat.');
    }
    if (!chatsRef.current.some((item) => item.id === chat.id)) return;
    chatDeletionInFlight.current = true;
    setIsDeletingChat(true);
    try {
      if (Platform.OS !== 'web') await removeChatFiles(chat.id);
      const remaining = chatsRef.current.filter((item) => item.id !== chat.id);
      // Await durable deletion, behind older queued history writes, before
      // removing the row from UI or reporting success.
      await persistHistory(remaining);
      chatsRef.current = remaining;
      setChats(remaining);
      conversationDrafts.current.delete(chat.id);
      if (currentChatRef.current?.id === chat.id) {
        currentChatRef.current = null;
        setCurrentChat(null);
        setDraftChatId(createChatId());
        draftRef.current = '';
        setMessage('');
        setAttachedText(null);
        setScreen('chats');
      }
    } finally {
      chatDeletionInFlight.current = false;
      setIsDeletingChat(false);
    }
  };

  const pickTextFile = async () => {
    if (isGenerating || isPickingFile || voice.busy) return;
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
    if (model.id === selectedModel.id || isGenerating || voice.isActive() || voice.busy || modelStatus === 'loading' || switchingChatModel.current) return;
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
      const limits = await loadLocalModel(model, path, contextSize, (progress) => { if (isStillSelected()) setModelProgress(progress); });
      if (isStillSelected()) {
        setModelLimits({ modelId: model.id, maxContextTokens: limits.maxContextTokens });
        setInferenceSettings(current => normalizeTokenSettings({ ...current, contextSize: limits.contextSize }, limits.maxContextTokens ?? UNKNOWN_CONTEXT_LIMIT));
        lastLoaded.remember(model);
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
    if (switchingChatModel.current || isGenerating || voice.isActive() || voice.busy || modelStatus === 'loading') return;
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
      }, (state) => {
        if (isStillSelected()) setDownloadState(state);
        if (isStillSelected() && ['pending', 'running', 'paused'].includes(state.status)) {
          setModelStatus(state.status === 'paused' ? 'paused' : 'downloading');
        }
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
    if (isGenerating || voice.busy || isSwitchingChatModel || modelStatus === 'loading') return;
    recoveryRevision.current += 1;
    const modelToRemove = selectedModel;
    try {
      await unloadLocalModel();
      // The model is no longer in memory even if deleting the file fails.
      if (selectedModelRef.current.id === modelToRemove.id) setModelStatus('installed');
      await deleteInstalledModel(modelToRemove);
      lastLoaded.forget(modelToRemove.id);
      if (selectedModelRef.current.id !== modelToRemove.id) return;
      setModelPath(null);
      setModelProgress(0);
      setModelError(null);
      setModelStatus('not-installed');
    } catch (error) {
      Alert.alert('Could not delete model', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const cancelDownload = async () => {
    recoveryRevision.current += 1;
    const modelToCancel = selectedModel;
    try {
      const wasCancelled = await cancelModelDownload(modelToCancel);
      if (!wasCancelled || selectedModelRef.current.id !== modelToCancel.id) return;
      setModelPath(null);
      setModelProgress(0);
      setModelError(null);
      setModelStatus('not-installed');
    } catch (error) {
      Alert.alert('Could not cancel download', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const saveChat = (updatedChat: Chat, activate = true) => {
    const now = Date.now();
    updatedChat = { ...updatedChat, title: conversationTitle(updatedChat), createdAt: updatedChat.createdAt ?? now, updatedAt: now };
    setChats((items) => {
      const existing = items.some((chat) => chat.id === updatedChat.id);
      return existing ? items.map((chat) => chat.id === updatedChat.id ? updatedChat : chat) : [updatedChat, ...items];
    });
    setCurrentChat((current) => activate || current?.id === updatedChat.id ? updatedChat : current);
  };

  const stopGeneration = () => {
    if (!generationInFlight.current || !generationAbort.current || generationAbort.current.signal.aborted) return;
    setIsStopping(true);
    generationAbort.current.abort();
  };

  const send = async () => {
    const submittedDraft = message;
    const cleanMessage = submittedDraft.trim();
    const useWebForTurn = WEB_SEARCH_FEATURE_ENABLED && webPreferenceReady && (webEnabled || explicitlyRequestsWebSearch(cleanMessage));
    if ((!cleanMessage && !attachedText) || chatDeletionInFlight.current || generationInFlight.current || voice.isActive() || voice.busy || isGenerating || isPickingFile || switchingChatModel.current || !promptSettings.ready) return;
    if (modelStatus !== 'ready') {
      Alert.alert('Model not ready', 'Choose a downloaded model above, or download one from the Models tab.');
      return;
    }
    generationInFlight.current = true;
    webRequestActive.current = useWebForTurn;
    const controller = new AbortController();
    generationAbort.current = controller;
    setIsStopping(false);
    setSearchLimitForTurn(null);
    setIsGenerating(true);
    setWebPhase(useWebForTurn && cleanMessage ? 'deciding' : 'generating');
    const finishGeneration = () => {
      generationInFlight.current = false;
      webRequestActive.current = false;
      if (generationAbort.current === controller) generationAbort.current = null;
      setIsStopping(false);
      setIsGenerating(false);
      setWebPhase('idle');
      setSearchLimitForTurn(null);
      setWebTurnUsage(null);
    };

    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', content: cleanMessage, ...(useWebForTurn && cleanMessage ? { searchDecision: 'checking' as const } : {}), ...(attachedText ? { attachments: [attachedText] } : {}) };
    let nextChat: Chat = currentChat
      ? { ...currentChat, modelId: selectedModel.id, messages: [...currentChat.messages, userMessage] }
      : { id: draftChatId, title: conversationTitle({ messages: [userMessage] }), modelId: selectedModel.id, messages: [userMessage], createdAt: Date.now(), systemPrompt: promptSettings.savedPrompt, origin: __DEV__ ? 'dev' : 'production' };

    let turnSettings = inferenceSettings;
    // Count every input, including the hidden prompt and attached file content.
    {
      try {
        const tokens = await getInputTokenCount(await messagesForInference(nextChat.messages), turnSettings, nextChat.systemPrompt);
        if (controller.signal.aborted) { finishGeneration(); return; }
        const maxTokens = availableReplyTokens(turnSettings.contextSize, tokens, turnSettings.maxTokens);
        if (maxTokens < 1) {
          Alert.alert('Message exceeds available context', 'Use a shorter system prompt or file, start a fresh chat, or increase Conversation context in Models.');
          finishGeneration();
          return;
        }
        turnSettings = { ...turnSettings, maxTokens };
        if (attachedText) userMessage.attachments = [await persistTextAttachment(attachedText, nextChat.id, userMessage.id)];
      } catch (error) {
        if (controller.signal.aborted) { finishGeneration(); return; }
        Alert.alert('Could not prepare message', error instanceof Error ? error.message : 'Please try again.');
        finishGeneration();
        return;
      }
    }

    if (controller.signal.aborted) { finishGeneration(); return; }
    followLatest.current = true;
    readingWithGesture.current = false;
    pendingSendScroll.current = true;
    lastScrollGeometry.current = null;
    saveChat(nextChat);
    // Preserve any edits made while asynchronous file/prompt validation ran.
    if (draftRef.current === submittedDraft) draftRef.current = '';
    setMessage((current) => current === submittedDraft ? '' : current);
    conversationDrafts.current.delete(nextChat.id);
    setAttachedText(null);
    // Sending is an explicit request to return to the newest message. Do not
    // depend only on content-height changes (or an earlier drag's follow flag).
    // A gesture after Send wins over this queued frame.
    requestAnimationFrame(scrollToLatest);
    setIsGenerating(true);
    const assistantId = `${Date.now()}-assistant`;
    let partialReply = '';
    let webProvenance: WebSearchProvenance | undefined;
    let searchLimit: SearchRateLimitDetails | undefined;
    let webUsage: WebContextUsage | undefined;
    const usageFields = () => ({ ...(webUsage ? { contextUsage: { ...webUsage } } : {}), ...(searchLimit ? { searchLimit } : {}) });
    let streamTimer: ReturnType<typeof setTimeout> | undefined;
    const publishReply = () => {
      streamTimer = undefined;
      if (webUsage) {
        // Streaming is approximate; re-tokenize the final reply after native generation settles.
        webUsage.outputTokens = Math.ceil(partialReply.length / 4);
        setWebTurnUsage({ chatId: nextChat.id, userId: userMessage.id, usage: { ...webUsage } });
      }
      setStreamingReply({ chatId: nextChat.id, message: { id: assistantId, role: 'assistant', content: partialReply, ...usageFields(), ...(webProvenance ? { web: webProvenance } : {}) } });
    };
    try {
      // `nextChat.messages` is the full transcript for this one chat. It is
      // persisted as JSON in AsyncStorage and sent again with every new turn.
      let conversationForModel = await messagesForInference(nextChat.messages);
      let turnPrompt = nextChat.systemPrompt;
      if (useWebForTurn && cleanMessage) {
        setWebPhase('deciding');
        const decision = classifyWebQuery(cleanMessage);
        const needsSearch = decision === 'search' || (decision === 'ask-model' && await shouldSearchWithLocalModel(cleanMessage, turnSettings, controller.signal));
        if (controller.signal.aborted) throw new GenerationStoppedError('');
        nextChat = { ...nextChat, messages: nextChat.messages.map(item => item.id === userMessage.id ? { ...item, searchDecision: needsSearch ? 'search' : 'local' } : item) };
        saveChat(nextChat, false);
        if (needsSearch) {
          setWebPhase('searching');
          let result;
          try { result = await searchWeb(cleanMessage, { signal: controller.signal }); }
          catch (error) {
            if (controller.signal.aborted || !(error instanceof WebSearchRateLimitError)) throw error;
            searchLimit = error.details;
            nextChat = { ...nextChat, messages: nextChat.messages.map(item => item.id === userMessage.id ? { ...item, searchDecision: 'limited' } : item) };
            saveChat(nextChat, false);
            setSearchLimitForTurn({ chatId: nextChat.id, userId: userMessage.id, details: searchLimit });
            turnPrompt = `${effectiveSystemPrompt(turnSettings, nextChat.systemPrompt)}\n\n${SEARCH_LIMIT_FALLBACK_PROMPT}`;
            const inputTokens = await getInputTokenCount(conversationForModel, turnSettings, turnPrompt);
            const maxTokens = availableReplyTokens(turnSettings.contextSize, inputTokens, turnSettings.maxTokens);
            if (maxTokens < 1) throw new Error('There is not enough conversation space for the local answer. Start a new chat or increase context.');
            turnSettings = { ...turnSettings, maxTokens };
          }
          if (result) {
            const baselineTokens = await getInputTokenCount(conversationForModel, turnSettings, turnPrompt);
            const grounded = await fitWebEvidence(conversationForModel, result, turnSettings, effectiveSystemPrompt(turnSettings, nextChat.systemPrompt), getInputTokenCount, controller.signal);
            if (controller.signal.aborted) throw new GenerationStoppedError('');
            conversationForModel = grounded.messages;
            turnPrompt = grounded.systemPrompt;
            webProvenance = grounded.provenance;
            const inputTokens = await getInputTokenCount(conversationForModel, turnSettings, turnPrompt);
            if (controller.signal.aborted) throw new GenerationStoppedError('');
            webUsage = { modelId: selectedModel.id, contextSize: turnSettings.contextSize, inputTokens, evidenceTokens: Math.max(0, inputTokens - baselineTokens), outputTokens: 0 };
            setWebTurnUsage({ chatId: nextChat.id, userId: userMessage.id, usage: { ...webUsage } });
            const maxTokens = availableReplyTokens(turnSettings.contextSize, inputTokens, turnSettings.maxTokens);
            if (maxTokens < 1) throw new Error('There is not enough conversation space for search results. Start a new chat or increase the conversation context.');
            turnSettings = { ...turnSettings, maxTokens };
          }
        }
      }
      setWebPhase('generating');
      const response = await generateLocalReply(conversationForModel, turnSettings, turnPrompt, (text) => {
        const firstChunk = !partialReply;
        partialReply = webProvenance ? validateWebCitationMarkers(text, webProvenance) : text;
        // Show the first chunk immediately; batch subsequent native events so
        // markdown layout remains responsive without writing storage per token.
        if (firstChunk) publishReply();
        else if (!streamTimer) streamTimer = setTimeout(publishReply, 50);
      }, controller.signal);
      if (webUsage) webUsage.outputTokens = await getTextTokenCount(response).catch(() => Math.ceil(response.length / 4));
      saveChat({ ...nextChat, messages: [...nextChat.messages, { id: assistantId, role: 'assistant', ...usageFields(), content: webProvenance ? validateWebCitationMarkers(response, webProvenance) : response, ...(webProvenance ? { web: webProvenance } : {}) }] }, false);
    } catch (error) {
      if (error instanceof GenerationStoppedError || controller.signal.aborted) {
        const rawText = (error instanceof GenerationStoppedError ? error.partialText : '') || partialReply;
        const text = webProvenance ? validateWebCitationMarkers(rawText, webProvenance) : rawText;
        saveChat({ ...nextChat, messages: [...nextChat.messages, ...(text ? [{ id: assistantId, role: 'assistant' as const, content: text, ...usageFields(), ...(webProvenance ? { web: webProvenance } : {}) }] : [])] }, false);
        return;
      }
      const reason = error instanceof Error ? error.message : 'Unknown local inference error.';
      const partialMessages: Message[] = partialReply ? [{ id: assistantId, role: 'assistant', content: partialReply }] : [];
      saveChat({ ...nextChat, messages: [...nextChat.messages, ...partialMessages, { id: `${Date.now()}-error`, role: 'assistant', ...usageFields(), content: `I could not generate a reply: ${reason}` }] }, false);
    } finally {
      if (streamTimer) clearTimeout(streamTimer);
      setStreamingReply(null);
      refocusAfterGeneration.current = true;
      finishGeneration();
    }
  };

  const modelButton = () => {
    if (modelStatus === 'error' && modelPath) return <View style={{ gap: 10 }}><Text style={styles.modelStatus}>The file is downloaded. Try loading it again, or delete it to download a fresh copy.</Text><View style={styles.readyRow}><ActionButton label="Retry loading" icon="models" onPress={() => { void loadModel(selectedModel, modelPath); }} disabled={voice.busy || isGenerating || isSwitchingChatModel} /><ActionButton label="Delete" danger icon="trash" onPress={() => { void removeModel(); }} disabled={voice.busy || isGenerating || isSwitchingChatModel} /></View></View>;
    if (modelStatus === 'not-installed' || modelStatus === 'error') return <View style={styles.readyRow}><ActionButton label={`${modelStatus === 'error' ? 'Retry download' : 'Download'} · ${formatBytes(selectedModel.sizeBytes)}`} icon="download" onPress={() => { void downloadAndLoadModel(); }} />{modelStatus === 'error' && downloadState.canPause && <ActionButton label="Discard download" danger icon="trash" onPress={() => { void cancelDownload(); }} />}</View>;
    if (modelStatus === 'installed' && modelPath) return <View style={{ gap: 12 }}><Text style={styles.readyText}>Downloaded · ready to load</Text><View style={styles.readyRow}><ActionButton label="Load model" disabled={isGenerating || voice.busy || isSwitchingChatModel} icon="models" onPress={() => { void loadModel(selectedModel, modelPath); }} /><ActionButton label="Delete" danger icon="trash" disabled={isGenerating || voice.busy || isSwitchingChatModel} onPress={() => { void removeModel(); }} /></View></View>;
    if (modelStatus === 'downloading' || modelStatus === 'paused') return <DownloadControls model={selectedModel} state={{ ...downloadState, status: modelStatus === 'paused' ? 'paused' : 'running', progress: modelProgress }} onState={(state) => { setDownloadState(state); setModelProgress(state.progress); setModelStatus(state.status === 'paused' ? 'paused' : 'downloading'); }} onCancel={cancelDownload} />;
    if (modelStatus === 'loading') return <DownloadStatus progress={modelProgress} label="Loading on your phone" />;
    if (modelStatus === 'ready') return <View style={styles.readyRow}><AppIcon name="check" color={colors.success} size={20} /><Text style={[styles.readyText, { flex: 1 }]}>Ready for offline chat</Text><ActionButton label="Delete" danger icon="trash" disabled={isGenerating || voice.busy || isSwitchingChatModel} onPress={() => { void removeModel(); }} /></View>;
    return <Text accessibilityLiveRegion="polite" style={styles.modelStatus}>Checking this device…</Text>;
  };

  const knownContextLimit = modelLimits?.modelId === selectedModel.id ? modelLimits.maxContextTokens : null;
  const contextLimit = knownContextLimit ?? Math.max(UNKNOWN_CONTEXT_LIMIT, inferenceSettings.contextSize);
  const inferenceControlsDisabled = !inferenceSettingsReady || voice.busy || isGenerating || isSwitchingChatModel || modelStatus === 'loading' || modelStatus === 'checking';
  const modelControls = <View style={styles.modelControls}>
    <Text style={styles.controlLabel}>Reasoning</Text>
    <Text style={styles.controlHint}>How much thinking to request. Support varies by model.</Text>
    <View style={styles.choiceRow}>{REASONING_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: inferenceSettings.reasoningMode === option.value, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => setInferenceSettings((current) => ({ ...current, reasoningMode: option.value }))} style={[styles.choiceButton, inferenceControlsDisabled && { opacity: 0.5 }, inferenceSettings.reasoningMode === option.value && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.reasoningMode === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>
    <TokenLimitControl label="Maximum reply length" value={inferenceSettings.maxTokens} min={MIN_REPLY_TOKENS} max={replyLimit(inferenceSettings.contextSize)} presets={[384, 512, 768]} disabled={inferenceControlsDisabled} onChange={maxTokens => setInferenceSettings(current => ({ ...current, maxTokens }))} />
    <Text style={styles.controlHint}>A maximum, not a target. Replies can end earlier. The reply shares the context window with your prompt and messages; available space can shorten it.</Text>
    <TokenLimitControl label="Conversation context" value={inferenceSettings.contextSize} min={MIN_CONTEXT_TOKENS} max={contextLimit} presets={[2048, 4096, 10000, 20000, 32768]} disabled={inferenceControlsDisabled} onChange={contextSize => {
      setInferenceSettings(current => normalizeTokenSettings({ ...current, contextSize }, contextLimit));
      // Keep loading explicit: the old native allocation must not be used with
      // a different saved context budget. Reload only after the Load button.
      if (modelPath && modelStatus === 'ready') setModelStatus('installed');
    }} />
    <Text style={styles.controlHint}>{knownContextLimit ? `Model context limit: ${knownContextLimit.toLocaleString()} tokens.` : 'Model limit unavailable: up to 32,768 tokens can be requested; support is unverified until model metadata is read.'} Saved here. Use Load model to apply a changed context before chatting. Larger windows need more phone memory and may fail to load. Reducing context also reduces an oversized reply limit.</Text>
    {inferenceControlsDisabled && <Text accessibilityLiveRegion="polite" style={styles.controlHint}>Options are available when the model finishes its current task.</Text>}
  </View>;

  const currentWebUsage = resolveWebUsage(currentChat, webTurnUsage, selectedModel.id, inferenceSettings.contextSize);
  const usedContextTokens = Math.min(inferenceSettings.contextSize, currentWebUsage ? webUsageTotal(currentWebUsage) : contextTokens);
  const contextPercent = Math.min(100, Math.round((usedContextTokens / inferenceSettings.contextSize) * 100));
  const visibleMessages = currentChat
    ? [...currentChat.messages, ...(streamingReply?.chatId === currentChat.id ? [streamingReply.message] : [])]
    : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardContainer}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {screen === 'home' && <SimpleScreen title={__DEV__ ? 'PhoneGPT Dev' : 'PhoneGPT'}><WelcomeHome version={APP_VERSION} onChat={newChat} onModels={() => go('models')} /></SimpleScreen>}
        {screen === 'chats' && <ChatsScreen chats={chats} ready={historyLoaded} busy={isGenerating || voice.busy || isPickingFile || isDeletingChat || isSwitchingChatModel} activeChatId={currentChat?.id} onSelect={openConversation} onNewChat={newChat} onModels={() => go('models')} onExport={openChatExport} onDelete={deleteChat} version={APP_VERSION} modelName={id => models.find(model => model.id === id)?.displayName} />}
        {screen === 'chat' && <View style={styles.screen}>
          <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back to chats" hitSlop={10} onPress={() => { handleBackPress(); }} style={styles.iconButton}><AppIcon name="back" color={colors.text} /></Pressable><View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 18 }}>{currentChat ? conversationTitle(currentChat) : 'New chat'}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}><Pressable accessibilityRole="button" accessibilityLabel="Choose downloaded model" accessibilityState={{ expanded: modelSelectorOpen, disabled: voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel }} disabled={voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel} onPress={() => { Keyboard.dismiss(); setModelSelectorOpen((open) => !open); }} style={({ pressed }) => [controlSurface(colors, voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel, pressed), { flexShrink: 1, minWidth: 0 }]} ><Text numberOfLines={1} style={{ color: colors.secondary, ...CONTROL.compactLabel, flexShrink: 1 }}>{modelStatus === 'ready' ? selectedModel.displayName : modelStatus === 'loading' || isSwitchingChatModel ? `Loading ${selectedModel.displayName}…` : 'Choose downloaded model'}</Text><View style={{ transform: [{ rotate: modelSelectorOpen ? '180deg' : '0deg' }] }}><AppIcon name="chevron" color={colors.secondary} size={15} /></View></Pressable>{WEB_SEARCH_FEATURE_ENABLED && <WebSearchControls enabled={webEnabled} onToggle={toggleWebSearch} disabled={!webPreferenceReady || isGenerating || voice.busy} />}</View></View><NewChatButton onPress={newChat} disabled={isGenerating || voice.busy || isSwitchingChatModel} /></View>
          <ChatModelSelector open={modelSelectorOpen} onClose={() => setModelSelectorOpen(false)} onSelect={switchChatModel} loadedModelId={modelStatus === 'ready' ? selectedModel.id : undefined} />
          {lastLoaded.model && modelStatus !== 'ready' && (modelStatus !== 'loading' || selectedModel.id === lastLoaded.model.id) && <View style={{ marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 8 }}>
            <Text style={{ color: colors.secondary, fontSize: 13 }}>{modelStatus === 'loading' || isSwitchingChatModel ? 'Loading model…' : 'No model loaded'}</Text>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{lastLoaded.model.displayName}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Load last model: ${lastLoaded.model.displayName}`} disabled={isGenerating || voice.busy || isSwitchingChatModel || modelStatus === 'loading'} onPress={() => { if (lastLoaded.model) void switchChatModel(lastLoaded.model); }} style={[styles.primaryButton, (isGenerating || voice.busy || isSwitchingChatModel || modelStatus === 'loading') && { opacity: 0.5 }]}>
              <Text style={styles.primaryButtonText}>{modelStatus === 'loading' || isSwitchingChatModel ? `Loading… ${Math.round(modelProgress * 100)}%` : 'Load last model'}</Text>
            </Pressable>
          </View>}
          {modelError && <Text accessibilityRole="alert" style={[styles.errorText, { marginHorizontal: 18, marginBottom: 8 }]}>{modelError}</Text>}
          {modelStatus === 'ready' && currentChat && <>
          <View style={styles.contextBanner}><View style={styles.contextHeading}><Text style={styles.contextText}>Conversation: ~{usedContextTokens.toLocaleString()} / {inferenceSettings.contextSize.toLocaleString()} tokens</Text><Text style={styles.contextPercent}>{contextPercent}%</Text></View><View style={styles.contextTrack}><View style={[styles.contextFill, { width: `${contextPercent}%` }]} /></View><Text style={styles.contextHint}>{currentWebUsage ? `${isGenerating ? 'Web turn' : 'Last web turn'} · includes prompt, sources & reply · web input +${currentWebUsage.evidenceTokens} tokens` : `Current chat only · reply limit: ${inferenceSettings.maxTokens} tokens`}</Text></View></>}
          <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView ref={messageListRef} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={[styles.chatArea, currentChat && styles.messagesArea]} keyboardShouldPersistTaps="handled" onContentSizeChange={scrollToLatest} onLayout={scrollToLatest} scrollEventThrottle={16}
            {...(Platform.OS === 'web' ? {
              onWheel: (event: { nativeEvent?: { deltaY?: number }; deltaY?: number }) => {
                if ((event.nativeEvent?.deltaY ?? event.deltaY ?? 0) < 0) { pendingSendScroll.current = false; followLatest.current = false; }
              },
              onKeyDown: (event: { key?: string }) => {
                if (['ArrowUp', 'PageUp', 'Home'].includes(event.key ?? '')) { pendingSendScroll.current = false; followLatest.current = false; }
              },
            } : {})}
            onTouchStart={pauseFollowing}
            onTouchEnd={() => { readingWithGesture.current = false; }}
            onTouchCancel={() => { readingWithGesture.current = false; }}
            onScrollBeginDrag={(event) => { if (event?.nativeEvent?.contentOffset) updateScrollPosition(event); pauseFollowing(); }}
            onScroll={updateScrollPosition}
            onScrollEndDrag={(event) => { updateScrollPosition(event); readingWithGesture.current = false; }}
            onMomentumScrollBegin={() => { if (!pendingSendScroll.current) readingWithGesture.current = true; }}
            onMomentumScrollEnd={(event) => { updateScrollPosition(event); readingWithGesture.current = false; scrollToLatest(); }}>
            {!currentChat && <Text style={styles.versionText}>PhoneGPT {APP_VERSION}</Text>}
            {visibleMessages.map((item) => <View key={item.id} style={{ minWidth: 0 }}>{/* Keep each routing summary beside its own question. */}<View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><View style={{ minWidth: 0, maxWidth: '100%' }}>{item.attachments?.map((file, index) => <Text key={`${file.name}-${index}`} selectable style={[styles.attachmentText, { color: item.role === 'user' ? colors.userText : colors.secondary, marginBottom: 6 }]}>📄 {file.name}</Text>)}{item.searchLimit && <Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12, marginBottom: 8 }}>{searchLimitNotice(item.searchLimit)}</Text>}{item.web && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>From the web</Text>}<MessageContent content={item.content} color={item.role === 'user' ? colors.userText : colors.text} />{item.web && <WebSources provenance={item.web} />}</View></View>{item.role === 'user' && item.searchDecision && <SearchDecision decision={item.searchDecision} active={isGenerating && item.id === currentChat?.messages[currentChat.messages.length - 1]?.id} />}</View>)}
            <WebSearchOverlay visible={isGenerating && webPhase === 'searching'} />
            {isGenerating && searchLimitForTurn && searchLimitForTurn.chatId === currentChat?.id && searchLimitForTurn?.userId === currentChat?.messages[currentChat.messages.length - 1]?.id && !streamingReply && <Text accessibilityLiveRegion="polite" style={styles.contextHint}>{searchLimitNotice(searchLimitForTurn.details)}</Text>}
            {isGenerating && webPhase !== 'searching' && webPhase !== 'deciding' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={colors.primary} size="small" /><Text accessibilityLiveRegion="polite" style={styles.generatingText}>{isStopping ? 'Stopping…' : 'Generating locally…'}</Text></View>}
          </ScrollView>
          </View>
          <View style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom, 12) }]}>
            {voice.model && <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 6 }} accessibilityLabel={`Voice model: ${voice.model.displayName}`}>Voice: {voice.model.displayName}{voice.mode === 'live' ? ' · Live' : ''}</Text>}
            {voice.busy && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, flexShrink: 1 }}>{voice.status === 'recording' ? (voice.mode === 'live' ? 'Live transcription' : 'Recording') : voice.status === 'starting' ? (voice.mode === 'live' ? 'Preparing live transcription…' : 'Starting microphone…') : voice.status === 'cancelling' ? 'Cancelling…' : (voice.mode === 'live' ? 'Updating transcript…' : `Transcribing locally… ${Math.round(voice.progress)}%`)}</Text>{voice.status === 'recording' && <AudioLevelMeter level={voice.audioLevel} />}<Pressable accessibilityRole="button" accessibilityLabel="Cancel voice typing" disabled={voice.status === 'cancelling'} onPress={() => { void voice.cancel(); }} style={{ padding: 8 }}><Text style={{ color: colors.error }}>Cancel</Text></Pressable></View>}
            {attachedText && <View style={styles.attachmentRow}><Text numberOfLines={1} style={[styles.attachmentText, { flexShrink: 1 }]}>{attachedText.name}</Text><Pressable accessibilityLabel="Remove text attachment" disabled={isGenerating || isPickingFile} onPress={() => setAttachedText(null)}><Text style={styles.attachmentRemove}>×</Text></Pressable></View>}<View style={styles.composer}>
            <Pressable accessibilityRole="button" accessibilityLabel="Attach text file" accessibilityHint="Choose a .txt file up to 32 KB" disabled={isGenerating || isPickingFile} onPress={() => { void pickTextFile(); }} style={[styles.imageButton, (isGenerating || isPickingFile) && styles.imageButtonDisabled]}><PaperclipIcon /></Pressable>
            <ScaledTextInput ref={messageInputRef} value={message} onChangeText={editMessage} placeholder={isPickingFile ? 'Reading text file…' : isGenerating ? 'Write your next message…' : modelStatus === 'ready' ? 'Ask PhoneGPT' : 'Download a model from the Models tab'} placeholderTextColor={colors.muted} keyboardAppearance={isDark ? 'dark' : 'light'} style={styles.input} multiline textAlignVertical="center" editable={!isPickingFile} />
            <Pressable accessibilityRole="button" accessibilityLabel={voice.status === 'recording' ? 'Stop recording and transcribe' : `Start voice typing${voice.model ? ` with ${voice.model.displayName}` : ''}`} accessibilityHint="English transcription is appended to your draft" disabled={isGenerating || isPickingFile || !voice.ready || (voice.busy && voice.status !== 'recording') || isSwitchingChatModel || modelStatus === 'loading'} onPress={() => { if (voice.status === 'recording') void voice.stop(); else if (!generationInFlight.current) void voice.start(); }} style={[styles.imageButton, (isGenerating || isPickingFile || !voice.ready || (voice.busy && voice.status !== 'recording')) && styles.imageButtonDisabled, voice.status === 'recording' && { backgroundColor: colors.errorSurface }]}><MicrophoneIcon stop={voice.status === 'recording'} color={voice.status === 'recording' ? colors.error : colors.text} /></Pressable>
            {isGenerating ? <Pressable accessibilityRole="button" accessibilityLabel={isStopping ? 'Stopping generation' : 'Stop generating'} accessibilityHint="Keeps the reply generated so far" accessibilityState={{ disabled: isStopping, busy: isStopping }} disabled={isStopping} onPress={stopGeneration} style={[styles.sendButton, { backgroundColor: colors.errorSurface }]}>{isStopping ? <ActivityIndicator color={colors.error} size="small" /> : <AppIcon name="stop" color={colors.error} />}</Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={isDeletingChat || (!message.trim() && !attachedText) || voice.busy || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading'} onPress={send} style={[styles.sendButton, (isDeletingChat || (!message.trim() && !attachedText) || voice.busy || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading') && styles.sendButtonDisabled]}><AppIcon name="up" color={colors.onPrimary} /></Pressable>}
          </View></View>
        </View>}
        {screen === 'models' && <SimpleScreen title="Models"><ScrollView style={styles.modelScroll} contentContainerStyle={styles.modelList}><View style={{ gap: 6, marginBottom: 10 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Find your next model</Text><Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20 }}>Download once, use offline. Expand a family to explore chat models, or choose Voice for dictation.</Text></View><VoiceModels selectedId={voice.selectedId} onSelect={voice.select} disabled={voice.busy || isGenerating || !voice.ready} /><Text style={styles.sectionLabel}>Chat models</Text>{MODEL_GROUPS.map((group) => <ProviderGroup key={group.name} name={group.name} count={group.models.length} >{group.sections.map((section) => <ProviderGroup key={section.name} name={section.name} count={section.models.length}>{section.models.map((model) => <View key={model.id} style={[styles.catalogCard, modelStatus === 'ready' && selectedModel.id === model.id && styles.catalogCardSelected]}><Pressable accessibilityRole="button" accessibilityLabel={`${model.displayName}${model.preferred ? ', Preferred' : ''}, model options`} accessibilityState={{ expanded: expandedModelId === model.id }} onPress={() => { void selectModel(model); }}><View style={styles.catalogHeader}><View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><Text style={[styles.modelName, { flexShrink: 1 }]}>{model.displayName}</Text>{model.preferred && <Text style={{ color: colors.primary, backgroundColor: colors.raised, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>Preferred</Text>}</View>{modelStatus === 'ready' && selectedModel.id === model.id && <Text style={styles.selectedText}>Selected</Text>}</View><Text style={styles.catalogProvider}>{model.provider}</Text><Text style={styles.catalogDetail}>{model.capabilities.join(' · ')} · {formatBytes(model.sizeBytes)}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{expandedModelId === model.id ? 'Hide options' : 'Model options'}</Text><View style={{ transform: [{ rotate: expandedModelId === model.id ? '180deg' : '0deg' }] }}><AppIcon name="chevron" color={colors.primary} size={16} /></View></View></Pressable>{expandedModelId === model.id && selectedModel.id === model.id && <View style={styles.modelExpansion}>{modelButton()}{modelControls}{modelError && <Text style={styles.errorText}>{modelError}</Text>}</View>}</View>)}</ProviderGroup>)}</ProviderGroup>)}</ScrollView></SimpleScreen>}
        {screen === 'settings' && <SimpleScreen title="Settings"><SettingsContent bottomInset={insets.bottom} promptSettings={promptSettings} modelControls={modelControls} onAppInfo={() => go('info')} /></SimpleScreen>}
        {screen === 'info' && <SimpleScreen title="App Info" onBack={() => go('settings')}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}><AppInfo version={APP_VERSION} /></ScrollView></SimpleScreen>}
        {screen !== 'chat' && !keyboardVisible && <BottomTabs active={screen === 'info' ? 'settings' : screen} bottomInset={insets.bottom} onSelect={go} />}
        <ChatExport open={exportOpen} chats={chats} onClose={() => setExportOpen(false)} />

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function SimpleScreen({ title, onBack, children }: { title: string; onBack?: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.screen}><View style={styles.topBar}>{onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" hitSlop={10} onPress={onBack} style={styles.iconButton}><AppIcon name="back" color={colors.text} /></Pressable>}<Text style={styles.title}>{title}</Text></View><View style={styles.pageContent}>{children}</View></View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, keyboardContainer: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.background },
  topBar: { zIndex: 5, minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 }, menuIcon: { color: colors.text, fontSize: 25, lineHeight: 28 }, title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' }, modelBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 34, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface }, modelStatusDot: { width: 7, height: 7, borderRadius: 4 }, modelStatusDotReady: { backgroundColor: colors.success }, modelStatusDotInactive: { backgroundColor: colors.muted }, modelBannerText: { flex: 1, color: colors.secondary, fontSize: 13, fontWeight: '600' }, contextBanner: { paddingHorizontal: 18, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.background }, contextHeading: { gap: 8, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, contextText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextPercent: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.track }, contextFill: { height: '100%', borderRadius: 2, backgroundColor: colors.fill }, contextHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  chatArea: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18, justifyContent: 'center' }, messagesArea: { justifyContent: 'flex-start' }, versionText: { alignSelf: 'center', color: colors.muted, fontSize: 13, fontWeight: '600' }, generatingText: { alignSelf: 'flex-start', color: colors.secondary, fontSize: 14, fontWeight: '600', marginVertical: 8 }, messageBubble: { maxWidth: '92%', minWidth: 0, flexShrink: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 }, userBubble: { alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: colors.userBubble, borderBottomRightRadius: 4 }, assistantBubble: { alignSelf: 'flex-start', width: '92%', backgroundColor: colors.assistantBubble, borderBottomLeftRadius: 4 }, messageText: { color: colors.text, fontSize: 16, lineHeight: 22 }, userMessageText: { color: colors.userText },
  composerWrap: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.background }, attachmentRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6, backgroundColor: colors.raised, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 }, attachmentText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, attachmentRemove: { color: colors.error, fontSize: 19, lineHeight: 19 }, composer: { minHeight: 56, maxHeight: 124, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingLeft: 6, paddingRight: 6, paddingVertical: 6 }, imageButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, imageButtonDisabled: { opacity: 0.3 }, input: { flex: 1, alignSelf: 'stretch', color: colors.text, fontSize: 16, maxHeight: 104, paddingTop: 10, paddingBottom: 10 }, sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, sendButtonDisabled: { backgroundColor: colors.disabled }, sendIcon: { color: colors.onPrimary, fontSize: 22, fontWeight: '700', marginTop: -2 },
  pageContent: { flex: 1, padding: 20 }, modelScroll: { flex: 1, marginHorizontal: -20 }, modelList: { padding: 20, gap: 10, paddingBottom: 36 }, sectionLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }, catalogCard: { borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL.cardRadius, padding: 14, backgroundColor: colors.surface }, catalogCardSelected: { borderColor: colors.primary, borderWidth: 2 }, catalogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, catalogProvider: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginTop: 4 }, catalogDetail: { color: colors.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 }, expandText: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginTop: 12 }, modelExpansion: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 }, modelCard: { borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL.cardRadius, padding: 16 }, modelName: { color: colors.text, fontSize: 16, fontWeight: '700' }, modelDetail: { color: colors.secondary, fontSize: 14, marginTop: 5, marginBottom: 16 }, modelStatus: { color: colors.secondary, fontSize: 14 }, downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cancelButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.errorSurface, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.error, fontSize: 22, lineHeight: 25 }, primaryButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, primaryButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' }, readyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, readyText: { color: colors.success, fontSize: 14, fontWeight: '700' }, deleteText: { color: colors.error, fontSize: 14, fontWeight: '700' }, modelControls: { gap: 2, paddingTop: 6 }, controlLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, choiceButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background }, choiceButtonActive: { borderColor: colors.text, backgroundColor: colors.primary }, choiceText: { color: colors.secondary, fontSize: 13, fontWeight: '700' }, choiceTextActive: { color: colors.onPrimary }, controlHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }, errorText: { color: colors.error, fontSize: 13, marginTop: 12 }, placeholderText: { color: colors.secondary, fontSize: 16 },
});
