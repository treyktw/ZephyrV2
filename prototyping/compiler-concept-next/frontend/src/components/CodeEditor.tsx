"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal } from "./Terminal";

const SUPPORTED_LANGUAGES = [
  {
    id: "typescript",
    name: "TypeScript",
    template: 'console.log("Hello from TypeScript!");',
  },
  {
    id: "javascript",
    name: "JavaScript",
    template: 'console.log("Hello from JavaScript!");',
  },
  { id: "python", name: "Python", template: 'print("Hello from Python!")' },
  { id: "rust", name: "Rust", template: 'println!("Hello from Rust!");' },
  {
    id: "cpp",
    name: "C++",
    template:
      '#include <iostream>\n\nstd::cout << "Hello from C++!" << std::endl;',
  },
];

export default function CodeEditor() {
  const [language, setLanguage] = useState<string>("typescript");
  const [code, setCode] = useState(SUPPORTED_LANGUAGES[0].template);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const template =
      SUPPORTED_LANGUAGES.find((lang) => lang.id === newLang)?.template || "";
    setCode(template);
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setError("");
    setOutput("");

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
      } else {
        setOutput(result.output);
      }
    } catch (err) {
      setError("Failed to compile code. Please try again.");
      console.error("Compilation error:", err);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-800 h-[800px]">
      <div className="flex items-center justify-between">
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleCompile} disabled={isCompiling} className="w-32">
          {isCompiling ? "Running..." : "Run Code"}
        </Button>
      </div>

      <div className="flex-1 border rounded-md overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => setCode(value || "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Terminal output={output} error={error} />
    </div>
  );
}
