// lib/ai/outputFormatter.ts
import { useArtifact } from "@/hooks/useArtifact";
import { nanoid } from "nanoid";

interface CodeBlock {
  id?: string;
  language: string;
  content: string;
  file?: string;
}

export class OutputFormatter {
  private artifactId: string | null = null;
  private artifactIds: Set<string> = new Set();
  private codeContent: string = "";
  private codeBlocks: CodeBlock[] = [];
  private chatContent: string = "";
  private isCodeBlock: boolean = false;
  private language: string = "";
  private currentFile: string | null = null;
  private markdownState = {
    inInlineCode: false,
    inBold: false,
    listLevel: 0,
    orderedListNumbers: [0], // Track numbers for nested ordered lists
    currentLine: "",
  };
  private currentToken: string = "";
  private currentIndex: number = 0;
  private isFirstToken: boolean = true;
  private buffer: string = '';
  private currentParagraph: string = '';
  private isInParagraph: boolean = false;
  private readonly SENTENCE_ENDINGS = /[.!?]/;

  constructor() {}

  processToken(token: string): { displayContent: string } {
    // Add character to our current paragraph buffer
    this.currentParagraph += token;

    // If we're not in a paragraph, start one
    if (!this.isInParagraph) {
      this.chatContent = this.chatContent + '<p>';
      this.isInParagraph = true;
    }

    // Check for sentence endings
    if (this.SENTENCE_ENDINGS.test(token)) {
      // Look ahead for space + capital letter pattern
      const nextChar = this.peekNextChar();
      if (nextChar && /\s/.test(nextChar)) {
        const afterNext = this.peekNextChar();
        if (afterNext && /[A-Z]/.test(afterNext)) {
          // Close current paragraph and start new one
          this.chatContent = this.chatContent + this.currentParagraph + '</p><p>';
          this.currentParagraph = '';
        }
      }
    }

    // Add the current paragraph content to chat content
    this.chatContent = this.currentParagraph;

    return { displayContent: this.chatContent };
  }

  private processTextContent(token: string): string {
    if (this.isFirstToken) {
      this.isFirstToken = false;
      return `<p>${token}`;
    }

    let processed = token;

    // Handle sentence endings and new paragraphs
    if (!this.markdownState.inInlineCode) {
      // Look for sentence endings followed by capital letters
      processed = processed.replace(/\.\s+([A-Z])/g, ".</p><p>$1");

      // Handle numbered points
      if (processed.match(/^\d+\.\s/)) {
        processed = `<p class="mb-2">${processed}`;
      }
    }

    // Ensure we don't have empty paragraphs
    processed = processed.replace(/<p>\s*<\/p>/g, "");

    return processed;
  }

  private handleCodeBlockStart(token: string): { displayContent: string } {
    const fileMatch = token.match(/\/\/(.*?)\n/);
    const langMatch = token.match(/```(\w+)/);

    this.language = langMatch?.[1] || "typescript";
    this.currentFile = fileMatch?.[1]?.trim() ?? null;
    this.isCodeBlock = true;

    if (!this.artifactId) {
      this.createNewArtifact();
    }

    return { displayContent: this.chatContent };
  }

  private handleCodeBlockEnd(): { displayContent: string } {
    this.codeBlocks.push({
      language: this.language,
      content: this.codeContent.trim(),
      file: this.currentFile ?? undefined,
    });

    const formattedContent = this.formatCodeBlocks();
    if (this.artifactId) {
      useArtifact
        .getState()
        .updateArtifactContent(this.artifactId, formattedContent);
    }

    this.resetCodeState();
    return { displayContent: this.chatContent };
  }

  private handleCodeContent(token: string): { displayContent: string } {
    this.codeContent += token;
    if (this.artifactId) {
      const formattedContent = this.formatCodeBlocks() + this.codeContent;
      useArtifact
        .getState()
        .updateArtifactContent(this.artifactId, formattedContent);
    }
    return { displayContent: this.chatContent };
  }

  private formatTextContent(token: string): string {
    let formattedToken = "";
    for (let i = 0; i < token.length; i++) {
      const { newToken, newIndex } = this.processFormatting(token, i);
      formattedToken += newToken;
      i = newIndex ?? i;
    }
    return formattedToken;
  }

  private processFormatting(
    token: string,
    index: number,
  ): { newToken: string; newIndex?: number } {
    this.currentIndex = index;
    const char = token[index];
    const nextChar = token[index + 1];

    if (char === "`") {
      return this.handleInlineCode();
    }

    if (char === "*" && nextChar === "*") {
      return {
        newToken: this.handleBoldText(),
        newIndex: index + 1,
      };
    }

    if (char === "\n" || this.markdownState.currentLine === "") {
      const listFormatting = this.handleLists(token.slice(index));
      if (listFormatting) {
        return listFormatting;
      }
    }

    this.markdownState.currentLine += char;
    if (char === "\n") {
      this.markdownState.currentLine = "";
    }

    return { newToken: char };
  }

