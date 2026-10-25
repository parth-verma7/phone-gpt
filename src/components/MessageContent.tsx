import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

type MessageContentProps = {
  content: string;
  color?: string;
};

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'orderedList'; items: string[] }
  | { type: 'bulletList'; items: string[] }
  | { type: 'paragraph'; text: string };

const ORDERED_ITEM = /^\s*(\d+)\.\s+(.+)$/;
const BULLET_ITEM = /^\s*[-*+]\s+(.+)$/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const INLINE_TOKENS = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let listType: 'orderedList' | 'bulletList' | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join('\n').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listType && listItems.length) blocks.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  for (const line of lines) {
    const heading = line.match(HEADING);
    const ordered = line.match(ORDERED_ITEM);
    const bullet = line.match(BULLET_ITEM);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    if (ordered || bullet) {
      const type = ordered ? 'orderedList' : 'bulletList';
      if (listType && listType !== type) flushList();
      flushParagraph();
      listType = type;
      listItems.push((ordered?.[2] ?? bullet?.[1] ?? '').trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(text: string, color: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKENS)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <Text key={`${start}-bold`} style={styles.bold}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else {
      nodes.push(
        <Text key={`${start}-code`} style={styles.inlineCode}>
          {token.slice(1, -1)}
        </Text>,
      );
    }
    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [<Text key="empty" style={{ color }}>{text}</Text>];
}

function InlineText({ text, color }: { text: string; color: string }) {
  return (
    <Text selectable style={[styles.boundedText, styles.text, { color }]}>
      {renderInline(text, color)}
    </Text>
  );
}

export function MessageContent({ content, color = '#1F2028' }: MessageContentProps) {
  const blocks = parseBlocks(content);

  return (
    <View style={styles.content}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingStyle =
            block.level === 1 ? styles.headingOne : block.level === 2 ? styles.headingTwo : styles.headingThree;
          return (
            <Text key={`${block.type}-${index}`} selectable style={[styles.boundedText, styles.heading, headingStyle, { color }]}>
              {renderInline(block.text, color)}
            </Text>
          );
        }

        if (block.type === 'orderedList' || block.type === 'bulletList') {
          return (
            <View key={`${block.type}-${index}`} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`item-${itemIndex}`} style={styles.listItem}>
                  <Text selectable style={[styles.marker, { color }]}>
                    {block.type === 'orderedList' ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <View style={styles.listText}>
                    <InlineText text={item} color={color} />
                  </View>
                </View>
              ))}
            </View>
          );
        }

        return <InlineText key={`${block.type}-${index}`} text={block.text} color={color} />;
      })}
    </View>
  );
}

// Web needs wrapping that also reduces a long token's intrinsic minimum width.
// Keep the original text intact so selection and copying preserve URLs and code.
const boundedText: TextStyle & { overflowWrap?: 'anywhere' } = {
  minWidth: 0,
  maxWidth: '100%',
  flexShrink: 1,
  ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' as const } : {}),
};

const styles = StyleSheet.create({
  content: {
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
  },
  boundedText,
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
  bold: {
    fontWeight: '700',
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.16)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  heading: {
    fontWeight: '700',
    marginBottom: 6,
  },
  headingOne: {
    fontSize: 22,
    lineHeight: 29,
  },
  headingTwo: {
    fontSize: 20,
    lineHeight: 27,
  },
  headingThree: {
    fontSize: 17,
    lineHeight: 24,
  },
  list: {
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
    marginVertical: 4,
  },
  listItem: {
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    marginBottom: 3,
  },
  marker: {
    fontSize: 16,
    lineHeight: 23,
    width: 26,
    flexShrink: 0,
    textAlign: 'right',
    marginRight: 7,
  },
  listText: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 1,
  },
});
