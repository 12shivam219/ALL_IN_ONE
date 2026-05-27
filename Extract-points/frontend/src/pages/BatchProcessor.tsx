import React, { useState, useRef } from 'react';
import { useToastStore } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';
import { apiClient } from '../api/client';
import { 
  FileText, Upload, Trash2, Play, 
  Download, ChevronDown, ChevronUp, FileArchive 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BatchResult {
  filename: string;
  text: string;
  is_error: boolean;
}

export const BatchProcessor: React.FC = () => {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  
  const { pointsPerCycle, deduplicationEnabled, setPointsPerCycle, setDeduplicationEnabled } = useSettingsStore();
  const { addToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload actions
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => {
    setDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      const txtFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.txt'));
      if (txtFiles.length === 0) {
        addToast('Only text files (.txt) are supported in batch upload mode', 'warning');
        return;
      }
      setUploadedFiles(prev => [...prev, ...txtFiles]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const txtFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.txt'));
      setUploadedFiles(prev => [...prev, ...txtFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessBatch = async () => {
    setLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      formData.append('points_per_cycle', String(pointsPerCycle));
      formData.append('deduplication_enabled', String(deduplicationEnabled));

      if (mode === 'paste') {
        if (!pasteText.trim()) {
          addToast('Paste field cannot be empty', 'warning');
          setLoading(false);
          return;
        }
        
        // Split text by separator '---' and create virtual files to submit
        const segments = pasteText.split('\n---\n');
        segments.forEach((segment, i) => {
          if (segment.trim()) {
            const blob = new Blob([segment], { type: 'text/plain' });
            formData.append('files', blob, `text_${i + 1}.txt`);
          }
        });
      } else {
        if (uploadedFiles.length === 0) {
          addToast('Please upload at least one .txt file first', 'warning');
          setLoading(false);
          return;
        }
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
      }

      const res = await apiClient.post('/processor/batch-process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResults(res.data.results);
      addToast(`Successfully processed ${res.data.results.length} documents!`, 'success');
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      addToast(apiError.response?.data?.detail || 'Batch processing failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadAllAsZip = async () => {
    setDownloadingZip(true);
    try {
      const formData = new FormData();
      formData.append('points_per_cycle', String(pointsPerCycle));
      formData.append('deduplication_enabled', String(deduplicationEnabled));

      if (mode === 'paste') {
        const segments = pasteText.split('\n---\n');
        segments.forEach((segment, i) => {
          if (segment.trim()) {
            const blob = new Blob([segment], { type: 'text/plain' });
            formData.append('files', blob, `text_${i + 1}.txt`);
          }
        });
      } else {
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
      }

      const response = await apiClient.post('/processor/batch-export-zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'processed_texts_batch.zip';
      link.click();
      window.URL.revokeObjectURL(link.href);
      addToast('Batch zip downloaded successfully!', 'success');
    } catch (error) {
      addToast('Failed to generate ZIP export', 'error');
      console.error(error);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Download individual file result
  const handleExportIndividual = async (text: string, filename: string, format: 'docx' | 'pdf') => {
    try {
      const outName = `${filename}.${format}`;
      const endpoint = format === 'docx' ? '/processor/export-docx' : '/processor/export-pdf';
      const formData = new FormData();
      formData.append('text', text);
      formData.append('filename', outName);

      const response = await apiClient.post(endpoint, formData, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { 
        type: format === 'docx' 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          : 'application/pdf' 
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = outName;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch {
      addToast(`Failed to export individual ${format.toUpperCase()}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => { setMode('paste'); setResults([]); }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            mode === 'paste' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📝 Paste & Process
        </button>
        <button
          onClick={() => { setMode('upload'); setResults([]); }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            mode === 'upload' 
              ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📁 Upload Files
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Input area */}
        <div className="lg:col-span-2 space-y-4">
          {mode === 'paste' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">Paste multiple documents separated by three dashes (<code>---</code>) on its own line:</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Example Text 1...\n• Point A\n\n---\n\nExample Text 2...\n• Point B`}
                className="w-full h-80 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400/50 text-sm font-sans"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragging 
                    ? 'border-blue-500 bg-blue-500/5' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileSelect}
                  accept=".txt"
                  multiple
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-slate-400" />
                <div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-355 block">Drag & drop multiple TXT files here</span>
                  <span className="text-xs text-slate-400">or click to browse local files</span>
                </div>
              </div>

              {/* Uploaded list */}
              {uploadedFiles.length > 0 && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Uploaded Files ({uploadedFiles.length})</span>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350 truncate">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Config options */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 block">Extract per heading:</label>
              <input
                type="number"
                min={1}
                max={10}
                value={pointsPerCycle || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPointsPerCycle(val > 10 ? 10 : val);
                }}
                onBlur={() => {
                  if (pointsPerCycle < 1) {
                    setPointsPerCycle(1);
                  }
                }}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="batch-dedup"
                checked={deduplicationEnabled}
                onChange={(e) => setDeduplicationEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="batch-dedup" className="text-xs font-semibold text-slate-600 dark:text-slate-350 cursor-pointer">
                Remove Duplicates
              </label>
            </div>

            <button
              onClick={handleProcessBatch}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg text-sm transition-all h-10 mt-4 sm:mt-0 shadow-md shadow-blue-500/10 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Process Batch</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results / Exports actions panel */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Export All Results</h3>
          
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <FileArchive className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250">Download Bulk ZIP</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Export all successfully processed files containing TXT, Word, and PDF versions.</p>
            </div>
            
            <button
              onClick={downloadAllAsZip}
              disabled={results.length === 0 || downloadingZip}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 dark:bg-slate-750 dark:hover:bg-slate-700 disabled:opacity-40 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer border dark:border-slate-700 h-10"
            >
              {downloadingZip ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download ZIP Archive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Individual Results Preview Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">📄 Individual File Results</h3>
          
          <div className="space-y-3">
            {results.map((result) => {
              const isExpanded = expandedFile === result.filename;
              return (
                <div 
                  key={result.filename}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-850">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{result.filename}.txt</span>
                      {result.is_error && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 text-[10px] font-bold">Error</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!result.is_error && (
                        <>
                          <button
                            onClick={() => handleExportIndividual(result.text, result.filename, 'docx')}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 rounded text-xs font-semibold cursor-pointer"
                          >
                            DOCX
                          </button>
                          <button
                            onClick={() => handleExportIndividual(result.text, result.filename, 'pdf')}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 rounded text-xs font-semibold cursor-pointer"
                          >
                            PDF
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => setExpandedFile(isExpanded ? null : result.filename)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4">
                          <textarea
                            readOnly
                            value={result.text}
                            className={`w-full h-72 p-3 rounded-lg border text-xs font-mono focus:outline-none ${
                              result.is_error 
                                ? 'bg-rose-50 dark:bg-rose-950/10 border-rose-250 text-rose-600' 
                                : 'bg-slate-50/50 dark:bg-slate-950/20'
                            }`}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
