import { useChat } from '@ai-sdk/react';
import { Button, Input } from '@repo/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import { useEffect, useState } from 'react';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { chatMessage, messagesQuery, problemCodeOf, sessionsQuery, textOf, toUIMessage, type TurnBody } from '../lib/chat';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stored } = useSuspenseQuery(messagesQuery(sessionId));
  const [text, setText] = useState('');
  // The server keeps the conversation: a turn sends the new message only.
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: `/api/sessions/${sessionId}/messages`,
        prepareSendMessagesRequest: ({ messages }) => ({ body: { text: textOf(messages.at(-1)), inputMode: 'text' } satisfies TurnBody }),
      }),
  );
  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: stored.map(toUIMessage),
    transport,
    // The first reply names the session, in the background: the list asks again.
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey });
    },
  });

  useEffect(() => {
    if (error && problemCodeOf(error) === 'UNAUTHENTICATED') {
      queryClient.clear();
      void navigate({ to: '/connexion' });
    }
  }, [error, navigate, queryClient]);

  const busy = status === 'submitted' || status === 'streaming';
  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    void sendMessage({ text: trimmed });
  };

  return (
    <Page title="Séance avec Tom">
      <Link to="/" className="min-h-11 py-3 text-sm text-primary underline">
        Retour à tes séances
      </Link>
      <ol aria-label="Conversation" className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={
              message.role === 'user'
                ? 'max-w-[85%] self-end rounded-2xl bg-primary px-4 py-3 whitespace-pre-wrap text-primary-foreground'
                : 'max-w-[85%] self-start rounded-2xl border border-border bg-card px-4 py-3 whitespace-pre-wrap text-card-foreground'
            }
          >
            <span className="sr-only">{message.role === 'user' ? 'Toi : ' : 'Tom : '}</span>
            {textOf(message)}
          </li>
        ))}
      </ol>
      {status === 'submitted' && <Notice tone="info">Tom réfléchit…</Notice>}
      {error && <Notice tone="error">{chatMessage(error)}</Notice>}
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
          placeholder="Écris à Tom"
          value={text}
          maxLength={4000}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <Button type="submit" disabled={busy || text.trim() === ''}>
          Envoyer
        </Button>
      </form>
    </Page>
  );
}
