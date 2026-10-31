import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_INFERENCE_SETTINGS, GenerationStoppedError, generateLocalReply, getContextTokenCount, getInputTokenCount, loadLocalModel, unloadLocalModel, type ContextSize, type InferenceSettings, type ReasoningMode } from './src/services/localInference';
import { cancelModelDownload, deleteInstalledModel, downloadModel, formatBytes, getInstalledModelPath, getModelDownloadState, ModelDownloadCancelledError, models, type ModelDefinition, type ModelDownloadState } from './src/services/models';
import { MessageContent } from './src/components/MessageContent';
import { AppIcon } from './src/components/AppIcon';
import { PhoneGptLogo } from './src/components/PhoneGptLogo';
import { WelcomeHome } from './src/components/WelcomeHome';
import { ProviderGroup, groupModelsByProvider } from './src/components/ProviderGroup';
import { PaperclipIcon } from './src/components/PaperclipIcon';
import { messagesForInference, migrateChatAttachments, persistTextAttachment, readTextAttachment, type TextAttachment } from './src/services/textAttachments';
import { createChatId, ensureChatUuid } from './src/services/chatIds';
import { startNewConversation } from './src/services/chatNavigation';
import { pickTextDocument } from './src/services/documentPicker';
import { chatHistoryLabels, restoreChatMetadata } from './src/services/chatHistory';
import { AppThemeProvider, useAppTheme, type ThemeColors } from './src/theme/AppTheme';
import { useSystemPromptSettings } from './src/hooks/useSystemPromptSettings';
import { AppInfo } from './src/components/AppInfo';
import { ChatModelSelector } from './src/components/ChatModelSelector';
import { NavigationDrawer } from './src/components/NavigationDrawer';
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
import { DeleteChatButton } from './src/components/DeleteChatButton';
import { removeChatFiles } from './src/services/deleteChat';
import { ChatHistorySearch } from './src/components/ChatHistorySearch';
import { SettingsContent } from './src/components/SettingsContent';
import { ActionButton, DownloadStatus } from './src/components/UiKit';
import { ScaledText as Text, ScaledTextInput } from './src/components/ScaledText';

type Screen = 'home' | 'chat' | 'models' | 'settings' | 'info';
type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string; attachments?: TextAttachment[] };
type Chat = { id: string; title: string; messages: Message[]; createdAt?: number; updatedAt?: number; systemPrompt?: string; origin?: 'dev' | 'production' };
type ModelStatus = 'checking' | 'paused' | 'not-installed' | 'downloading' | 'installed' | 'loading' | 'ready' | 'error';

