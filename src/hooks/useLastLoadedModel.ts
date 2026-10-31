import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { models, type ModelDefinition } from '../services/models';

const KEY = '@phone-gpt/last-loaded-model';

export function useLastLoadedModel() {
  const [id, setId] = useState<string | null>(null);
  const currentId = useRef<string | null>(null);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    void AsyncStorage.getItem(KEY).then((saved) => {
      if (!active || revision.current !== initialRevision) return;
      const restored = models.some((model) => model.id === saved) ? saved : null;
      currentId.current = restored;
      setId(restored);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const remember = useCallback((model: ModelDefinition) => {
    revision.current += 1;
    currentId.current = model.id;
    setId(model.id);
    // Serialize writes so rapid successful loads cannot restore an older ID.
    writes.current = writes.current.then(() => AsyncStorage.setItem(KEY, model.id)).catch(() => undefined);
  }, []);

  const forget = useCallback((modelId: string) => {
    if (currentId.current !== modelId) return;
    revision.current += 1;
    currentId.current = null;
    setId(null);
    writes.current = writes.current.then(() => AsyncStorage.removeItem(KEY)).catch(() => undefined);
  }, []);

  return { model: models.find((model) => model.id === id) ?? null, remember, forget };
}
