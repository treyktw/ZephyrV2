'use client'

import { FileUpload } from "@/components/file-upload";


export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Video Analysis</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Upload a video file to analyze it frame by frame
          </p>
        </div>

        <FileUpload onChange={(files) => console.log(files)} />
      </div>
    </main>
  );
}