const APP_VERSION = 'v0.5.0';
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
  const messageInputRef = useRef<TextInput>(null);
  const refocusAfterGeneration = useRef(false);
  const selectedModelRef = useRef<ModelDefinition>(models[0]);
  const downloadingModelIds = useRef(new Set<string>());
  const downloadProgressByModel = useRef(new Map<string, number>());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pendingSearch = useRef(false);
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
  const generationAbort = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [streamingReply, setStreamingReply] = useState<{ chatId: string; message: Message } | null>(null);
  const [inferenceSettings, setInferenceSettings] = useState<InferenceSettings>(DEFAULT_INFERENCE_SETTINGS);
  const [contextTokens, setContextTokens] = useState(0);
  const voice = useVoiceTyping(`${screen}:${drawerOpen}:${currentChat?.id ?? draftChatId}`, (text, liveId) => {
    const next = liveId ? liveDraft.current.update(draftRef.current, liveId, text) : appendTranscript(draftRef.current, text);
    draftRef.current = next;
    setMessage(next);
    refocusAfterGeneration.current = true;
  });
  useEffect(() => {
    if (screen === 'models') setExpandedModelId('');
  }, [screen]);
  // Async recovery must never replace a user operation or an active context.
  const recoveryRevision = useRef(0);
  const liveModelState = useRef({ modelStatus, isGenerating });
  liveModelState.current = { modelStatus, isGenerating };

  const closeDrawer = () => { pendingSearch.current = false; setDrawerOpen(false); };
  const openDrawer = () => { pendingSearch.current = false; setDrawerOpen(true); };
  const openHistorySearch = () => {
    if (isGenerating || voice.busy || isPickingFile) return;
    Keyboard.dismiss();
    refocusAfterGeneration.current = false;
    setModelSelectorOpen(false);
    pendingSearch.current = true;
    setDrawerOpen(false);
  };
  const onDrawerExited = () => {
    if (!pendingSearch.current) return;
    pendingSearch.current = false;
    setSearchOpen(true);
  };

  const handleBackPress = useCallback(() => {
    if (pendingSearch.current) { pendingSearch.current = false; return true; }
    if (searchOpen) { setSearchOpen(false); return true; }
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
  }, [drawerOpen, screen, modelSelectorOpen, searchOpen]);

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
    if (historyLoaded) void persistHistory(chats).catch(() => undefined);
  }, [chats, historyLoaded, persistHistory]);

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
    // Only user scroll events change follow mode; new streamed text increases
    // content height without expressing any intent to stop following it.
    followLatest.current = contentSize.height - layoutMeasurement.height - contentOffset.y <= 64;
  }, []);

  useEffect(() => {
    followLatest.current = true;
    readingWithGesture.current = false;
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [currentChat?.id, scrollToLatest]);

  // Keep the existing post-response focus behavior, after the response render
  // and any voice operation have settled.
  useEffect(() => {
    if (isGenerating || voice.busy || searchOpen || drawerOpen || screen !== 'chat' || !refocusAfterGeneration.current) return;
    refocusAfterGeneration.current = false;
    const timer = setTimeout(() => messageInputRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [isGenerating, voice.busy, searchOpen, drawerOpen, screen]);

  useEffect(() => {
    let active = true;
    void messagesForInference(currentChat?.messages ?? []).then(getContextTokenCount)
      .then((count) => { if (active) setContextTokens(count); })
      .catch(() => { if (active) setContextTokens(0); });
    return () => { active = false; };
  }, [currentChat?.messages, modelStatus]);

  const go = (next: Screen) => { pendingSearch.current = false; setSearchOpen(false); setModelSelectorOpen(false); setScreen(next); setDrawerOpen(false); };
  const newChat = () => {
    if (isGenerating || voice.busy || isSwitchingChatModel || isPickingFile) return;
    const state = { currentChat, draftChatId, message, attachedText };
    const next = startNewConversation(state, createChatId);
    if (next !== state) {
      setCurrentChat(next.currentChat);
      setDraftChatId(next.draftChatId);
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
      if (currentChatRef.current?.id === chat.id) {
        currentChatRef.current = null;
        setCurrentChat(null);
        setDraftChatId(createChatId());
        draftRef.current = '';
        setMessage('');
        setAttachedText(null);
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
      await loadLocalModel(model, path, contextSize, (progress) => { if (isStillSelected()) setModelProgress(progress); });
      if (isStillSelected()) {
        lastLoaded.remember(model);
        setModelStatus('ready');
        setModelProgress(1);
        pendingSearch.current = false;
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
    updatedChat = { ...updatedChat, createdAt: updatedChat.createdAt ?? now, updatedAt: now };
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
    if ((!cleanMessage && !attachedText) || chatDeletionInFlight.current || generationInFlight.current || voice.isActive() || voice.busy || isGenerating || isPickingFile || switchingChatModel.current || !promptSettings.ready) return;
    if (modelStatus !== 'ready') {
      Alert.alert('Model not ready', 'Choose a downloaded model above, or download one from Menu → Models.');
      return;
    }
    generationInFlight.current = true;
    const controller = new AbortController();
    generationAbort.current = controller;
    setIsStopping(false);
    setIsGenerating(true);
    const finishGeneration = () => {
      generationInFlight.current = false;
      if (generationAbort.current === controller) generationAbort.current = null;
      setIsStopping(false);
      setIsGenerating(false);
    };

    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', content: cleanMessage, ...(attachedText ? { attachments: [attachedText] } : {}) };
    const nextChat: Chat = currentChat
      ? { ...currentChat, messages: [...currentChat.messages, userMessage] }
      : { id: draftChatId, title: draftChatId, messages: [userMessage], createdAt: Date.now(), systemPrompt: promptSettings.savedPrompt, origin: __DEV__ ? 'dev' : 'production' };

    // Validate hidden prompts and files without saving an oversized request.
    if (attachedText || nextChat.systemPrompt?.trim()) {
      try {
        const tokens = await getInputTokenCount(await messagesForInference(nextChat.messages), inferenceSettings, nextChat.systemPrompt);
        if (controller.signal.aborted) { finishGeneration(); return; }
        if (tokens + inferenceSettings.maxTokens + 192 > inferenceSettings.contextSize) {
          Alert.alert('Message exceeds available context', 'Use a shorter system prompt or file, start a fresh chat, or increase Conversation context in Models.');
          finishGeneration();
          return;
        }
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
    saveChat(nextChat);
    // Preserve any edits made while asynchronous file/prompt validation ran.
    if (draftRef.current === submittedDraft) draftRef.current = '';
    setMessage((current) => current === submittedDraft ? '' : current);
    setAttachedText(null);
    // Sending is an explicit request to return to the newest message. Do not
    // depend only on content-height changes (or an earlier drag's follow flag).
    requestAnimationFrame(() => {
      followLatest.current = true;
      readingWithGesture.current = false;
      messageListRef.current?.scrollToEnd({ animated: false });
    });
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
      }, controller.signal);
      saveChat({ ...nextChat, messages: [...nextChat.messages, { id: assistantId, role: 'assistant', content: response }] }, false);
    } catch (error) {
      if (error instanceof GenerationStoppedError || controller.signal.aborted) {
        const text = (error instanceof GenerationStoppedError ? error.partialText : '') || partialReply;
        saveChat({ ...nextChat, messages: [...nextChat.messages, ...(text ? [{ id: assistantId, role: 'assistant' as const, content: text }] : [])] }, false);
        return;
      }
      const reason = error instanceof Error ? error.message : 'Unknown local inference error.';
      const partialMessages: Message[] = partialReply ? [{ id: assistantId, role: 'assistant', content: partialReply }] : [];
      saveChat({ ...nextChat, messages: [...nextChat.messages, ...partialMessages, { id: `${Date.now()}-error`, role: 'assistant', content: `I could not generate a reply: ${reason}` }] }, false);
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

  const inferenceControlsDisabled = voice.busy || isGenerating || isSwitchingChatModel || modelStatus === 'loading' || modelStatus === 'checking';
  const modelControls = <View style={styles.modelControls}>
    <Text style={styles.controlLabel}>Reasoning</Text>
    <Text style={styles.controlHint}>How much thinking to request. Support varies by model.</Text>
    <View style={styles.choiceRow}>{REASONING_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: inferenceSettings.reasoningMode === option.value, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => setInferenceSettings((current) => ({ ...current, reasoningMode: option.value }))} style={[styles.choiceButton, inferenceControlsDisabled && { opacity: 0.5 }, inferenceSettings.reasoningMode === option.value && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.reasoningMode === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>
    <Text style={styles.controlLabel}>Maximum reply length</Text>
    <Text style={styles.controlHint}>Measured in tokens, not words. Longer replies take more time.</Text>
    <View style={styles.choiceRow}>{OUTPUT_TOKEN_OPTIONS.map((tokens) => <Pressable key={tokens} accessibilityRole="button" accessibilityLabel={`${tokens} reply tokens`} accessibilityState={{ selected: inferenceSettings.maxTokens === tokens, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => setInferenceSettings((current) => ({ ...current, maxTokens: tokens }))} style={[styles.choiceButton, inferenceControlsDisabled && { opacity: 0.5 }, inferenceSettings.maxTokens === tokens && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.maxTokens === tokens && styles.choiceTextActive]}>{tokens}</Text></Pressable>)}</View>
    <Text style={styles.controlLabel}>Conversation context</Text>
    <View style={styles.choiceRow}>{CONTEXT_SIZE_OPTIONS.map((tokens) => <Pressable key={tokens} accessibilityRole="button" accessibilityLabel={`${tokens} context tokens`} accessibilityState={{ selected: inferenceSettings.contextSize === tokens, disabled: inferenceControlsDisabled }} disabled={inferenceControlsDisabled} onPress={() => {
      setInferenceSettings((current) => ({ ...current, contextSize: tokens }));
      if (modelPath && modelStatus === 'ready') void loadModel(selectedModel, modelPath, tokens);
    }} style={[styles.choiceButton, inferenceControlsDisabled && { opacity: 0.5 }, inferenceSettings.contextSize === tokens && styles.choiceButtonActive]}><Text style={[styles.choiceText, inferenceSettings.contextSize === tokens && styles.choiceTextActive]}>{tokens}</Text></Pressable>)}</View>
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
        {screen === 'home' && <SimpleScreen title={__DEV__ ? 'PhoneGPT Dev' : 'PhoneGPT'} onMenu={openDrawer}><WelcomeHome version={APP_VERSION} onChat={() => go('chat')} onModels={() => go('models')} /></SimpleScreen>}
        {screen === 'chat' && <View style={styles.screen} aria-hidden={searchOpen} accessibilityElementsHidden={searchOpen} importantForAccessibility={searchOpen ? 'no-hide-descendants' : 'auto'}>
          <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={10} onPress={() => { setModelSelectorOpen(false); openDrawer(); }} style={styles.iconButton}><AppIcon name="menu" color={colors.text} /></Pressable><View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}><Text selectable style={{ color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{currentChat?.id ?? draftChatId}</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose downloaded model" accessibilityState={{ expanded: modelSelectorOpen, disabled: voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel }} disabled={voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel} onPress={() => { Keyboard.dismiss(); setModelSelectorOpen((open) => !open); }} style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.raised, opacity: voice.busy || isGenerating || modelStatus === 'loading' || isSwitchingChatModel ? 0.5 : 1 }}><Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 12, flexShrink: 1 }}>{modelStatus === 'ready' ? selectedModel.displayName : modelStatus === 'loading' || isSwitchingChatModel ? `Loading ${selectedModel.displayName}…` : 'Choose downloaded model'}</Text><View style={{ transform: [{ rotate: modelSelectorOpen ? '180deg' : '0deg' }] }}><AppIcon name="chevron" color={colors.secondary} size={15} /></View></Pressable></View><NewChatButton onPress={newChat} disabled={isGenerating || voice.busy || isSwitchingChatModel} /></View>
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
          <View style={styles.contextBanner}><View style={styles.contextHeading}><Text style={styles.contextText}>Conversation: ~{usedContextTokens.toLocaleString()} / {inferenceSettings.contextSize.toLocaleString()} tokens</Text><Text style={styles.contextPercent}>{contextPercent}%</Text></View><View style={styles.contextTrack}><View style={[styles.contextFill, { width: `${contextPercent}%` }]} /></View><Text style={styles.contextHint}>Current chat only · reply limit: {inferenceSettings.maxTokens} tokens</Text></View></>}
          <ScrollView ref={messageListRef} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={[styles.chatArea, currentChat && styles.messagesArea]} keyboardShouldPersistTaps="handled" onContentSizeChange={scrollToLatest} onLayout={scrollToLatest} scrollEventThrottle={16}
            onScrollBeginDrag={() => { readingWithGesture.current = true; followLatest.current = false; }}
            onScroll={(event) => { if (readingWithGesture.current) updateScrollPosition(event); }}
            onScrollEndDrag={(event) => { updateScrollPosition(event); readingWithGesture.current = false; }}
            onMomentumScrollBegin={() => { readingWithGesture.current = true; }}
            onMomentumScrollEnd={(event) => { updateScrollPosition(event); readingWithGesture.current = false; scrollToLatest(); }}>
            {!currentChat && <Text style={styles.versionText}>PhoneGPT {APP_VERSION}</Text>}
            {visibleMessages.map((item) => <View key={item.id} style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}><View style={{ minWidth: 0, maxWidth: '100%' }}>{item.attachments?.map((file, index) => <Text key={`${file.name}-${index}`} selectable style={[styles.attachmentText, { color: item.role === 'user' ? colors.userText : colors.secondary, marginBottom: 6 }]}>📄 {file.name}</Text>)}<MessageContent content={item.content} color={item.role === 'user' ? colors.userText : colors.text} /></View></View>)}
            {isGenerating && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={colors.primary} size="small" /><Text accessibilityLiveRegion="polite" style={styles.generatingText}>{isStopping ? 'Stopping…' : 'Generating locally…'}</Text></View>}
          </ScrollView>
          <View style={[styles.composerWrap, { paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom, 12) }]}>
            {voice.model && <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 6 }} accessibilityLabel={`Voice model: ${voice.model.displayName}`}>Voice: {voice.model.displayName}{voice.mode === 'live' ? ' · Live' : ''}</Text>}
            {voice.busy && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, flexShrink: 1 }}>{voice.status === 'recording' ? (voice.mode === 'live' ? 'Live transcription' : 'Recording') : voice.status === 'starting' ? (voice.mode === 'live' ? 'Preparing live transcription…' : 'Starting microphone…') : voice.status === 'cancelling' ? 'Cancelling…' : (voice.mode === 'live' ? 'Updating transcript…' : `Transcribing locally… ${Math.round(voice.progress)}%`)}</Text>{voice.status === 'recording' && <AudioLevelMeter level={voice.audioLevel} />}<Pressable accessibilityRole="button" accessibilityLabel="Cancel voice typing" disabled={voice.status === 'cancelling'} onPress={() => { void voice.cancel(); }} style={{ padding: 8 }}><Text style={{ color: colors.error }}>Cancel</Text></Pressable></View>}
            {attachedText && <View style={styles.attachmentRow}><Text numberOfLines={1} style={[styles.attachmentText, { flexShrink: 1 }]}>{attachedText.name}</Text><Pressable accessibilityLabel="Remove text attachment" disabled={isGenerating || isPickingFile} onPress={() => setAttachedText(null)}><Text style={styles.attachmentRemove}>×</Text></Pressable></View>}<View style={styles.composer}>
            <Pressable accessibilityRole="button" accessibilityLabel="Attach text file" accessibilityHint="Choose a .txt file up to 32 KB" disabled={isGenerating || isPickingFile} onPress={() => { void pickTextFile(); }} style={[styles.imageButton, (isGenerating || isPickingFile) && styles.imageButtonDisabled]}><PaperclipIcon /></Pressable>
            <ScaledTextInput ref={messageInputRef} value={message} onChangeText={editMessage} placeholder={isPickingFile ? 'Reading text file…' : isGenerating ? 'Write your next message…' : modelStatus === 'ready' ? 'Ask PhoneGPT' : 'Download a model from Menu → Models'} placeholderTextColor={colors.muted} keyboardAppearance={isDark ? 'dark' : 'light'} style={styles.input} multiline textAlignVertical="center" editable={!isPickingFile} />
            <Pressable accessibilityRole="button" accessibilityLabel={voice.status === 'recording' ? 'Stop recording and transcribe' : `Start voice typing${voice.model ? ` with ${voice.model.displayName}` : ''}`} accessibilityHint="English transcription is appended to your draft" disabled={isGenerating || isPickingFile || !voice.ready || (voice.busy && voice.status !== 'recording') || isSwitchingChatModel || modelStatus === 'loading'} onPress={() => { if (voice.status === 'recording') void voice.stop(); else if (!generationInFlight.current) void voice.start(); }} style={[styles.imageButton, (isGenerating || isPickingFile || !voice.ready || (voice.busy && voice.status !== 'recording')) && styles.imageButtonDisabled, voice.status === 'recording' && { backgroundColor: colors.errorSurface }]}><MicrophoneIcon stop={voice.status === 'recording'} color={voice.status === 'recording' ? colors.error : colors.text} /></Pressable>
            {isGenerating ? <Pressable accessibilityRole="button" accessibilityLabel={isStopping ? 'Stopping generation' : 'Stop generating'} accessibilityHint="Keeps the reply generated so far" accessibilityState={{ disabled: isStopping, busy: isStopping }} disabled={isStopping} onPress={stopGeneration} style={[styles.sendButton, { backgroundColor: colors.errorSurface }]}>{isStopping ? <ActivityIndicator color={colors.error} size="small" /> : <AppIcon name="stop" color={colors.error} />}</Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={isDeletingChat || (!message.trim() && !attachedText) || voice.busy || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading'} onPress={send} style={[styles.sendButton, (isDeletingChat || (!message.trim() && !attachedText) || voice.busy || isGenerating || isPickingFile || isSwitchingChatModel || modelStatus === 'loading') && styles.sendButtonDisabled]}><AppIcon name="up" color={colors.onPrimary} /></Pressable>}
          </View></View>
        </View>}
        {screen === 'models' && <SimpleScreen title="Models" onMenu={openDrawer}><ScrollView style={styles.modelScroll} contentContainerStyle={styles.modelList}><View style={{ gap: 6, marginBottom: 10 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Find your next model</Text><Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20 }}>Download once, use offline. Expand a family to explore chat models, or choose Voice for dictation.</Text></View><VoiceModels selectedId={voice.selectedId} onSelect={voice.select} disabled={voice.busy || isGenerating || !voice.ready} /><Text style={styles.sectionLabel}>Chat models</Text>{MODEL_GROUPS.map((group) => <ProviderGroup key={group.name} name={group.name} count={group.models.length} >{group.sections.map((section) => <ProviderGroup key={section.name} name={section.name} count={section.models.length}>{section.models.map((model) => <View key={model.id} style={[styles.catalogCard, modelStatus === 'ready' && selectedModel.id === model.id && styles.catalogCardSelected]}><Pressable accessibilityRole="button" accessibilityLabel={`${model.displayName}, model options`} accessibilityState={{ expanded: expandedModelId === model.id }} onPress={() => { void selectModel(model); }}><View style={styles.catalogHeader}><Text style={styles.modelName}>{model.displayName}</Text>{modelStatus === 'ready' && selectedModel.id === model.id && <Text style={styles.selectedText}>Selected</Text>}</View><Text style={styles.catalogProvider}>{model.provider}</Text><Text style={styles.catalogDetail}>{model.capabilities.join(' · ')} · {formatBytes(model.sizeBytes)}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{expandedModelId === model.id ? 'Hide options' : 'Model options'}</Text><View style={{ transform: [{ rotate: expandedModelId === model.id ? '180deg' : '0deg' }] }}><AppIcon name="chevron" color={colors.primary} size={16} /></View></View></Pressable>{expandedModelId === model.id && selectedModel.id === model.id && <View style={styles.modelExpansion}>{modelButton()}{modelControls}{modelError && <Text style={styles.errorText}>{modelError}</Text>}</View>}</View>)}</ProviderGroup>)}</ProviderGroup>)}</ScrollView></SimpleScreen>}
        {screen === 'settings' && <SimpleScreen title="Settings" onMenu={openDrawer}><SettingsContent bottomInset={insets.bottom} promptSettings={promptSettings} modelControls={modelControls} /></SimpleScreen>}
        {screen === 'info' && <SimpleScreen title="App Info" onMenu={openDrawer}><ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}><AppInfo version={APP_VERSION} /></ScrollView></SimpleScreen>}
        <NavigationDrawer open={drawerOpen} onExited={onDrawerExited} onClose={closeDrawer} onRequestClose={() => { handleBackPress(); }}><SafeAreaView edges={['top', 'bottom', 'left']} style={styles.drawer}>
          <View style={styles.drawerTop}><PhoneGptLogo size={32} /><Text style={[styles.drawerTitle, { flex: 1, marginLeft: 10 }]}>PhoneGPT</Text><Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={styles.iconButton} hitSlop={10} onPress={closeDrawer}><AppIcon name="close" color={colors.secondary} /></Pressable></View>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: screen === 'home' }} onPress={() => go('home')} style={({ pressed }) => [styles.navItem, screen === 'home' && { backgroundColor: colors.raised }, pressed && { opacity: 0.65 }]}><AppIcon name="home" color={screen === 'home' ? colors.primary : colors.secondary} /><Text style={[styles.navText, screen === 'home' && { color: colors.primary }]}>Home</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: screen === 'chat' }} onPress={newChat} style={({ pressed }) => [styles.navItem, screen === 'chat' && { backgroundColor: colors.raised }, pressed && { opacity: 0.65 }]}><AppIcon name="chat" color={screen === 'chat' ? colors.primary : colors.secondary} /><Text style={[styles.navText, screen === 'chat' && { color: colors.primary }]}>New chat</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: screen === 'models' }} onPress={() => go('models')} style={({ pressed }) => [styles.navItem, screen === 'models' && { backgroundColor: colors.raised }, pressed && { opacity: 0.65 }]}><AppIcon name="models" color={screen === 'models' ? colors.primary : colors.secondary} /><Text style={[styles.navText, screen === 'models' && { color: colors.primary }]}>Models</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: screen === 'settings' }} onPress={() => go('settings')} style={({ pressed }) => [styles.navItem, screen === 'settings' && { backgroundColor: colors.raised }, pressed && { opacity: 0.65 }]}><AppIcon name="settings" color={screen === 'settings' ? colors.primary : colors.secondary} /><Text style={[styles.navText, screen === 'settings' && { color: colors.primary }]}>Settings</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: screen === 'info' }} onPress={() => go('info')} style={({ pressed }) => [styles.navItem, screen === 'info' && { backgroundColor: colors.raised }, pressed && { opacity: 0.65 }]}><AppIcon name="info" color={screen === 'info' ? colors.primary : colors.secondary} /><Text style={[styles.navText, screen === 'info' && { color: colors.primary }]}>App Info</Text></Pressable>
          <View style={styles.divider} /><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}><Text accessibilityRole="header" style={[styles.historyHeading, { marginBottom: 0 }]}>Chat History</Text><Pressable accessibilityRole="button" accessibilityLabel="Search chat history" accessibilityState={{ disabled: isGenerating || voice.busy || isPickingFile }} disabled={isGenerating || voice.busy || isPickingFile} onPress={openHistorySearch} style={({ pressed }) => ({ width: 44, height: 44, marginLeft: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised, opacity: isGenerating || voice.busy || isPickingFile ? 0.4 : pressed ? 0.65 : 1 })}><AppIcon name="search" color={colors.primary} size={20} /></Pressable></View>{!chats.length && <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, paddingVertical: 12 }}>Your conversations will appear here after your first message.</Text>}<ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>{chats.map((chat) => {
            const labels = chatHistoryLabels(chat);
            return <View key={chat.id} style={styles.historyItem}><Pressable accessibilityRole="button" accessibilityLabel={`${labels.title}, ${labels.date}, ${labels.time}`} onPress={() => { setCurrentChat(chat); setAttachedText(null); setMessage(''); go('chat'); }} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={styles.dot} /><Text numberOfLines={1} style={styles.historyText}>{labels.title}</Text><View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 3 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{labels.date}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{labels.time}</Text></View></Pressable><DeleteChatButton chatTitle={labels.title} disabled={isDeletingChat || isGenerating || voice.busy || isPickingFile || !historyLoaded} onConfirm={() => deleteChat(chat)} /></View>;
          })}</ScrollView>
        </SafeAreaView></NavigationDrawer>
        <ChatHistorySearch open={searchOpen} chats={chats} onDelete={deleteChat} deletingDisabled={isDeletingChat || isGenerating || voice.busy || isPickingFile || !historyLoaded} onClose={() => setSearchOpen(false)} onSelect={(chat) => { setCurrentChat(chat); setAttachedText(null); setMessage(''); go('chat'); }} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function SimpleScreen({ title, onMenu, children }: { title: string; onMenu: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.screen}><View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={10} onPress={onMenu} style={styles.iconButton}><AppIcon name="menu" color={colors.text} /></Pressable><Text style={styles.title}>{title}</Text></View><View style={styles.pageContent}>{children}</View></View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, keyboardContainer: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.background },
  topBar: { zIndex: 5, minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 }, menuIcon: { color: colors.text, fontSize: 25, lineHeight: 28 }, title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' }, modelBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 34, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface }, modelStatusDot: { width: 7, height: 7, borderRadius: 4 }, modelStatusDotReady: { backgroundColor: colors.success }, modelStatusDotInactive: { backgroundColor: colors.muted }, modelBannerText: { flex: 1, color: colors.secondary, fontSize: 13, fontWeight: '600' }, contextBanner: { paddingHorizontal: 18, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.background }, contextHeading: { gap: 8, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, contextText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextPercent: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, contextTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.track }, contextFill: { height: '100%', borderRadius: 2, backgroundColor: colors.fill }, contextHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  chatArea: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 18, justifyContent: 'center' }, messagesArea: { justifyContent: 'flex-start' }, versionText: { alignSelf: 'center', color: colors.muted, fontSize: 13, fontWeight: '600' }, generatingText: { alignSelf: 'flex-start', color: colors.secondary, fontSize: 14, fontWeight: '600', marginVertical: 8 }, messageBubble: { maxWidth: '92%', minWidth: 0, flexShrink: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 10 }, userBubble: { alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: colors.userBubble, borderBottomRightRadius: 4 }, assistantBubble: { alignSelf: 'flex-start', width: '92%', backgroundColor: colors.assistantBubble, borderBottomLeftRadius: 4 }, messageText: { color: colors.text, fontSize: 16, lineHeight: 22 }, userMessageText: { color: colors.userText },
  composerWrap: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.background }, attachmentRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6, backgroundColor: colors.raised, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 }, attachmentText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, attachmentRemove: { color: colors.error, fontSize: 19, lineHeight: 19 }, composer: { minHeight: 56, maxHeight: 124, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingLeft: 6, paddingRight: 6, paddingVertical: 6 }, imageButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, imageButtonDisabled: { opacity: 0.3 }, input: { flex: 1, alignSelf: 'stretch', color: colors.text, fontSize: 16, maxHeight: 104, paddingTop: 10, paddingBottom: 10 }, sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, sendButtonDisabled: { backgroundColor: colors.disabled }, sendIcon: { color: colors.onPrimary, fontSize: 22, fontWeight: '700', marginTop: -2 },
  drawer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 }, drawerTop: { height: 68, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, drawerTitle: { color: colors.text, fontSize: 23, fontWeight: '800' }, closeIcon: { color: colors.text, fontSize: 30, lineHeight: 30 }, navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderRadius: 12, marginBottom: 4, paddingVertical: 13, paddingHorizontal: 12 }, navText: { color: colors.text, fontSize: 15, fontWeight: '600' }, divider: { height: 1, backgroundColor: colors.border, marginTop: 18, marginBottom: 22 }, historyHeading: { color: colors.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 11 }, historyList: { paddingBottom: 24, gap: 4 }, historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted }, historyText: { flex: 1, color: colors.secondary, fontSize: 15 },
  pageContent: { flex: 1, padding: 20 }, modelScroll: { flex: 1, marginHorizontal: -20 }, modelList: { padding: 20, gap: 10, paddingBottom: 36 }, sectionLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }, catalogCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface }, catalogCardSelected: { borderColor: colors.primary, borderWidth: 2 }, catalogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectedText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700', backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, catalogProvider: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginTop: 4 }, catalogDetail: { color: colors.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 }, expandText: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginTop: 12 }, modelExpansion: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 }, modelCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 }, modelName: { color: colors.text, fontSize: 16, fontWeight: '700' }, modelDetail: { color: colors.secondary, fontSize: 14, marginTop: 5, marginBottom: 16 }, modelStatus: { color: colors.secondary, fontSize: 14 }, downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cancelButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.errorSurface, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.error, fontSize: 22, lineHeight: 25 }, primaryButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, primaryButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' }, readyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, readyText: { color: colors.success, fontSize: 14, fontWeight: '700' }, deleteText: { color: colors.error, fontSize: 14, fontWeight: '700' }, modelControls: { gap: 2, paddingTop: 6 }, controlLabel: { color: colors.secondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, choiceButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background }, choiceButtonActive: { borderColor: colors.text, backgroundColor: colors.primary }, choiceText: { color: colors.secondary, fontSize: 13, fontWeight: '700' }, choiceTextActive: { color: colors.onPrimary }, controlHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }, errorText: { color: colors.error, fontSize: 13, marginTop: 12 }, placeholderText: { color: colors.secondary, fontSize: 16 },
});
