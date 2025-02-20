'use client'

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onChange: (files: File[]) => void;
}

export function FileUpload({ onChange }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Call onChange prop with accepted files
      onChange(acceptedFiles);

      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append("file", file);

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return prev;
          }
          return prev + 5;
        });
      }, 100);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setUploadProgress(100);
      console.log("Upload successful:", data);

    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv']
    },
    maxFiles: 1,
  });

  return (
    <div className="p-4 h-full">
      <div
        {...getRootProps()}
        className={cn(
          "h-full flex flex-col items-center justify-center gap-4",
          "rounded-lg border border-dashed",
          "border-gray-300 dark:border-gray-700",
          "hover:border-gray-400 dark:hover:border-gray-600",
          "transition-colors cursor-pointer"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <UploadCloud className="h-10 w-10 text-gray-400 dark:text-gray-600" />
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Uploading...
              </p>
              <Progress value={uploadProgress} className="w-40 bg-white" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDragActive
                  ? "Drop the video here"
                  : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600">
                MP4, AVI, MOV, or MKV
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