  private validateState() {
    // Ensure we don't have conflicting states
    if (this.isCodeBlock && this.markdownState.inInlineCode) {
      console.warn(
        "Invalid state: Code block and inline code active simultaneously",
      );
      this.markdownState.inInlineCode = false;
    }

    // Ensure list levels don't go negative
    if (this.markdownState.listLevel < 0) {
      console.warn("Invalid list level detected");
      this.markdownState.listLevel = 0;
    }
  }

  private formatCodeBlocks(): string {
    if (this.codeBlocks.length === 0) return "";

    return this.codeBlocks
      .map((block) => {
        const fileHeader = block.file ? `// File: ${block.file}\n` : "";
        return `${fileHeader}${block.content}\n\n`;
      })
      .join("// ----------------------------------------\n\n");
  }

  private processInteractiveElements(text: string): string {
    return text.replace(
      /(?:here'?s|let me show you|I'll create) (?:an? )?(?:example|code|how)/gi,
      () => (this.artifactId ? `<ViewCode id="${this.artifactId}" />` : ""),
    );
  }

  public getArtifactIds(): string[] {
    return Array.from(this.artifactIds);
  }

  // Method to check if we have any artifacts
  public hasArtifacts(): boolean {
    return this.artifactIds.size > 0;
  }

  private createNewArtifact(): void {
    this.artifactId = nanoid();
    useArtifact.getState().addArtifact({
      id: this.artifactId,
      content: "",
      type: "code",
      title: "Code Example",
      metadata: {
        language: this.language,
        streaming: true,
        files: [],
      },
    });
    this.chatContent += `<ViewCode id="${this.artifactId}" />`;
  }

  private resetCodeState(): void {
    this.codeContent = "";
    this.isCodeBlock = false;
    this.currentFile = null;
  }

  private handleInlineCode(): { newToken: string } {
    // When closing an inline code block
    if (this.markdownState.inInlineCode) {
      this.markdownState.inInlineCode = false;
      // Add space after code if we're not at punctuation or end of sentence
      const nextChar = this.peekNextChar();
      const needsSpace = nextChar && !nextChar.match(/[.,!?:;\s]/);
      return {
        newToken: `</code>${needsSpace ? " " : ""}`,
      };
    }
    // When opening an inline code block
    else {
      this.markdownState.inInlineCode = true;
      // Add space before code if we're coming from a word
      const prevChar = this.peekPreviousChar();
      const needsSpace = prevChar && prevChar.match(/[a-zA-Z0-9]/);
      return {
        newToken: `${needsSpace ? " " : ""}<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">`,
      };
    }
  }

