import React, { useState } from 'react';
import { useProcessorStore } from '../store/processorStore';
import { useSettingsStore } from '../store/settingsStore';
import { useToastStore } from '../store/toastStore';
import { apiClient } from '../api/client';
import { 
  FileText, Play, Copy, Download, Trash2, 
  RotateCcw, RotateCw, CheckCircle, Info, HelpCircle
} from 'lucide-react';
export const SingleProcessor: React.FC = () => {
  const { 
    inputText, processedText, undoStack, redoStack, 
    setInputText, setProcessedText, undo, redo, clear 
  } = useProcessorStore();
  
  const { pointsPerCycle, deduplicationEnabled, setPointsPerCycle, setDeduplicationEnabled } = useSettingsStore();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  const loadSampleInput = () => {
    const sample = `Heading 1
• Point 1
• Point 2
• Point 3
• Point 4

Heading 2
• Item A
• Item B
• Item C
• Item D

Heading 3
• Task 1
• Task 2
• Task 3
• Task 4`;
    setInputText(sample);
    addToast('Sample text loaded', 'info');
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      addToast('Input text cannot be empty', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const res = await apiClient.post('/processor/process-text', {
        text: inputText,
        points_per_cycle: pointsPerCycle,
        deduplication_enabled: deduplicationEnabled
      });
      
      setProcessedText(res.data.processed_text);
      if (res.data.stats) {
        const { removed_count } = res.data.stats;
        if (removed_count > 0) {
          addToast(`Text processed successfully! Removed ${removed_count} duplicate point(s).`, 'success');
        } else {
          addToast('Text processed successfully!', 'success');
        }
      } else {
        addToast('Text processed successfully!', 'success');
      }
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      addToast(apiError.response?.data?.detail || 'Failed to process text', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!processedText) return;
    navigator.clipboard.writeText(processedText);
    addToast('Processed text copied to clipboard!', 'success');
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!processedText) return;
    
    try {
      const filename = format === 'docx' ? 'processed_text.docx' : 'processed_text.pdf';
      const endpoint = format === 'docx' ? '/processor/export-docx' : '/processor/export-pdf';
      
      const formData = new FormData();
      formData.append('text', processedText);
      formData.append('filename', filename);
      
      const response = await apiClient.post(endpoint, formData, {
        responseType: 'blob'
      });
      
      // Browser download logic
      const blob = new Blob([response.data], { type: format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(link.href);
      addToast(`Downloaded ${format.toUpperCase()} successfully`, 'success');
    } catch (error) {
      addToast('Failed to export document', 'error');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Help Section Accordion */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setHelpExpanded(!helpExpanded)}
          className="w-full flex items-center justify-between p-4 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500" />
            <span>Format Help & Troubleshooting Guide</span>
          </div>
          <span className="text-xs text-slate-400">{helpExpanded ? 'Hide' : 'Show'}</span>
        </button>
        {helpExpanded && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Expected Input Format</span>
              </h4>
              <pre className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg border font-mono">
{`Company Name (Heading 1)
• Point 1
• Point 2
• Point 3

Another Company (Heading 2)
• Achievement A
• Achievement B
• Achievement C`}
              </pre>
              <ul className="list-disc pl-4 space-y-1">
                <li>Use •, -, *, +, or numbers for bullet points.</li>
                <li>Ensure headings are short (1-6 words).</li>
                <li>Avoid starting headings with action verbs (e.g. Developed, Designed).</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-355 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-500" />
                <span>Troubleshooting Tips</span>
              </h4>
              <ul className="list-decimal pl-4 space-y-2">
                <li><strong>Error: "No valid headings found"</strong> - Check that you left empty lines between different company sections.</li>
                <li><strong>Deduplication Settings</strong> - Toggling "Remove Duplicates" filters exact case-insensitive matches inside each cycle.</li>
                <li><strong>Undo/Redo</strong> - You can navigate between historical processing iterations using the history buttons in the toolbar.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Editor & Parameters panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input box */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Step 1: Input Structured Text</h3>
            <button
              onClick={loadSampleInput}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Load Sample Input
            </button>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste structured text here (e.g. companies followed by bullet points)..."
            className="w-full h-96 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400/50 text-sm font-sans"
          />

          {/* Config parameters */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 block">Extract per cycle:</label>
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
                id="dedup"
                checked={deduplicationEnabled}
                onChange={(e) => setDeduplicationEnabled(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="dedup" className="text-xs font-semibold text-slate-600 dark:text-slate-350 cursor-pointer">
                Remove Duplicates
              </label>
            </div>

            <button
              onClick={handleProcess}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg text-sm transition-all shadow-md shadow-blue-500/10 cursor-pointer h-10 mt-4 sm:mt-0"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Process Text</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output box */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">📊 Processed Output</h3>
            
            {/* Undo/Redo tools */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={clear}
                disabled={!inputText && !processedText}
                className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all ml-2"
                title="Clear Everything"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={processedText || ''}
              placeholder="Processed text will be generated here by cycles..."
              className="w-full h-[456px] p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 text-sm font-mono focus:outline-none"
            />
            
            {/* Quick action buttons absolute inside textarea bottom */}
            {processedText && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
