export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

/**
 * The text read from an attached file, wrapped in its own `<attached_file>` block by
 * wrapAttachedFiles: kept apart from the student message so it cannot be read as an instruction.
 */
export interface AttachedFileForPrompt {
  fileId: string;
  fileName: string;
  text: string;
}
