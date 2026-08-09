"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import type { ActiveCall, CallInvite } from "@/hooks/use-web-rtc-call";
import type { ProfileRow } from "@/lib/supabase/types";

function initials(name?: string | null) {
  return (name?.trim()?.slice(0, 1) || "U").toUpperCase();
}

function StreamVideo({ stream, muted = false, className = "" }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => undefined);
    }
  }, [stream]);

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
}) {
  const remotes = Object.entries(remoteStreams);
  const profileName = (id: string) => profiles.find((profile) => profile.id === id)?.display_name || "Participant";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#020812]/98 text-white backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">{call.mode === "video" ? "Video call" : "Voice call"}</p>
          <h2 className="mt-1 text-lg font-semibold">{call.conversationTitle}</h2>
        </div>
        <div className="text-right text-xs text-slate-400">{remotes.length + 1} connected</div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
        {call.mode === "video" ? (
          <div className={`grid h-full w-full max-w-6xl gap-3 ${remotes.length <= 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {remotes.length === 0 && (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-[#071827]">
                <div className="text-center">
                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-cyan-500/15 text-3xl font-bold text-cyan-200 yama-call-pulse">
                    {initials(call.callerName)}
                  </div>
                  <p className="mt-5 font-medium">Calling…</p>
                  <p className="mt-1 text-sm text-slate-500">Waiting for participants to join</p>
                </div>
              </div>
            )}
            {remotes.map(([id, stream]) => (
              <div key={id} className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-black">
                <StreamVideo stream={stream} className="h-full w-full object-cover" />
                <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs backdrop-blur">{profileName(id)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex max-w-3xl flex-wrap items-center justify-center gap-8">
            <div className="text-center">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-500/15 text-3xl font-bold text-cyan-200 yama-call-pulse">
                {initials(call.callerName)}
              </div>
              <p className="mt-4 font-medium">{call.isCaller ? "You" : call.callerName}</p>
            </div>
            {call.memberIds.filter((id) => id !== call.callerId).map((id) => (
              <div key={id} className="text-center">
                <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border text-2xl font-semibold ${remoteStreams[id] ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {initials(profileName(id))}
                </div>
                <p className="mt-3 text-sm">{profileName(id)}</p>
                <p className="text-xs text-slate-500">{remoteStreams[id] ? "Connected" : "Ringing…"}</p>
              </div>
            ))}
            {remotes.map(([id, stream]) => <StreamAudio key={`audio-${id}`} stream={stream} />)}
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

      <footer className="flex items-center justify-center gap-4 border-t border-white/10 bg-[#06101d]/95 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onToggleMute} className={`flex h-12 w-12 items-center justify-center rounded-full border ${muted ? "border-rose-400/40 bg-rose-500/20 text-rose-300" : "border-white/10 bg-white/10 text-white"}`} aria-label="Toggle microphone">
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        {call.mode === "video" && (
          <button type="button" onClick={onToggleCamera} className={`flex h-12 w-12 items-center justify-center rounded-full border ${cameraOff ? "border-amber-400/40 bg-amber-500/20 text-amber-300" : "border-white/10 bg-white/10 text-white"}`} aria-label="Toggle camera">
            {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}
        <button type="button" onClick={onHangUp} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-950/40 hover:bg-rose-400" aria-label="Hang up">
          <PhoneOff className="h-6 w-6" />
        </button>
      </footer>
    </div>
  );
}