  private handleBoldText(): string {
    // When closing a bold section
    if (this.markdownState.inBold) {
      this.markdownState.inBold = false;
      // Add space after bold text if needed for readability
      const nextChar = this.peekNextChar();
      const needsSpace = nextChar && !nextChar.match(/[.,!?:;\s]/);
      return `</strong>${needsSpace ? " " : ""}`;
    }
    // When opening a bold section
    else {
      this.markdownState.inBold = true;
      // Add space before bold text if coming from word
      const prevChar = this.peekPreviousChar();
      const needsSpace = prevChar && prevChar.match(/[a-zA-Z0-9]/);
      return `${needsSpace ? " " : ""}<strong>`;
    }
  }

  private handleLists(
    content: string,
  ): { newToken: string; newIndex: number } | null {
    const orderedMatch = content.match(/^(\d+)\.\s/);
    const unorderedMatch = content.match(/^[-*]\s/);

    // First, let's handle the ordered lists (numbered lists)
    if (orderedMatch) {
      // We'll build our token in parts for better readability
      let newToken = "";

      // Add spacing before the list if we're not already in a list context
      if (
        !this.markdownState.currentLine.includes("<ol") &&
        !this.markdownState.currentLine.includes("<ul")
      ) {
        newToken += "\n"; // Create natural spacing before starting a new list
      }

      // Start the ordered list with enhanced spacing
      newToken += '<ol class="list-decimal list-inside space-y-1 my-4">';

      // Add the list item with proper indentation and margin
      newToken += `<li class="ml-${this.markdownState.listLevel * 4} mb-2">`;

      // Increment the list level for proper nesting
      this.markdownState.listLevel++;

      return {
        newToken,
        newIndex: orderedMatch[0].length - 1,
      };
    }

    // Now handle unordered lists (bullet points)
    if (unorderedMatch) {
      let newToken = "";

      // Same spacing logic for unordered lists
      if (
        !this.markdownState.currentLine.includes("<ol") &&
        !this.markdownState.currentLine.includes("<ul")
      ) {
        newToken += "\n";
      }

      // Start the unordered list with the same spacing considerations
      newToken += '<ul class="list-disc list-inside space-y-1 my-4">';
      newToken += `<li class="ml-${this.markdownState.listLevel * 4} mb-2">`;

      this.markdownState.listLevel++;

      return {
        newToken,
        newIndex: unorderedMatch[0].length - 1,
      };
    }

    return null;
  }

  private formattingState = {
    currentTag: null,
    pendingTags: [],
    formatStack: [],
  };

  private peekNextChar(): string | null {
    const nextIndex = this.currentIndex + 1;
    return nextIndex < this.currentToken.length
      ? this.currentToken[nextIndex]
      : null;
  }

  private peekPreviousChar(): string | null {
    const prevIndex = this.currentIndex - 1;
    return prevIndex >= 0 ? this.currentToken[prevIndex] : null;
  }

  finalize() {
    if (this.isInParagraph) {
      this.chatContent += '</p>';
      this.isInParagraph = false;
    }

    // Close any other open tags (from existing finalize logic)
    if (this.markdownState.inInlineCode) {
      this.chatContent += '</code>';
    }
    if (this.markdownState.inBold) {
      this.chatContent += '</strong>';
    }

    // Close any open markdown tags first
    let finalContent = this.chatContent;
    if (this.markdownState.inInlineCode) {
      finalContent += "</code>";
    }
    if (this.markdownState.inBold) {
      finalContent += "</strong>";
    }
    while (this.markdownState.listLevel > 0) {
      finalContent += "</li>";
      finalContent += this.markdownState.currentLine.includes("<ol")
        ? "</ol>"
        : "</ul>";
      this.markdownState.listLevel--;
    }
    this.chatContent = finalContent;

    // Then handle artifacts
    if (this.artifactId) {
      useArtifact.getState().updateArtifact(this.artifactId, {
        content: this.formatCodeBlocks(),
        metadata: {
          streaming: false,
          language: this.language,
          files: this.codeBlocks.map((b) => b.file).filter(Boolean),
        },
      });
    }
  }
}
