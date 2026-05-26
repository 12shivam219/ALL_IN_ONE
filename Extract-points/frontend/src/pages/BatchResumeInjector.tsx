import React, { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import { apiClient } from '../api/client';
import { 
  FolderHeart, Upload, Download, Trash2, ArrowRight, AlertCircle, RefreshCw
} from 'lucide-react';

export const BatchResumeInjector: React.FC = () => {
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [textFiles, setTextFiles] = useState<File[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // txtFilename -> docxFilename
  
  const [injecting, setInjecting] = useState(false);
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string | null>(null);
  const [errorsSummary, setErrorsSummary] = useState<Record<string, string> | null>(null);
  
  const { addToast } = useToastStore();

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files).filter(f => f.name.endsWith('.docx'));
      if (filesArr.length !== e.target.files.length) {
        addToast('Some files were ignored. Only Word Documents (.docx) are supported.', 'warning');
      }
      setResumeFiles(prev => {
        // Prevent duplicate filenames
        const unique = [...prev];
        filesArr.forEach(file => {
          if (!unique.some(f => f.name === file.name)) {
            unique.push(file);
          }
        });
        return unique;
      });
      setZipDownloadUrl(null);
      setErrorsSummary(null);
    }
  };

  const handleTextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files).filter(f => f.name.endsWith('.txt'));
      if (filesArr.length !== e.target.files.length) {
        addToast('Some files were ignored. Only Text files (.txt) are supported.', 'warning');
      }
      setTextFiles(prev => {
        // Prevent duplicate filenames
        const unique = [...prev];
        filesArr.forEach(file => {
          if (!unique.some(f => f.name === file.name)) {
            unique.push(file);
          }
        });
        return unique;
      });
      setZipDownloadUrl(null);
      setErrorsSummary(null);
    }
  };

  // Perform auto-mapping when files change
  useEffect(() => {
    const newMapping: Record<string, string> = { ...mapping };
    
    textFiles.forEach(txtFile => {
      // If already mapped and still valid, keep it
      if (newMapping[txtFile.name] && resumeFiles.some(r => r.name === newMapping[txtFile.name])) {
        return;
      }

      // Try automatic mapping based on name overlap
      const txtBase = txtFile.name.toLowerCase().replace('_points', '').replace('.txt', '');
      let bestMatch = '';
      let bestOverlap = 0;

      resumeFiles.forEach(docxFile => {
        const docxBase = docxFile.name.toLowerCase().replace('_resume', '').replace('.docx', '');
        
        // Check if one base contains the other or vice-versa
        if (docxBase.includes(txtBase) || txtBase.includes(docxBase)) {
          const overlapLength = Math.min(docxBase.length, txtBase.length);
          if (overlapLength > bestOverlap) {
            bestOverlap = overlapLength;
            bestMatch = docxFile.name;
          }
        }
      });

      // Default fallback if overlapping is not found: match by index
      if (!bestMatch && resumeFiles.length > 0) {
        // Find if there is a match by index
        const idx = textFiles.indexOf(txtFile);
        if (idx < resumeFiles.length) {
          bestMatch = resumeFiles[idx].name;
        } else {
          bestMatch = resumeFiles[0].name;
        }
      }

      if (bestMatch) {
        newMapping[txtFile.name] = bestMatch;
      }
    });

    // Clean up mapping keys that are no longer in textFiles
    Object.keys(newMapping).forEach(k => {
      if (!textFiles.some(t => t.name === k)) {
        delete newMapping[k];
      }
    });

    setMapping(newMapping);
  }, [resumeFiles, textFiles]);

  const handlePairChange = (txtFilename: string, docxFilename: string) => {
    setMapping(prev => ({
      ...prev,
      [txtFilename]: docxFilename
    }));
  };

  const removeResume = (name: string) => {
    setResumeFiles(prev => prev.filter(f => f.name !== name));
  };

  const removeText = (name: string) => {
    setTextFiles(prev => prev.filter(f => f.name !== name));
  };

  const handleBatchInject = async () => {
    if (resumeFiles.length === 0) {
      addToast('Please upload at least one resume template (.docx)', 'warning');
      return;
    }
    if (textFiles.length === 0) {
      addToast('Please upload at least one points file (.txt)', 'warning');
      return;
    }

    setInjecting(true);
    setZipDownloadUrl(null);
    setErrorsSummary(null);

    const formData = new FormData();
    resumeFiles.forEach(file => {
      formData.append('files', file);
    });
    textFiles.forEach(file => {
      formData.append('texts', file);
    });
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const response = await apiClient.post('/resume/batch-inject', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });

      // Retrieve error summary header
      const errorsHeader = response.headers['x-errors-summary'];
      if (errorsHeader) {
        try {
          setErrorsSummary(JSON.parse(errorsHeader));
        } catch (e) {
          console.error(e);
        }
      }

      const blob = new Blob([response.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      setZipDownloadUrl(downloadUrl);
      addToast('Batch points injected successfully! Zipped bundle is ready for download.', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to execute batch injection', 'error');
    } finally {
      setInjecting(false);
    }
  };

  const downloadZip = () => {
    if (!zipDownloadUrl) return;
    const link = document.createElement('a');
    link.href = zipDownloadUrl;
    link.download = `batch_injected_resumes.zip`;
    link.click();
  };

  const clearAll = () => {
    setResumeFiles([]);
    setTextFiles([]);
    setMapping({});
    setZipDownloadUrl(null);
    setErrorsSummary(null);
  };

  return (
    <div className="space-y-6">
      {/* Description header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Batch Resume Injector</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inject multiple extracted cycle points (.txt) into multiple resume templates (.docx) concurrently.
          </p>
        </div>
        {(resumeFiles.length > 0 || textFiles.length > 0) && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:hover:bg-rose-950/20 dark:text-rose-455 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Clear All Files
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Upload Panels */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upload DOCX templates */}
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Upload Templates (.docx)</h3>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-lg p-6 cursor-pointer transition-colors text-center">
                <input 
                  type="file" 
                  accept=".docx"
                  multiple
                  onChange={handleResumeUpload} 
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Select Word Files</span>
                <span className="text-[10px] text-slate-400 mt-1">Select one or more templates containing bookmarks</span>
              </label>

              {resumeFiles.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resumeFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850">
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px] font-mono">{file.name}</span>
                      <button 
                        onClick={() => removeResume(file.name)}
                        className="p-1 hover:text-rose-500 text-slate-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload TXT Files */}
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Upload Extracted Points (.txt)</h3>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-lg p-6 cursor-pointer transition-colors text-center">
                <input 
                  type="file" 
                  accept=".txt"
                  multiple
                  onChange={handleTextUpload} 
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Select Text Files</span>
                <span className="text-[10px] text-slate-400 mt-1">Select one or more output files with Cycle markers</span>
              </label>

              {textFiles.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {textFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850">
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[180px] font-mono">{file.name}</span>
                      <button 
                        onClick={() => removeText(file.name)}
                        className="p-1 hover:text-rose-500 text-slate-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mapping table */}
          {textFiles.length > 0 && resumeFiles.length > 0 && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Pairing Coordinator</span>
              </h3>

              <div className="border border-slate-100 dark:border-slate-850 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-850 text-slate-450 uppercase tracking-wider font-bold">
                      <th className="p-3">Source text file</th>
                      <th className="p-3">Matched resume template</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {textFiles.map((txt) => (
                      <tr key={txt.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                        <td className="p-3 font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{txt.name}</td>
                        <td className="p-3">
                          <select
                            value={mapping[txt.name] || ''}
                            onChange={(e) => handlePairChange(txt.name, e.target.value)}
                            className="w-full max-w-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none text-slate-700 dark:text-slate-300"
                          >
                            <option value="">-- No Match (Skip) --</option>
                            {resumeFiles.map(rf => (
                              <option key={rf.name} value={rf.name}>{rf.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Operations Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <FolderHeart className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250">Batch Processing</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Align multiple resume templates and bullet points files. After injection completes, a ZIP archive containing all parsed DOCX documents will be generated.
              </p>
            </div>

            <button
              onClick={handleBatchInject}
              disabled={resumeFiles.length === 0 || textFiles.length === 0 || injecting}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10 shadow-md shadow-blue-500/10"
            >
              {injecting ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Run Batch Injections</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {zipDownloadUrl && (
              <button
                onClick={downloadZip}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10"
              >
                <Download className="w-4 h-4" />
                <span>Download ZIP Bundle</span>
              </button>
            )}
          </div>

          {/* Errors summaries */}
          {errorsSummary && Object.keys(errorsSummary).length > 0 && (
            <div className="p-5 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-250 dark:border-rose-900/30 space-y-3">
              <h4 className="text-xs font-bold text-rose-800 dark:text-rose-455 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Errors / Warnings ({Object.keys(errorsSummary).length})</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto text-[11px]">
                {Object.entries(errorsSummary).map(([txtFile, errorMsg]) => (
                  <div key={txtFile} className="border-b border-rose-100 dark:border-rose-950/20 py-1.5 space-y-0.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{txtFile}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-mono block leading-relaxed">{errorMsg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
