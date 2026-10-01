import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FFMPEG = "/usr/bin/ffmpeg";

function runFfmpeg(input: string, output: string) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      output,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(
        new Error(`Unable to start FFmpeg: ${error.message}`),
      );
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg failed with exit code ${code}: ${stderr.slice(-4000)}`,
          ),
        );
      }
    });
  });
}

export async function POST(request: Request) {
  console.log("[YCHAT VOICE] Request received");

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[YCHAT VOICE] Authentication failed", userError);

    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();

    const audio = formData.get("audio");
    const conversationId = formData.get("conversationId");
    const durationMs = Number(
      formData.get("durationMs") || 0,
    );
    const replyToIdValue = formData.get("replyToId");
    const replyToId = typeof replyToIdValue === "string" && replyToIdValue.trim()
      ? replyToIdValue.trim()
      : null;

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required." },
        { status: 400 },
      );
    }

    if (
      typeof conversationId !== "string" ||
      !conversationId
    ) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 },
      );
    }

    console.log(
      `[YCHAT VOICE] Input: ${audio.name} | ${audio.type} | ${audio.size} bytes`,
    );

    const id = randomUUID();

    const inputPath = path.join(
      os.tmpdir(),
      `ychat-voice-${id}.webm`,
    );

    const outputPath = path.join(
      os.tmpdir(),
      `ychat-voice-${id}.m4a`,
    );

    try {
      const inputBuffer = Buffer.from(
        await audio.arrayBuffer(),
      );

      await fs.writeFile(inputPath, inputBuffer);

      console.log(
        `[YCHAT VOICE] Running FFmpeg: ${inputPath}`,
      );

      await runFfmpeg(inputPath, outputPath);

      const outputBuffer = await fs.readFile(outputPath);

      console.log(
        `[YCHAT VOICE] Conversion successful: ${outputBuffer.length} bytes`,
      );

      const fileName = `voice-${Date.now()}.m4a`;

      const storagePath =
        `${user.id}/${conversationId}/${randomUUID()}-${fileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from("chat-attachments")
          .upload(
            storagePath,
            outputBuffer,
            {
              upsert: false,
              contentType: "audio/mp4",
            },
          );

      if (uploadError) {
        throw uploadError;
      }

      console.log(
        `[YCHAT VOICE] Uploaded: ${storagePath}`,
      );

      const body =
        `Voice message • ${Math.max(
          1,
          Math.round(durationMs / 1000),
        )}s`;

      let {
        data: message,
        error: messageError,
      } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body,
          message_type: "voice",
          reply_to_id: replyToId,
        })
        .select("*")
        .single();

      if (messageError) {
        const {
          data: retryMessage,
          error: retryError,
        } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            body,
            message_type: "file",
            reply_to_id: replyToId,
          })
          .select("*")
          .single();

        message = retryMessage;
        messageError = retryError;
      }

      if (messageError) {
        await supabase.storage
          .from("chat-attachments")
          .remove([storagePath]);

        throw messageError;
      }

      const {
        data: attachment,
        error: attachmentError,
      } = await supabase
        .from("attachments")
        .insert({
          message_id: message.id,
          uploader_id: user.id,
          file_name: fileName,
          file_path: storagePath,
          mime_type: "audio/mp4",
          file_size: outputBuffer.length,
        })
        .select("*")
        .single();

      if (attachmentError) {
        await supabase
          .from("messages")
          .delete()
          .eq("id", message.id)
          .eq("sender_id", user.id);

        await supabase.storage
          .from("chat-attachments")
          .remove([storagePath]);

        throw attachmentError;
      }

      console.log(
        `[YCHAT VOICE] Complete: ${fileName}`,
      );

      return NextResponse.json({
        message,
        attachment,
      });
    } finally {
      await fs
        .rm(inputPath, { force: true })
        .catch(() => {});

      await fs
        .rm(outputPath, { force: true })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[YCHAT VOICE] ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Voice conversion failed.",
      },
      { status: 500 },
    );
  }
}
