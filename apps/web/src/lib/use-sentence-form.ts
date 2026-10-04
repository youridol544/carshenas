'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState, useTransition, type SyntheticEvent } from 'react';
import { ASK_FAILED_MESSAGE, ASK_IDLE, tidySentence, type AskState } from '@/lib/search-sentence';

// The client half of the one-step search box (CS-111, ADR-0043), shared by the home page's hero and the search page's bar.
// The box is a real form whose action is the server's (`ask`): sent before the script has loaded, or with none, the
// browser posts it and the server redirects. Once the script runs, this takes the submit over: it asks the same action
// from a transition, and on the answer navigates itself with the router. A client navigation, unlike the redirect a
// server action performs, keeps the page it leaves (Next.js keeps it hidden with its state), so the back button brings
// the home page back with what was typed, and leaves the focus in the box on the search page. A second press while the
// first is on its way does nothing; the pending flag covers the question and, in the same transition, the navigation.
// A question that never arrives (the network, the server) is a failure to say under the box, like the server's own: the
// sentence stays in it, and nothing reaches an error screen.

export type AskAction = (previous: AskState, formData: FormData) => Promise<AskState>;
export type AskFailure = Extract<AskState, { status: 'failed' }>;

function textOf(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

export function useSentenceForm(ask: AskAction, go?: (href: string) => void) {
  const router = useRouter();
  // The form's own action, what runs when the script has not: React makes the server function's reference part of the form.
  const [, action] = useActionState(ask, ASK_IDLE);
  const [pending, begin] = useTransition();
  const [failure, setFailure] = useState<AskFailure | null>(null);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const { submitter } = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent : { submitter: null };
    const form = new FormData(event.currentTarget, submitter);
    form.set('by', 'script');
    const sentence = tidySentence(textOf(form.get('example')) || textOf(form.get('ask')));
    begin(async () => {
      const answer: AskState = await ask(ASK_IDLE, form).catch(() => ({
        status: 'failed' as const,
        message: ASK_FAILED_MESSAGE,
        sentence,
      }));
      // After an await the transition has to be named again for what follows to belong to it.
      startTransition(() => {
        if (answer.status === 'found') {
          setFailure(null);
          if (go === undefined) router.push(answer.href as Route);
          else go(answer.href);
        } else if (answer.status === 'failed') {
          setFailure(answer);
        }
      });
    });
  }

  return { action, pending, failure, submit };
}
