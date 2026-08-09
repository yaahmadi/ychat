"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, Keyboard, Mic, MicOff, Phone, PhoneOff, UserPlus, Users, Volume2, Video, VideoOff } from "lucide-react";
import type { ActiveCall, CallInvite } from "@/hooks/use-web-rtc-call";
import type { ProfileRow } from "@/lib/supabase/types";

function initials(name?: string | null) {
  return (name?.trim()?.slice(0, 1) || "U").toUpperCase();
}

type MediaElementWithSink = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function canSelectAudioOutput() {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

function playTone(frequency = 520, durationMs = 120) {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationMs / 1000);
    window.setTimeout(() => void context.close().catch(() => undefined), durationMs + 80);
  } catch {
    // Browser audio output can be blocked until a user gesture.
  }
}

function StreamVideo({ stream, muted = false, sinkId, className = "" }: { stream: MediaStream; muted?: boolean; sinkId?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!sinkId || !ref.current) return;
    const element = ref.current as MediaElementWithSink;
    void element.setSinkId?.(sinkId).catch(() => undefined);
  }, [sinkId]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function StreamAudio({ stream, sinkId }: { stream: MediaStream; sinkId?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => {
    if (!sinkId || !ref.current) return;
    const element = ref.current as MediaElementWithSink;
    void element.setSinkId?.(sinkId).catch(() => undefined);
  }, [sinkId]);

  return <audio ref={ref} autoPlay playsInline />;
}

