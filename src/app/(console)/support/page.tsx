import Link from "next/link";
import { when } from "@/lib/format";
import { getTicket, listTickets, ticketMessages } from "@/lib/repo";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { EscalateButton } from "@/components/bound";
import { TicketReply } from "@/components/ticket-reply";

export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const tickets = await listTickets();
  const ticket = id ? await getTicket(id) : null;
  const messages = ticket ? await ticketMessages(ticket.id) : [];
  return (
    <div>
      <PageTitle kicker="Inbox" title="Triage is rules. Sending is a person." body="Category and priority come from keyword rules, labeled as such. A model drafts only when you connect one. Email and SMS leave the building only after approval." />
      {!tickets.length ? <Empty title="Inbox is empty" body="The chat widget on /try, an inbound email webhook, or a Twilio SMS webhook will open a ticket here." /> : null}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ul className="space-y-2">
          {tickets.map((item) => (
            <li key={item.id}>
              <Link href={`/support?id=${item.id}`} className="block rounded-2xl border border-line bg-card p-3 text-sm">
                <span className="font-medium">{item.subject}</span>
                <span className="mt-1 block text-xs text-muted">{item.channel} · {item.category} · {item.priority} · rules</span>
              </Link>
            </li>
          ))}
        </ul>
        {ticket ? (
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="serif text-2xl">{ticket.subject}</h2>
              <Badge tone="stone">{ticket.status}</Badge>
              <Badge>{ticket.triage} triage</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{ticket.from_address || ticket.from_name} · {when(Number(ticket.created_at))}</p>
            <div className="mt-4 space-y-3">
              {messages.map((message) => (
                <p key={message.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="text-xs text-muted">{message.direction} · {message.author} · {message.status}</span>
                  <span className="mt-1 block whitespace-pre-wrap">{message.body}</span>
                </p>
              ))}
            </div>
            <div className="mt-4"><TicketReply ticketId={ticket.id} channel={ticket.channel} /></div>
            <div className="mt-3"><EscalateButton id={ticket.id} /></div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
