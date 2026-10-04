    return () => {
      disposed = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = subscribeToCallLogs(userId, (payload) => {
      const event = payload as { eventType?: string; new?: { id?: string; title?: string; mode?: CallMode; direction?: string; created_at?: string; conversation_id?: string | null; duration_seconds?: number | null } };
      const row = event.new;
      if (!row?.id || event.eventType !== "INSERT") return;
      const callId = row.id;
      const callMode: CallMode = row.mode === "video" ? "video" : "audio";
      const callDirection: CallLogEntry["direction"] =
        row.direction === "missed" ? "missed" : row.direction === "incoming" ? "incoming" : "outgoing";
      setCallLogs((current) => {
        if (current.some((item) => item.id === callId)) return current;
        const newEntry: CallLogEntry = {
          id: callId,
          title: row.title || "Ychat call",
          mode: callMode,
          direction: callDirection,
          createdAt: row.created_at || new Date().toISOString(),
          conversationId: row.conversation_id ?? undefined,
          durationSeconds: row.duration_seconds ?? null,
        };
        return [newEntry, ...current].slice(0, 80);
      });
    });
    return () => {
      void channel.unsubscribe();