import React, { createContext, useContext, useState, useCallback } from "react";
import type { ParsedData } from "@/lib/csvParser";
import {
  parseParquetFile,
  buildParsedDataFromGold,
  validateGoldColumns,
  type ParquetInfo,
} from "@/lib/parquetParser";

export const PARQUET_FILE = "df_gold.parquet" as const;

interface DataContextValue {
  /** Parsed analytics data — null until parquet uploaded */
  data: ParsedData | null;
  /** The uploaded parquet file, if any */
  uploadedFile: File | null;
  /** Whether the required file is present */
  fileReady: boolean;
  /** Is currently parsing */
  isParsing: boolean;
  /** Parsing error message */
  parseError: string | null;
  /** Info about the loaded parquet file */
  parquetInfo: ParquetInfo | null;
  /** Set the parquet file from user upload */
  setFile: (file: File) => void;
  /** Remove the uploaded file */
  removeFile: () => void;
  /** Trigger parsing of the uploaded file */
  processFile: () => Promise<void>;
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [data, setData] = useState<ParsedData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parquetInfo, setParquetInfo] = useState<ParquetInfo | null>(null);

  const fileReady = uploadedFile !== null;

  const setFile = useCallback((file: File) => {
    setUploadedFile(file);
    setParseError(null);
    setData(null);
    setParquetInfo(null);
  }, []);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setData(null);
    setParquetInfo(null);
    setParseError(null);
  }, []);

  const processFile = useCallback(async () => {
    if (!uploadedFile) return;
    setIsParsing(true);
    setParseError(null);
    setParquetInfo(null);

    try {
      const { info, rows } = await parseParquetFile(uploadedFile);

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
        err instanceof Error ? err.message : "Failed to parse file"
      );
    } finally {
      setIsParsing(false);
    }
  }, [uploadedFile]);

  const reset = useCallback(() => {
    setUploadedFile(null);
    setData(null);
    setParseError(null);
    setParquetInfo(null);
  }, []);

  return (
    <DataContext.Provider
      value={{
        data,
        uploadedFile,
        fileReady,
        isParsing,
        parseError,
        parquetInfo,
        setFile,
        removeFile,
        processFile,
        reset,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
