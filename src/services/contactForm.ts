export const CONTACT_FORM_URL = 'https://formspree.io/f/mljjawvn';
export const CONTACT_LIMITS = { name: 100, email: 254 } as const;
export type ContactDraft = { name: string; email: string; message: string };
export type ContactErrors = Partial<Record<keyof ContactDraft, string>>;

export function validateContactDraft(draft: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  const name = draft.name.trim();
  const email = draft.email.trim();
  const message = draft.message.trim();
  if (!name || draft.name.length > CONTACT_LIMITS.name || /[\x00-\x1f\x7f]/.test(name)) {
    errors.name = 'Enter your name (up to 100 characters).';
  }
  if (!email || draft.email.length > CONTACT_LIMITS.email || !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email) || /[\x00-\x1f\x7f]/.test(email)) {
    errors.email = 'Enter a valid reply email (up to 254 characters).';
  }
  if (!message) {
    errors.message = 'Enter a message.';
  }
  return errors;
}

/** Submit only explicitly entered contact fields, never chat history or attachments. */
export async function sendContactMessage(draft: ContactDraft): Promise<'sent' | 'unavailable'> {
  if (Object.keys(validateContactDraft(draft)).length) throw new Error('Check the contact fields.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Contact request timed out.')); }, 20000);
  });
  try {
    const response = await Promise.race([fetch(CONTACT_FORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: draft.name.trim(), email: draft.email.trim(), message: draft.message.trim(), _subject: 'PhoneGPT feedback' }),
      signal: controller.signal,
    }), timeout]);
    return response.ok ? 'sent' : 'unavailable';
  } catch {
    // Do not log form fields, server error bodies or request URLs containing user data.
    // No automatic retry: a lost acknowledgement could otherwise send duplicates.
    return 'unavailable';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
