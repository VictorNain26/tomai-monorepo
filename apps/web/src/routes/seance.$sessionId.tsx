import { useChat } from '@ai-sdk/react';
import { Button, Input } from '@repo/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import { useEffect, useId, useRef, useState } from 'react';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { TomHead } from '../components/tom';
import { TomText } from '../components/tom-text';
import { api, isProblem } from '../lib/api';
import type { TurnStep } from 'tomai-server/contract';
import { chatMessage, isTurnStep, messagesQuery, textOf, toUIMessage, waitingText, type ChatMessage, type TurnBody } from '../lib/chat';
import { meQuery } from '../lib/me';

/** A session with Tom: what was said, then the chat. */
export const Route = createFileRoute('/seance/$sessionId')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me?.role !== 'student') throw redirect({ to: '/' });
  },
  loader: ({ context, params }) => context.queryClient.query(messagesQuery(params.sessionId)),
  component: Session,
});

function Session() {
  const { sessionId } = Route.useParams();
  const { sessionLost } = Route.useRouteContext();
  const { data: stored } = useSuspenseQuery(messagesQuery(sessionId));
  const [text, setText] = useState('');
  const aiNoticeId = useId();
  const [step, setStep] = useState<TurnStep | null>(null);
  const [cue, setCue] = useState<string | null>(null);
  // The server keeps the conversation: a turn sends the new message only, to the chat's session.
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        prepareSendMessagesRequest: ({ id, messages }) => ({
          api: api.sessions[':id'].messages.$path({ param: { id } }),
          body: { text: textOf(messages.at(-1)), inputMode: 'text' } satisfies TurnBody,
        }),
      }),
  );
  const { messages, setMessages, sendMessage, status, error } = useChat<ChatMessage>({
    id: sessionId,
    messages: stored.map(toUIMessage),
    transport,
    onData: (part) => {
      if (part.type === 'data-cue') setCue(part.data);
      else if (isTurnStep(part.data)) setStep(part.data);
    },
    // A refused or failed turn stored nothing: its message leaves the conversation and comes back
    // to the field, to be sent again.
    onError: (failure) => {
      if (isProblem(failure, 'UNAUTHENTICATED')) {
        sessionLost();
        return;
      }
      setMessages((shown) => {
        const last = shown.at(-1);
        if (last?.role !== 'user') return shown;
        setText(textOf(last));
        return shown.slice(0, -1);
      });
    },
  });

  // The field stays in sight up in the conversation: what a send brings comes into sight with it.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, status, error]);

  const busy = status === 'submitted' || status === 'streaming';
  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    setStep(null);
    setCue(null);
    void sendMessage({ text: trimmed });
  };

  return (
    <Page title="Séance avec Tom">
      <Link to="/" className="min-h-11 py-3 text-sm text-primary underline">
        Retour à tes séances
      </Link>
      <p className="flex items-center gap-3 text-sm text-muted-foreground">
        <TomHead className="size-8 shrink-0" />
        Tom t’aide à trouver, il ne fait pas à ta place.
      </p>
      <ol aria-label="Conversation" className="flex flex-col gap-5">
        {messages.map((message) =>
          message.role === 'user' ? (
            <li key={message.id} className="max-w-[85%] self-end rounded-2xl bg-secondary px-4 py-3 whitespace-pre-wrap text-secondary-foreground">
              <span className="sr-only">Toi : </span>
              {textOf(message)}
            </li>
          ) : (
            <li key={message.id} className="flex max-w-full gap-3 self-start text-lg leading-relaxed text-foreground">
              <TomHead className="mt-0.5 size-8 shrink-0" />
              <div className="min-w-0">
                <span className="sr-only">Tom : </span>
                <TomText>{textOf(message)}</TomText>
              </div>
            </li>
          ),
        )}
      </ol>
      {cue && !busy && (
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-card-foreground">
          <span className="text-sm font-bold text-muted-foreground">Pour vous, parent</span>
          <p role="note" aria-label="Pour vous, parent">
            {cue}
          </p>
        </div>
      )}
      {status === 'submitted' && <Notice tone="info">{waitingText(step)}</Notice>}
      {error && <Notice tone="error">{chatMessage(error)}</Notice>}
      <div ref={endRef} />
      <div className="sticky bottom-0 flex flex-col gap-2 bg-background pt-2 pb-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label htmlFor="message" className="sr-only">
            Ton message
          </label>
          <Input
            id="message"
            autoComplete="off"
            aria-describedby={aiNoticeId}
            placeholder="Ta question, ou ton essai"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
          <Button type="submit" disabled={busy || text.trim() === ''}>
            Envoyer
          </Button>
        </form>
        <p id={aiNoticeId} className="text-sm text-muted-foreground">
          Tom est une IA : il peut se tromper, vérifie avec ton cours.
        </p>
      </div>
    </Page>
  );
}
