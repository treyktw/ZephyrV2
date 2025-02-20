// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const filename = file.name;

    // Setup directory structure
    const videosDir = path.join(process.cwd(), "videos"); // Frontend videos
    const processingDir = path.join(process.cwd(), "..", "data", "videos", id); // Processing directory

    // Create directories
    for (const dir of [videosDir, processingDir]) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save original file for frontend
    await writeFile(path.join(videosDir, filename), buffer);

    // Save processing copy with consistent name
    await writeFile(path.join(processingDir, "original.mp4"), buffer);

    // Create metadata.json
    const metadata = {
      id,
      filename,
      originalPath: path.join(videosDir, filename),
      processingPath: path.join(processingDir, "original.mp4"),
      uploadedAt: Date.now(),
    };

    await writeFile(
      path.join(processingDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    // Save to database
    await db.insert(videos).values({
      id,
      filename,
      status: "uploading",
    });

    // Save to Redis
    const videoData = JSON.stringify({
      id,
      filename,
      status: "uploading",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await redis.set(`video:${id}`, videoData);
    await redis.lPush("video_queue", id);

    // Forward to Rust gateway
    const rustFormData = new FormData();
    rustFormData.append("file", file);

    try {
      const rustResponse = await fetch('http://localhost:8000/api/videos', {
        method: 'POST',
        body: rustFormData,
      });

      if (!rustResponse.ok) {
        console.error('Rust gateway error:', await rustResponse.text());
      }
    } catch (error) {
      console.error('Failed to forward to Rust gateway:', error);
    }

    return NextResponse.json({
      id,
      filename,
      status: "uploading",
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
