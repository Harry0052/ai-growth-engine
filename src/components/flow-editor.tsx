"use client";

import { useState } from "react";
import { saveFlowAction } from "@/server/actions";

type Step = { type: "wait" | "send"; hours?: number; subject?: string; body?: string };

export function FlowEditor({
  initial,
}: {
  initial?: { id: string; name: string; channel: "email" | "sms"; trigger_event: string; auto_send: number; respect_quiet_hours: number; status: string; definition: Step[] };
}) {
  const [steps, setSteps] = useState<Step[]>(initial?.definition?.length ? initial.definition : [{ type: "send", subject: "Welcome", body: "You are in. Reply if you want a human." }]);
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await saveFlowAction({
          id: initial?.id,
          name: String(data.get("name") || "Flow"),
          channel: String(data.get("channel")) === "sms" ? "sms" : "email",
          triggerEvent: String(data.get("trigger") || "signup"),
          autoSend: data.get("auto") === "on",
          respectQuietHours: data.get("quiet") !== "off",
          status: String(data.get("status") || "active"),
          steps,
        });
        setMessage("Saved. Auto-send stays off unless you checked it. Quiet hours and STOP still apply.");
      }}
    >
      <input name="name" defaultValue={initial?.name || "Onboarding"} className="rounded-xl border border-line px-3 py-2 text-sm" />
      <div className="grid gap-2 sm:grid-cols-3">
        <select name="channel" defaultValue={initial?.channel || "email"} className="rounded-xl border border-line px-3 py-2 text-sm">
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <input name="trigger" defaultValue={initial?.trigger_event || "signup"} className="rounded-xl border border-line px-3 py-2 text-sm" placeholder="Trigger event" />
        <select name="status" defaultValue={initial?.status || "active"} className="rounded-xl border border-line px-3 py-2 text-sm">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto" defaultChecked={Boolean(initial?.auto_send)} /> Auto-send when a provider is connected</label>
      <select name="quiet" defaultValue={initial?.respect_quiet_hours === 0 ? "off" : "on"} className="rounded-xl border border-line px-3 py-2 text-sm">
        <option value="on">Respect quiet hours</option>
        <option value="off">Allow sends during quiet hours</option>
      </select>
      <ol className="space-y-3 border-l border-line pl-4">
        {steps.map((step, index) => (
          <li key={index} className="rounded-xl border border-line p-3">
            <div className="flex gap-2 text-sm">
              <select value={step.type} onChange={(event) => setSteps(steps.map((item, i) => (i === index ? { ...item, type: event.target.value as Step["type"] } : item)))}>
                <option value="send">Send</option>
                <option value="wait">Wait</option>
              </select>
              <button type="button" className="text-danger" onClick={() => setSteps(steps.filter((_, i) => i !== index))}>Remove</button>
            </div>
            {step.type === "wait" ? (
              <input className="mt-2 w-full rounded-lg border border-line px-2 py-1 text-sm" type="number" min={1} value={step.hours || 24} onChange={(event) => setSteps(steps.map((item, i) => (i === index ? { ...item, hours: Number(event.target.value) } : item)))} />
            ) : (
              <>
                <input className="mt-2 w-full rounded-lg border border-line px-2 py-1 text-sm" placeholder="Subject" value={step.subject || ""} onChange={(event) => setSteps(steps.map((item, i) => (i === index ? { ...item, subject: event.target.value } : item)))} />
                <textarea className="mt-2 min-h-20 w-full rounded-lg border border-line px-2 py-1 text-sm" value={step.body || ""} onChange={(event) => setSteps(steps.map((item, i) => (i === index ? { ...item, body: event.target.value } : item)))} />
              </>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="text-sm underline" onClick={() => setSteps([...steps, { type: "wait", hours: 24 }])}>Add step</button>
      <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper" type="submit">Save flow</button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </form>
  );
}
