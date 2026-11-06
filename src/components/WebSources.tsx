import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import type { WebSearchProvenance } from '../services/webSearchTypes';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';

export type WebSourcesProps = { provenance: WebSearchProvenance };

type DisplaySource = { id: string; title: string; url: string };

function isDisplaySource(value: unknown): value is DisplaySource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  return typeof source.id === 'string' && source.id.trim().length > 0
    && typeof source.title === 'string' && typeof source.url === 'string';
}

function secureSourceUrl(value: string): { url: string; domain: string } | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return undefined;
    const domain = parsed.hostname.toLowerCase().replace(/\.$/, '');
    // Exclude IP literals and local names, including alternate IPv4 spellings
    // normalized by URL, so they cannot open private or loopback addresses.
    if (!domain.includes('.') || domain.includes(':') || /^[\d.]+$/.test(domain)
      || /(?:^|\.)(?:localhost|local|localdomain|internal|lan|home)$/.test(domain)) return undefined;
    return { url: parsed.href, domain };
  } catch {
    return undefined;
  }
}

function displayDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

export function WebSources({ provenance }: WebSourcesProps) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const storedSources: unknown = provenance?.sources;
  const sources = Array.isArray(storedSources) ? storedSources.filter(isDisplaySource) : [];
  if (sources.length === 0) return null;
  const retrieved = displayDate(provenance?.retrievedAt);

  const openSource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open source', 'Please try again.');
    }
  };

  return <View style={{ marginTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Sources, ${sources.length}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '600', flex: 1 }}>Sources ({sources.length})</Text>
      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}><AppIcon name="chevron" color={colors.secondary} size={16} /></View>
    </Pressable>
    {expanded && <View style={{ gap: 4 }}>
      {retrieved && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>Retrieved {retrieved}</Text>}
      {sources.map((source, index) => {
        const target = secureSourceUrl(source.url);
        const label = `[${source.id}]`;
        const title = source.title.trim() || 'Untitled source';
        const details = target?.domain;
        const content = <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: target ? colors.primary : colors.secondary, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{label} {title}</Text>
          {!!details && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{details}</Text>}
        </View>;
        return target
          ? <Pressable key={`${source.id}-${index}`} accessibilityRole="link" accessibilityLabel={`${label} ${title}${details ? `, ${details}` : ''}`} onPress={() => { void openSource(target.url); }} style={{ minHeight: 44, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>{content}</Pressable>
          : <View key={`${source.id}-${index}`} style={{ minHeight: 44, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>{content}</View>;
      })}
    </View>}
  </View>;
}
