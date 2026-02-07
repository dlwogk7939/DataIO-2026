import React, { createContext, useContext, useState, useCallback } from "react";
import type { ParsedData } from "@/lib/csvParser";
import {
  parseAllCsvFiles,
  REQUIRED_FILES,
  type RequiredFileName,
  type AllCsvInfo,
} from "@/lib/csvDataParser";

export { REQUIRED_FILES };
export type { RequiredFileName };

interface DataContextValue {
  /** Parsed analytics data — null until all CSVs uploaded & processed */
  data: ParsedData | null;
  /** Map of uploaded files by required filename */
  uploadedFiles: Map<RequiredFileName, File>;
  /** Whether all required files are present */
  allFilesReady: boolean;
  /** Is currently parsing */
  isParsing: boolean;
  /** Parsing error message */
  parseError: string | null;
  /** Info about each parsed CSV */
  csvInfo: AllCsvInfo | null;
  /** Add a file (matched by name) */
  addFile: (file: File) => void;
  /** Remove a specific file */
  removeFile: (name: RequiredFileName) => void;
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
  const [uploadedFiles, setUploadedFiles] = useState<Map<RequiredFileName, File>>(new Map());
  const [data, setData] = useState<ParsedData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<AllCsvInfo | null>(null);

  const allFilesReady = REQUIRED_FILES.every((f) => uploadedFiles.has(f));

  const addFile = useCallback((file: File) => {
    const matched = REQUIRED_FILES.find(
      (req) => file.name.toLowerCase().trim() === req.toLowerCase()
    );
    if (matched) {
      setUploadedFiles((prev) => {
        const next = new Map(prev);
        next.set(matched, file);
        return next;
      });
      setParseError(null);
    }
  }, []);

  const removeFile = useCallback((name: RequiredFileName) => {
    setUploadedFiles((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
    setData(null);
    setCsvInfo(null);
    setParseError(null);
  }, []);

  const processFiles = useCallback(async () => {
    if (!REQUIRED_FILES.every((f) => uploadedFiles.has(f))) return;
    setIsParsing(true);
    setParseError(null);
    setCsvInfo(null);

    try {
      const filesObj = Object.fromEntries(
        REQUIRED_FILES.map((f) => [f, uploadedFiles.get(f)!])
      ) as Record<RequiredFileName, File>;

      const result = await parseAllCsvFiles(filesObj);
      setCsvInfo(result.info);
      setData(result.data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse CSV files");
    } finally {
      setIsParsing(false);
    }
  }, [uploadedFiles]);

  const reset = useCallback(() => {
    setUploadedFiles(new Map());
    setData(null);
    setParseError(null);
    setCsvInfo(null);
  }, []);

  return (
    <DataContext.Provider
      value={{
        data,
        uploadedFiles,
        allFilesReady,
        isParsing,
        parseError,
        csvInfo,
        addFile,
        removeFile,
        processFiles,
        reset,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
