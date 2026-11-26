"use client";
import clsx from "clsx";
import { Check, Cpu, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal, useToast } from "@/components/ui";
import { managedAiUrl } from "@/lib/aiKeys";
import { getSettings, updateSettings } from "@/lib/repo";

const OPTIONS = [
  { ai: true, icon: Sparkles, title: "SanoAI AI", tag: "Recommended", body: "Clearer, AI-written answers. Your questions and record text are sent to a third-party AI service. No key needed." },
  { ai: false, icon: Cpu, title: "Built-in rules", tag: "Private", body: "Answers come from SanoAI's own rule engines in your browser. Nothing is sent to an AI service." },
];

/** The two ways SanoAI can answer. `value` is undefined until the user has chosen. */
export function AiOptions({ value, onChoose }: { value?: boolean; onChoose: (ai: boolean) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How SanoAI answers">
        {OPTIONS.map((o) => (
          <button key={o.title} type="button" role="radio" aria-checked={value === o.ai} onClick={() => onChoose(o.ai)} className={clsx("rounded-2xl border p-4 text-left transition hover:border-sano-400", value === o.ai ? "border-sano-500 bg-sano-50 ring-2 ring-sano-200" : "border-navy-100 bg-white")}>
            <span className="flex items-center gap-2">
              <o.icon className="h-5 w-5 text-sano-600" />
              <span className="text-[15px] font-semibold text-navy-900">{o.title}</span>
              {value === o.ai ? <Check className="ml-auto h-4 w-4 text-sano-700" /> : <span className="ml-auto text-[11px] font-medium text-navy-400">{o.tag}</span>}
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-navy-600">{o.body}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-navy-400">AI services, especially free ones, may keep what is sent and use it to improve their models. Don&apos;t share anything you would not want stored.</p>
    </div>
  );
}

/** Asked once, before any health information can reach an AI service. */
export default function AiChoice({ userId, onChosen }: { userId: string; onChosen: () => void }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!managedAiUrl()) return;
    getSettings(userId).then((s) => setOpen(!s.aiChoiceMade)).catch(() => {});
  }, [userId]);

  async function choose(ai: boolean) {
    try {
      await updateSettings(userId, { consentExternalAi: ai });
      setOpen(false);
      onChosen();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="How should SanoAI answer?">
      <AiOptions onChoose={(ai) => void choose(ai)} />
      <p className="mt-3 text-[12.5px] text-navy-500">You can change this any time in Settings. Closing this keeps built-in rules for now.</p>
    </Modal>
  );
}