export function IncomingCallCard({
  invite,
  onAccept,
  onDecline,
}: {
  invite: CallInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[#020812]/98 px-6 text-center text-white backdrop-blur-xl">
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-cyan-500/15 text-5xl font-bold text-cyan-200 yama-call-pulse">
        {initials(invite.callerName)}
      </div>
      <p className="mt-8 text-xs uppercase tracking-[0.22em] text-cyan-300">Incoming {invite.mode} call</p>
      <h2 className="mt-3 max-w-sm truncate text-3xl font-semibold">{invite.callerName}</h2>
      <p className="mt-2 max-w-sm truncate text-sm text-slate-400">{invite.conversationTitle}</p>
      <div className="mt-12 flex w-full max-w-xs items-center justify-between gap-10">
        <button type="button" onClick={onDecline} className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/40">
          <PhoneOff className="h-7 w-7" />
        </button>
        <button type="button" onClick={onAccept} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/30">
          {invite.mode === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
        </button>
      </div>
      <div className="mt-4 flex w-full max-w-xs items-center justify-between px-1 text-xs text-slate-400">
        <span>Decline</span>
        <span>Accept</span>
      </div>
    </div>
  );
}

export function ActiveCallOverlay({
  call,
  localStream,
  remoteStreams,
  profiles,
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onHangUp,
  callError,
}: {
  call: ActiveCall;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  profiles: ProfileRow[];
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onHangUp: () => void;
  callError?: string | null;
}) {
  const remotes = Object.entries(remoteStreams);
  const profileName = (id: string) => profiles.find((profile) => profile.id === id)?.display_name || "Participant";
  const otherIds = call.memberIds.filter((id) => id !== call.callerId);
  const primaryName = call.isCaller
    ? (call.conversationTitle === "Private conversation" ? profileName(otherIds[0] || "") : call.conversationTitle)
    : call.callerName;
  const callState = callError || (remotes.length > 0 ? "Connected" : call.isCaller ? "Calling..." : "In call");
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [dialed, setDialed] = useState("");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputId, setAudioOutputId] = useState("");
  const outputSupported = canSelectAudioOutput();

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    void navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        setAudioDevices(devices.filter((device) => device.kind === "audiooutput"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const audioOutputLabel = useMemo(() => {
    if (!outputSupported) return "Phone audio";
    if (!audioOutputId) return "Default";
    return audioDevices.find((device) => device.deviceId === audioOutputId)?.label || "Selected audio";
  }, [audioDevices, audioOutputId, outputSupported]);

  useEffect(() => {
    if (!call.isCaller || remotes.length > 0 || callError) return;
    playTone(440, 140);
    const timer = window.setInterval(() => playTone(440, 140), 2200);
    return () => window.clearInterval(timer);
  }, [call.isCaller, callError, remotes.length]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#020812]/98 text-white backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">{call.mode === "video" ? "Video call" : "Voice call"}</p>
          <h2 className="mt-1 max-w-[70vw] truncate text-xl font-semibold">{call.isCaller ? `Calling ${primaryName}` : primaryName}</h2>
          <p className={`mt-1 text-xs ${callError ? "text-rose-300" : "text-slate-400"}`}>{callState}</p>
        </div>
        <div className="text-right text-xs text-slate-400">{remotes.length + 1} connected</div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
        {call.mode === "video" ? (
          <div className={`grid h-full w-full max-w-6xl gap-3 ${remotes.length <= 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {remotes.length === 0 && (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-[#071827]">
                <div className="text-center">
                  <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-cyan-500/15 text-4xl font-bold text-cyan-200 yama-call-pulse">
                    {initials(primaryName)}
                  </div>
                  <p className="mt-5 text-lg font-medium">{primaryName}</p>
                  <p className={`mt-1 text-sm ${callError ? "text-rose-300" : "text-slate-500"}`}>{callState}</p>
                </div>
              </div>
            )}
            {remotes.map(([id, stream]) => (
              <div key={id} className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-black">
                <StreamVideo stream={stream} sinkId={audioOutputId} className="h-full w-full object-cover" />
                <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur">{profileName(id)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center">
            <div className="text-center">
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-500/15 text-5xl font-bold text-cyan-200 yama-call-pulse">
                {initials(primaryName)}
              </div>
              <p className="mt-5 text-2xl font-semibold">{primaryName}</p>
              <p className={`mt-1 text-sm ${callError ? "text-rose-300" : "text-slate-500"}`}>{callState}</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            {otherIds.map((id) => (
              <div key={id} className="text-center">
                <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border text-2xl font-semibold ${remoteStreams[id] ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {initials(profileName(id))}
                </div>
                <p className="mt-3 text-sm">{profileName(id)}</p>
                <p className="text-xs text-slate-500">{remoteStreams[id] ? "Connected" : "Ringing…"}</p>
              </div>
            ))}
            </div>
            {remotes.map(([id, stream]) => <StreamAudio key={`audio-${id}`} stream={stream} sinkId={audioOutputId} />)}
          </div>
        )}

        {call.mode === "video" && localStream && (
          <div className="absolute bottom-5 right-5 h-36 w-24 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl sm:h-48 sm:w-32">
            {cameraOff ? (
              <div className="flex h-full items-center justify-center bg-[#071827] text-slate-500"><VideoOff className="h-7 w-7" /></div>
            ) : (
              <StreamVideo stream={localStream} muted className="h-full w-full object-cover" />
            )}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[10px]">You</div>
          </div>
        )}
      </div>

      {audioMenuOpen && (
        <div className="mx-auto mb-3 w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#071827] p-3 text-sm shadow-2xl">
          <div className="mb-2 flex items-center gap-2 text-cyan-200"><Bluetooth className="h-4 w-4" /> Audio output</div>
          {outputSupported ? (
            <div className="space-y-1">
              <button type="button" onClick={() => { setAudioOutputId(""); setAudioMenuOpen(false); }} className={`w-full rounded-xl px-3 py-2 text-left ${audioOutputId === "" ? "bg-cyan-500 text-slate-950" : "hover:bg-white/5"}`}>Default / speaker</button>
              {audioDevices.map((device) => (
                <button key={device.deviceId} type="button" onClick={() => { setAudioOutputId(device.deviceId); setAudioMenuOpen(false); }} className={`w-full rounded-xl px-3 py-2 text-left ${audioOutputId === device.deviceId ? "bg-cyan-500 text-slate-950" : "hover:bg-white/5"}`}>{device.label || "Audio device"}</button>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">This browser controls speaker, AirPods and Bluetooth from the phone system audio menu.</p>
          )}
        </div>
      )}

      {keypadOpen && (
        <div className="mx-auto mb-3 w-[min(92vw,360px)] rounded-2xl border border-white/10 bg-[#071827] p-4 shadow-2xl">
          <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-center font-mono text-lg tracking-widest text-cyan-100">{dialed || "Dial pad"}</div>
          <div className="grid grid-cols-3 gap-2">
            {"123456789*0#".split("").map((key, index) => (
              <button key={key} type="button" onClick={() => { playTone(420 + index * 28, 110); setDialed((current) => `${current}${key}`); }} className="rounded-2xl bg-white/10 py-3 text-xl font-semibold hover:bg-white/15">{key}</button>
            ))}
          </div>
          <button type="button" onClick={() => setDialed("")} className="mt-3 w-full rounded-xl border border-white/10 py-2 text-sm text-slate-300">Clear</button>
        </div>
      )}

      <footer className="flex items-center justify-center gap-3 border-t border-white/10 bg-[#06101d]/95 px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:py-5">
        <button type="button" onClick={() => { playTone(muted ? 620 : 360, 90); onToggleMute(); }} className={`flex h-12 w-12 items-center justify-center rounded-full border ${muted ? "border-rose-400/40 bg-rose-500/20 text-rose-300" : "border-white/10 bg-white/10 text-white"}`} aria-label="Toggle microphone" title="Mute">
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => { playTone(520, 90); setAudioMenuOpen((current) => !current); }} className="flex h-12 min-w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 px-3 text-white" aria-label="Audio output" title={audioOutputLabel}>
          <Volume2 className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => { playTone(460, 90); setKeypadOpen((current) => !current); }} className={`flex h-12 w-12 items-center justify-center rounded-full border ${keypadOpen ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/10 text-white"}`} aria-label="Dial pad" title="Keypad">
          <Keyboard className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => playTone(560, 90)} className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white sm:flex" aria-label="Add contact" title="Add contact">
          <UserPlus className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => playTone(580, 90)} className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white sm:flex" aria-label="Merge call" title="Merge call">
          <Users className="h-5 w-5" />
        </button>
        {call.mode === "video" && (
          <button type="button" onClick={onToggleCamera} className={`flex h-12 w-12 items-center justify-center rounded-full border ${cameraOff ? "border-amber-400/40 bg-amber-500/20 text-amber-300" : "border-white/10 bg-white/10 text-white"}`} aria-label="Toggle camera">
            {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}
        <button type="button" onClick={() => { playTone(260, 140); onHangUp(); }} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/40 hover:bg-rose-400" aria-label="Hang up">
          <PhoneOff className="h-6 w-6" />
        </button>
      </footer>
    </div>
  );
}
