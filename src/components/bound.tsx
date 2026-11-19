"use client";

import { Runner } from "@/components/runner";
import {
  approveCampaignAction,
  approveOutboxAction,
  approvePayoutAction,
  clusterFeedbackAction,
  escalateTicketAction,
  markPaidAction,
  setDemoAction,
  syncAdsAction,
  testConnectionAction,
} from "@/server/actions";

export function TestConnectionButton({ id }: { id: string }) {
  return <Runner label="Test connection" tone="ghost" action={() => testConnectionAction(id)} />;
}

export function ClusterButton() {
  return (
    <Runner
      label="Cluster feedback"
      action={async () => {
        const clusters = await clusterFeedbackAction();
        return { message: `${clusters.length} themes.` };
      }}
    />
  );
}

export function PayoutButton({ id, method }: { id: string; method: "stripe" | "manual" }) {
  const stripe = method === "stripe";
  return (
    <Runner
      label={stripe ? "Approve Stripe transfer" : "Approve manual payout"}
      tone={stripe ? "ink" : "ghost"}
      confirmText={stripe ? "Send this payable balance through Stripe? This moves money." : "Mark this balance approved for a manual payment? No money moves."}
      action={() => approvePayoutAction(id, method)}
    />
  );
}

export function MarkPaidButton({ id }: { id: string }) {
  return (
    <Runner
      label="Mark paid"
      tone="ghost"
      confirmText="Mark this manual payout paid? Growth Engine will not move money."
      action={async () => {
        await markPaidAction(id);
        return { message: "Marked paid." };
      }}
    />
  );
}

export function ApproveSendButton({ id }: { id: string }) {
  return (
    <Runner
      label="Approve send"
      confirmText="Send this message through the connected provider?"
      action={() => approveOutboxAction(id)}
    />
  );
}

export function EscalateButton({ id }: { id: string }) {
  return (
    <Runner
      label="Escalate"
      tone="ghost"
      confirmText="Mark this ticket urgent?"
      action={async () => {
        await escalateTicketAction(id);
        return { message: "Escalated in the inbox. No pager was called." };
      }}
    />
  );
}

export function SyncButton({ platform }: { platform: "meta" | "google" | "tiktok" }) {
  const label = platform === "meta" ? "Sync Meta" : platform === "google" ? "Sync Google" : "Sync TikTok";
  return <Runner label={label} tone="ghost" action={() => syncAdsAction(platform)} />;
}

export function DemoButton({ on }: { on: boolean }) {
  return (
    <Runner
      label={on ? "Turn demo mode off" : "Turn demo mode on"}
      tone="ghost"
      confirmText={on ? "Remove the sample rows?" : "Load clearly labeled EXAMPLE campaigns? They are not real results."}
      action={async () => {
        await setDemoAction(!on);
        return { message: on ? "Demo rows removed." : "Demo rows loaded." };
      }}
    />
  );
}

export function CampaignButton({ id, action, name }: { id: string; action: "pause" | "scale"; name: string }) {
  const pause = action === "pause";
  return (
    <Runner
      label={pause ? "Approve pause" : "Approve +20% daily budget"}
      confirmText={
        pause
          ? `Approve a pause on ${name}? If the platform is connected, Growth Engine will call it. This stops delivery. It does not create spend.`
          : `Approve a 20% daily budget increase on ${name}? This can spend more money only if the platform call succeeds.`
      }
      action={() => approveCampaignAction(id, action)}
    />
  );
}
