"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { describeVoiceIntent, executeVoiceIntent, parseVoiceCommand } from "@/lib/voice-intents";
import { cn } from "@/lib/utils";
import { Toast, type ToastState } from "@/components/Toast";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
};

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function MicrophoneIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7">
      <path
        fill="currentColor"
        d="M12 15c1.7 0 3-1.3 3-3V6c0-1.7-1.3-3-3-3S9 4.3 9 6v6c0 1.7 1.3 3 3 3Zm5.3-3c0 3-2.1 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.6 2.5 6.3 6.1 6.7V22h1.8v-3.3c3.6-.4 6.1-3.1 6.1-6.7h-1.7Z"
      />
      {active ? <circle cx="18.5" cy="5.5" r="2.2" fill="#ef4444" /> : null}
    </svg>
  );
}

export function FloatingVoiceButton() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const intent = useMemo(() => parseVoiceCommand(transcript), [transcript]);
  const understood = useMemo(() => (transcript ? describeVoiceIntent(intent) : ""), [intent, transcript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(nextToast: ToastState) {
    setToast(nextToast);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function submitVoiceIntent(input: string) {
    const cleanInput = input.trim();

    if (!cleanInput || isSaving) {
      return;
    }

    setTranscript(cleanInput);
    setManualInput(cleanInput);
    setIsSaving(true);

    try {
      const result = await executeVoiceIntent(parseVoiceCommand(cleanInput));
      showToast({ type: "success", message: result.message });
      setIsEditing(false);
      setTranscript("");
      setManualInput("");
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Commande vocale impossible." });
      setIsEditing(true);
    } finally {
      setIsSaving(false);
    }
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setIsSupported(false);
      setIsEditing(true);
      showToast({ type: "error", message: "Micro non supporte sur ce navigateur. Ecris ta commande." });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      showToast({ type: "error", message: "Reconnaissance vocale interrompue. Reessaie ou ecris ta commande." });
    };
    recognition.onresult = (event) => {
      const spokenText = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (spokenText) {
        setTranscript(spokenText);
        setManualInput(spokenText);
        setIsEditing(false);
      }
    };

    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function cancelPanel() {
    setTranscript("");
    setManualInput("");
    setIsEditing(false);
  }

  const showPanel = transcript || isEditing || !isSupported;

  return (
    <>
      <Toast toast={toast} />

      {showPanel ? (
        <section className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] right-4 z-40 w-[min(calc(100vw-2rem),24rem)] rounded-lg border border-emerald-300/50 bg-zinc-950/95 p-4 text-white shadow-2xl shadow-emerald-950/30 backdrop-blur sm:bottom-24 sm:right-6">
          {transcript ? (
            <div className="grid gap-2">
              <div>
                <p className="text-xs font-black uppercase text-emerald-300">Phrase</p>
                <p className="mt-1 text-sm font-semibold text-white">{transcript}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-emerald-300">Action detectee</p>
                <p className="mt-1 text-sm font-semibold text-white">{understood || "Commande non reconnue"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-zinc-200">Micro non supporte sur ce navigateur. Ecris ta commande.</p>
          )}

          {isEditing || !isSupported ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitVoiceIntent(manualInput);
              }}
            >
              <input
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                placeholder="Ajoute au frigo 4 Danone"
                className="h-11 rounded-lg border border-white/10 bg-black px-3 text-sm text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
              <button type="submit" disabled={isSaving} className="h-11 rounded-lg bg-emerald-400 px-4 text-sm font-black text-black transition hover:bg-emerald-300 disabled:bg-zinc-700 disabled:text-zinc-400">
                {isSaving ? "Traitement..." : "Confirmer"}
              </button>
            </form>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => void submitVoiceIntent(transcript)} disabled={isSaving} className="h-10 rounded-lg bg-emerald-400 px-3 text-xs font-black text-black transition hover:bg-emerald-300 disabled:bg-zinc-700 disabled:text-zinc-400">
                Confirmer
              </button>
              <button type="button" onClick={() => setIsEditing(true)} className="h-10 rounded-lg border border-white/15 px-3 text-xs font-black text-zinc-100 transition hover:border-emerald-300">
                Modifier
              </button>
              <button type="button" onClick={cancelPanel} className="h-10 rounded-lg border border-white/15 px-3 text-xs font-black text-zinc-300 transition hover:border-red-300 hover:text-red-100">
                Annuler
              </button>
            </div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Arreter le micro" : "Demarrer le micro"}
        className={cn(
          "fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-4 z-50 grid size-16 place-items-center rounded-full border text-black shadow-2xl transition active:scale-95 sm:right-6",
          isListening
            ? "border-red-200 bg-red-400 shadow-red-950/25"
            : "border-emerald-200 bg-emerald-400 shadow-emerald-950/25 hover:bg-emerald-300",
        )}
      >
        <MicrophoneIcon active={isListening} />
      </button>
    </>
  );
}
