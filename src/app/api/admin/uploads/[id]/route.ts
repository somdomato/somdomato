import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { approveUpload, cancelAutoApprove } from "@/lib/upload";

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
    const { action, genre } = body;

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
      return NextResponse.json({ success: true, message: "Upload approved" });
    }

    if (action === "reject") {
      cancelAutoApprove(uploadId);
      // Delete file
      if (fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
      }

      // Update upload status
      await db
        .update(uploads)
        .set({
          status: "rejected",
          autoApproveAt: null,
          autoApproveGenre: null,
        })
        .where(eq(uploads.id, uploadId));

      return NextResponse.json({ success: true, message: "Upload rejected" });
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

    // Delete file if exists
    if (fs.existsSync(upload.path)) {
      fs.unlinkSync(upload.path);
    }

    // Delete from database
    await db.delete(uploads).where(eq(uploads.id, uploadId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 },
    );
  }
}
