import React, { createContext, useContext, useState, useCallback } from "react";
import { parseAllFiles, type ParsedData } from "@/lib/csvParser";
import {
  parseParquetFile,
  buildParsedDataFromGold,
  validateGoldColumns,
  type ParquetInfo,
} from "@/lib/parquetParser";

export const REQUIRED_CSV_FILES = [
  "building_metadata.csv",
  "meter-readings-jan-2025.csv",
  "meter-readings-feb-2025.csv",
  "meter-readings-march-2025.csv",
  "meter-readings-april-2025.csv",
  "weather_data_hourly_2025.csv",
] as const;

export const PARQUET_FILE = "df_gold.parquet" as const;

export const REQUIRED_FILES = [...REQUIRED_CSV_FILES, PARQUET_FILE] as const;

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
  /** Info about the loaded parquet file */
  parquetInfo: ParquetInfo | null;
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
  const [parquetInfo, setParquetInfo] = useState<ParquetInfo | null>(null);

  const allFilesReady = REQUIRED_FILES.every((f) => uploadedFiles.has(f));

  const addFiles = useCallback((files: FileList | File[]) => {
    setUploadedFiles((prev) => {
      const next = new Map(prev);
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase().trim();
        if ((REQUIRED_FILES as readonly string[]).includes(name)) {
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
    setParquetInfo(null);
  }, []);

  const processFiles = useCallback(async () => {
    if (!allFilesReady) return;
    setIsParsing(true);
    setParseError(null);
    setParquetInfo(null);

    try {
      // Always use df_gold.parquet as the single source of truth
      const parquetFile = uploadedFiles.get(PARQUET_FILE);
      if (!parquetFile) {
        throw new Error("df_gold.parquet is required but missing.");
      }

      const { info, rows } = await parseParquetFile(parquetFile);

      // Validate columns
      const missingCols = validateGoldColumns(info.columns);
      if (missingCols.length > 0) {
        throw new Error(
          `df_gold.parquet is missing required columns: ${missingCols.join(", ")}. ` +
            `Found columns: ${info.columns.join(", ")}`
        );
      }

      setParquetInfo(info);
      const parsed = buildParsedDataFromGold(rows);
      setData(parsed);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse files"
      );
    } finally {
      setIsParsing(false);
    }
  }, [allFilesReady, uploadedFiles]);

  const reset = useCallback(() => {
    setUploadedFiles(new Map());
    setData(null);
    setParseError(null);
    setParquetInfo(null);
  }, []);

  return (
    <DataContext.Provider
      value={{
        data,
        uploadedFiles,
        allFilesReady,
        isParsing,
        parseError,
        parquetInfo,
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
