export type WebSource = { id: string; title: string; url: string; snippet: string; publishedAt?: string };
export type WebSearchResult = { schemaVersion: 1; requestId: string; query: string; provider: 'brave'; retrievedAt: string; sources: WebSource[] };
export type WebSearchProvenance = Pick<WebSearchResult, 'provider' | 'retrievedAt' | 'sources'>;
