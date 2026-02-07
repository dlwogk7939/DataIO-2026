import React, { createContext, useContext, useState, useCallback } from "react";
import { parseAllFiles, type ParsedData } from "@/lib/csvParser";

export const REQUIRED_FILES = [
  "building_metadata.csv",
  "meter-readings-jan-2025.csv",
  "meter-readings-feb-2025.csv",
  "meter-readings-march-2025.csv",
  "meter-readings-april-2025.csv",
  "weather_data_hourly_2025.csv",
] as const;

export type RequiredFileName = (typeof REQUIRED_FILES)[number];

interface DataContextValue {
  /** Parsed analytics data — null until all files uploaded */
  data: ParsedData | null;
  /** Map of uploaded file names */
  uploadedFiles: Map<string, File>;
  /** Whether all required files are present */
  allFilesReady: boolean;
  /** Is currently parsing */
  isParsing: boolean;
  /** Parsing error message */
  parseError: string | null;
  /** Add files from user upload */
  addFiles: (files: FileList | File[]) => void;
  /** Remove a single file */
  removeFile: (name: string) => void;
  /** Trigger parsing of all uploaded files */
  processFiles: () => Promise<void>;
  /** Reset to upload state */
  reset: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataContext must be used within DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, File>>(new Map());
  const [data, setData] = useState<ParsedData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const allFilesReady = REQUIRED_FILES.every((f) => uploadedFiles.has(f));

  const addFiles = useCallback((files: FileList | File[]) => {
    setUploadedFiles((prev) => {
      const next = new Map(prev);
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase().trim();
        if (REQUIRED_FILES.includes(name as RequiredFileName)) {
          next.set(name, file);
        }
      }
      return next;
    });
    setParseError(null);
  }, []);

  const removeFile = useCallback((name: string) => {
    setUploadedFiles((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
    setData(null);
  }, []);

  const processFiles = useCallback(async () => {
    if (!allFilesReady) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const fileMap: Record<string, File> = {};
      for (const [name, file] of uploadedFiles) {
        fileMap[name] = file;
      }
      const parsed = await parseAllFiles(fileMap);
      setData(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse files");
    } finally {
      setIsParsing(false);
    }
  }, [allFilesReady, uploadedFiles]);

  const reset = useCallback(() => {
    setUploadedFiles(new Map());
    setData(null);
    setParseError(null);
  }, []);

  return (
    <DataContext.Provider
      value={{
        data,
        uploadedFiles,
        allFilesReady,
        isParsing,
        parseError,
        addFiles,
        removeFile,
        processFiles,
        reset,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
