export const Terminal = ({ output, error }: { output: string; error: string }) => {
  const hasContent = output || error;

  return (
    <div className="font-mono text-sm bg-zinc-900 rounded-md overflow-hidden border border-zinc-800">
      <div className="flex items-center px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="ml-4 text-sm text-zinc-400">Output</span>
      </div>
      <div className="p-4 min-h-[200px] max-h-[400px] overflow-auto">
        {!hasContent && (
          <span className="text-zinc-500">Running your code will show the output here...</span>
        )}
        {error && (
          <span className="text-red-400">{error}</span>
        )}
        {output && (
          <pre className="text-green-400 whitespace-pre-wrap">{output}</pre>
        )}
      </div>
    </div>
  );
};
