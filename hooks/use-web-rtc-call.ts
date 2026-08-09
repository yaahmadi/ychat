"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type CallMode = "audio" | "video";

export type CallInvite = {
  callId: string;
  conversationId: string;
  conversationTitle: string;
  mode: CallMode;
  callerId: string;
  callerName: string;
  memberIds: string[];
  createdAt: number;
};

export type ActiveCall = CallInvite & {
  acceptedAt: number;
  isCaller: boolean;
};

type SignalPayload = {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(TURN_URL
    ? [{
        urls: TURN_URL,
        username: TURN_USERNAME || undefined,
        credential: TURN_CREDENTIAL || undefined,
      }]
    : []),
];

async function sendPersonalBroadcast(targetUserId: string, event: string, payload: unknown) {
  const supabase = createClient();
  const channel = supabase.channel(`call-user:${targetUserId}`);

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Call signaling timed out.")), 6000);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timer);
        try {
          await channel.send({ type: "broadcast", event, payload });
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          window.setTimeout(() => void supabase.removeChannel(channel), 200);
        }
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        window.clearTimeout(timer);
        reject(new Error("Unable to connect call signaling."));
      }
    });
  });
}

function mediaConstraints(mode: CallMode): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: mode === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  };
}

export function useWebRtcCall(userId: string | null, displayName: string) {
  const [incomingCall, setIncomingCall] = useState<CallInvite | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const activeCallRef = useRef<ActiveCall | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const sendRoom = useCallback(async (event: string, payload: unknown) => {
    if (!roomChannelRef.current) return;
    await roomChannelRef.current.send({ type: "broadcast", event, payload });
  }, []);

  const closePeer = useCallback((remoteUserId: string) => {
    peersRef.current.get(remoteUserId)?.close();
    peersRef.current.delete(remoteUserId);
    pendingIceRef.current.delete(remoteUserId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[remoteUserId];
      return next;
    });
  }, []);

  const flushPendingIce = useCallback(async (remoteUserId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.get(remoteUserId) ?? [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore a stale ICE candidate after renegotiation.
      }
    }
    pendingIceRef.current.delete(remoteUserId);
  }, []);

  const createPeer = useCallback(
    async (remoteUserId: string, createOffer: boolean) => {
      if (!userId || remoteUserId === userId) return null;

      let pc = peersRef.current.get(remoteUserId);
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peersRef.current.set(remoteUserId, pc);

        const stream = localStreamRef.current;
        stream?.getTracks().forEach((track) => pc?.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          void sendRoom("signal", {
            from: userId,
            to: remoteUserId,
            kind: "ice",
            candidate: event.candidate.toJSON(),
          } satisfies SignalPayload);
        };

        pc.ontrack = (event) => {
          const streamFromEvent = event.streams[0];
          if (streamFromEvent) {
            setRemoteStreams((current) => ({ ...current, [remoteUserId]: streamFromEvent }));
            return;
          }

          setRemoteStreams((current) => {
            const existing = current[remoteUserId] ?? new MediaStream();
            if (!existing.getTracks().some((track) => track.id === event.track.id)) {
              existing.addTrack(event.track);
            }
            return { ...current, [remoteUserId]: existing };
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === "failed" || pc?.connectionState === "closed") {
            closePeer(remoteUserId);
          }
        };
      }

      if (createOffer && pc.signalingState === "stable") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendRoom("signal", {
          from: userId,
          to: remoteUserId,
          kind: "offer",
          sdp: offer,
        } satisfies SignalPayload);
      }

      return pc;
    },
    [closePeer, sendRoom, userId],
  );

  const joinRoom = useCallback(
    async (call: ActiveCall) => {
      if (!userId) return;

      const supabase = createClient();
      if (roomChannelRef.current) {
        await supabase.removeChannel(roomChannelRef.current);
      }

      const room = supabase
        .channel(`call-room:${call.callId}`)
        .on("broadcast", { event: "ready" }, ({ payload }) => {
          const from = String((payload as { from?: string }).from ?? "");
          if (!from || from === userId) return;
          // Existing participants initiate a connection to each newly-ready participant.
          void createPeer(from, true);
        })
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          void (async () => {
            const signal = payload as SignalPayload;
            if (!signal || signal.to !== userId || !signal.from) return;

            const pc = await createPeer(signal.from, false);
            if (!pc) return;

            if (signal.kind === "offer" && signal.sdp) {
              await pc.setRemoteDescription(signal.sdp);
              await flushPendingIce(signal.from, pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendRoom("signal", {
                from: userId,
                to: signal.from,
                kind: "answer",
                sdp: answer,
              } satisfies SignalPayload);
              return;
            }

            if (signal.kind === "answer" && signal.sdp) {
              await pc.setRemoteDescription(signal.sdp);
              await flushPendingIce(signal.from, pc);
              return;
            }

            if (signal.kind === "ice" && signal.candidate) {
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(signal.candidate);
                } catch {
                  // Candidate may be stale after a network transition.
                }
              } else {
                const current = pendingIceRef.current.get(signal.from) ?? [];
                current.push(signal.candidate);
                pendingIceRef.current.set(signal.from, current);
              }
            }
          })().catch((error) => setCallError(error instanceof Error ? error.message : "Call signaling failed."));
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => {
          const from = String((payload as { from?: string }).from ?? "");
          if (from) closePeer(from);
        });

      roomChannelRef.current = room;

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Unable to join the call room.")), 7000);
        room.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            window.clearTimeout(timer);
            await room.send({ type: "broadcast", event: "ready", payload: { from: userId } });
            resolve();
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            window.clearTimeout(timer);
            reject(new Error("Unable to join the call room."));
          }
        });
      });
    },
    [closePeer, createPeer, flushPendingIce, sendRoom, userId],
  );

  const acquireMedia = useCallback(async (mode: CallMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone/camera requires HTTPS (or localhost) and browser permission.");
    }
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(mode));
    localStreamRef.current = stream;
    setLocalStream(stream);
    setMuted(false);
    setCameraOff(false);
    return stream;
  }, []);

  const resetCall = useCallback(async () => {
    const currentUserId = userId;
    const endingCall = activeCallRef.current;

    if (endingCall?.isCaller && currentUserId) {
      const targets = endingCall.memberIds.filter((id) => id !== currentUserId);
      void Promise.all(
        targets.map((target) =>
          sendPersonalBroadcast(target, "call_cancelled", {
            callId: endingCall.callId,
            callerId: currentUserId,
          }).catch(() => undefined),
        ),
      );
    }

    if (roomChannelRef.current && currentUserId) {
      try {
        await roomChannelRef.current.send({ type: "broadcast", event: "leave", payload: { from: currentUserId } });
      } catch {
        // Best-effort leave signal.
      }
    }

    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
    pendingIceRef.current.clear();
    setRemoteStreams({});

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    if (roomChannelRef.current) {
      const supabase = createClient();
      await supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }

    activeCallRef.current = null;
    setActiveCall(null);
    setMuted(false);
    setCameraOff(false);
  }, [userId]);

  const startCall = useCallback(
    async (input: { conversationId: string; conversationTitle: string; mode: CallMode; memberIds: string[] }) => {
      if (!userId) throw new Error("You must be signed in.");
      if (activeCallRef.current) throw new Error("A call is already active.");

      const targets = [...new Set(input.memberIds.filter((id) => id && id !== userId))];
      if (targets.length === 0) throw new Error("There is nobody else in this conversation.");

      setCallError(null);
      await acquireMedia(input.mode);

      const invite: CallInvite = {
        callId: crypto.randomUUID(),
        conversationId: input.conversationId,
        conversationTitle: input.conversationTitle,
        mode: input.mode,
        callerId: userId,
        callerName: displayName || "User",
        memberIds: [userId, ...targets],
        createdAt: Date.now(),
      };
      const call: ActiveCall = { ...invite, acceptedAt: Date.now(), isCaller: true };
      activeCallRef.current = call;
      setActiveCall(call);

      try {
        await joinRoom(call);
        await Promise.all(targets.map((target) => sendPersonalBroadcast(target, "call_invite", invite)));
      } catch (error) {
        await resetCall();
        throw error;
      }
    },
    [acquireMedia, displayName, joinRoom, resetCall, userId],
  );

  const acceptCall = useCallback(async () => {
    const invite = incomingCall;
    if (!invite || !userId) return;
    setCallError(null);

    await acquireMedia(invite.mode);
    const call: ActiveCall = { ...invite, acceptedAt: Date.now(), isCaller: false };
    activeCallRef.current = call;
    setActiveCall(call);
    setIncomingCall(null);

    try {
      await joinRoom(call);
    } catch (error) {
      await resetCall();
      throw error;
    }
  }, [acquireMedia, incomingCall, joinRoom, resetCall, userId]);

  const declineCall = useCallback(async () => {
    const invite = incomingCall;
    setIncomingCall(null);
    if (invite && userId) {
      try {
        await sendPersonalBroadcast(invite.callerId, "call_declined", {
          callId: invite.callId,
          userId,
        });
      } catch {
        // Decline is best effort.
      }
    }
  }, [incomingCall, userId]);

  const hangUp = useCallback(async () => {
    await resetCall();
  }, [resetCall]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextCameraOff = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setCameraOff(nextCameraOff);
  }, [cameraOff]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const personal = supabase
      .channel(`call-user:${userId}`)
      .on("broadcast", { event: "call_invite" }, ({ payload }) => {
        const invite = payload as CallInvite;
        if (!invite?.callId || invite.callerId === userId || activeCallRef.current) return;
        setIncomingCall(invite);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          new Notification(`${invite.mode === "video" ? "Video" : "Voice"} call from ${invite.callerName}`, {
            body: invite.conversationTitle,
            icon: "/icon-192.png",
          });
        }
      })
      .on("broadcast", { event: "call_declined" }, ({ payload }) => {
        const declined = payload as { callId?: string; userId?: string };
        if (declined.callId === activeCallRef.current?.callId && declined.userId) {
          closePeer(declined.userId);
        }
      })
      .on("broadcast", { event: "call_cancelled" }, ({ payload }) => {
        const cancelled = payload as { callId?: string };
        setIncomingCall((current) => current?.callId === cancelled.callId ? null : current);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(personal);
    };
  }, [closePeer, userId]);

  useEffect(() => {
    return () => {
      for (const pc of peersRef.current.values()) pc.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    incomingCall,
    activeCall,
    localStream,
    remoteStreams,
    muted,
    cameraOff,
    callError,
    setCallError,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}
