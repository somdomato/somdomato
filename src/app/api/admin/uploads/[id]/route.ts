import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { approveUpload, cancelAutoApprove } from "@/lib/upload";
import { logAction } from "@/lib/logging";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uploadId = parseInt(id, 10);

  if (Number.isNaN(uploadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, genre, rotation, timeSlots } = body;

    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (action === "approve") {
      cancelAutoApprove(uploadId);
      const result = await approveUpload(uploadId, genre || "geral");
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }

      // Update rotation and timeSlots if provided
      if (rotation || timeSlots !== undefined) {
        const { songs } = await import("@/db/schema");
        const updateData: Record<string, unknown> = {};
        if (rotation) updateData.rotation = rotation;
        if (timeSlots !== undefined) updateData.timeSlots = timeSlots;
        await db
          .update(songs)
          .set(updateData)
          .where(eq(songs.id, result.songId));
      }

      return NextResponse.json({ success: true, message: "Upload approved" });
    }

    if (action === "reject") {
      cancelAutoApprove(uploadId);
      if (fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
      }

      await db
        .update(uploads)
        .set({
          status: "rejected",
          autoApproveAt: null,
          autoApproveGenre: null,
        })
        .where(eq(uploads.id, uploadId));

      await logAction({
        action: "upload:rejected",
        targetType: "upload",
        targetId: uploadId,
        details: { title: upload.title, artist: upload.artist },
      });

      return NextResponse.json({ success: true, message: "Upload rejected" });
    }

    // AI-approved: admin keeps the approval (actually add to library)
    if (action === "ai_keep") {
      const result = await approveUpload(
        uploadId,
        genre || upload.autoApproveGenre || "geral",
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }

      if (rotation || timeSlots !== undefined) {
        const { songs } = await import("@/db/schema");
        const updateData: Record<string, unknown> = {};
        if (rotation) updateData.rotation = rotation;
        if (timeSlots !== undefined) updateData.timeSlots = timeSlots;
        await db
          .update(songs)
          .set(updateData)
          .where(eq(songs.id, result.songId));
      }

      await logAction({
        action: "upload:ai_kept",
        targetType: "upload",
        targetId: uploadId,
        details: { title: upload.title, artist: upload.artist, genre },
      });

      return NextResponse.json({ success: true, message: "AI approval kept" });
    }

    // AI-approved: admin rejects
    if (action === "ai_reject") {
      if (fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
      }

      await db
        .update(uploads)
        .set({ status: "rejected" })
        .where(eq(uploads.id, uploadId));

      await logAction({
        action: "upload:ai_rejected",
        targetType: "upload",
        targetId: uploadId,
        details: { title: upload.title, artist: upload.artist },
      });

      return NextResponse.json({
        success: true,
        message: "AI approval rejected",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating upload:", error);
    return NextResponse.json(
      { error: "Failed to update upload" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uploadId = parseInt(id, 10);

  if (Number.isNaN(uploadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (fs.existsSync(upload.path)) {
      fs.unlinkSync(upload.path);
    }

    const wasAiApproved = upload.status === "ai_approved";

    await db.delete(uploads).where(eq(uploads.id, uploadId));

    await logAction({
      action: wasAiApproved ? "upload:ai_deleted" : "upload:deleted",
      targetType: "upload",
      targetId: uploadId,
      details: { title: upload.title, artist: upload.artist },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 },
    );
  }
}
