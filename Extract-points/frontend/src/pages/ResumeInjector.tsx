import React, { useState, useEffect, useCallback } from 'react';
import { useToastStore } from '../store/toastStore';
import { apiClient } from '../api/client';
import { 
  GitFork, Upload, Save, Download, AlertTriangle, FileText, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Profile {
  name: string;
  resume_name: string;
  bookmarks_count: number;
  mapping?: Record<string, string>;
}

export const ResumeInjector: React.FC = () => {
  // States
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [detectedBookmarks, setDetectedBookmarks] = useState<string[]>([]);
  
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const [pointsText, setPointsText] = useState('');
  const [pointsFile, setPointsFile] = useState<File | null>(null);
  
  const [detectedCycles, setDetectedCycles] = useState<number>(0);
  const [customMapping, setCustomMapping] = useState<Record<number, string>>({});
  
  const [unusedHandling, setUnusedHandling] = useState<'keep' | 'repeat' | 'clear'>('keep');
  const [profileName, setProfileName] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  
  const [injecting, setInjecting] = useState(false);
  const [lastInjectedFileUrl, setLastInjectedFileUrl] = useState<string | null>(null);
  const [injectionsSummary, setInjectionsSummary] = useState<Record<string, number> | null>(null);
  
  const { addToast } = useToastStore();

  const handleReset = () => {
    setResumeFile(null);
    setDetectedBookmarks([]);
    setPointsText('');
    setPointsFile(null);
    setDetectedCycles(0);
    setCustomMapping({});
    setUnusedHandling('keep');
    setProfileName('');
    setSelectedProfile('');
    setLastInjectedFileUrl(null);
    setInjectionsSummary(null);
    
    // Reset file input elements if they exist
    const docxInput = document.querySelector('input[accept=".docx"]') as HTMLInputElement;
    if (docxInput) docxInput.value = '';
    const txtInput = document.querySelector('input[accept=".txt"]') as HTMLInputElement;
    if (txtInput) txtInput.value = '';
    
    addToast('All inputs cleared. Ready for next injection!', 'info');
  };

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await apiClient.get('/resume/profiles');
      setProfiles(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfiles();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfiles]);

  // Detect bookmarks
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.docx')) {
        addToast('Template must be a Word Document (.docx)', 'warning');
        return;
      }
      setResumeFile(file);
      setLastInjectedFileUrl(null);
      setInjectionsSummary(null);
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await apiClient.post('/resume/detect-bookmarks', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setDetectedBookmarks(res.data.bookmarks);
        addToast(`Detected ${res.data.bookmarks.length} bookmarks inside resume!`, 'success');
        
        // Default mapping: map cycle i to bookmark i
        const mapping: Record<number, string> = {};
        res.data.bookmarks.forEach((bm: string, idx: number) => {
          mapping[idx + 1] = bm;
        });
        setCustomMapping(mapping);
      } catch (error) {
        const apiError = error as { response?: { data?: { detail?: string } } };
        addToast(apiError.response?.data?.detail || 'Failed to detect bookmarks', 'error');
        setResumeFile(null);
      }
    }
  };

  // Run cycle extraction counts on paste/upload text
  useEffect(() => {
    const parseCycles = () => {
      const textToParse = pointsText;
      if (inputMethod === 'upload' && !pointsFile) {
        // Read file contents (async, we will handle in separate file select)
        return;
      }
      
      const matches = Array.from(textToParse.matchAll(/Cycle\s+(\d+):/gi));
      const uniqueCycleNums = Array.from(new Set(matches.map(m => parseInt(m[1]))));
      setDetectedCycles(uniqueCycleNums.length);
      
      // Auto mapping for cycles that match indices
      setCustomMapping(prev => {
        const mapping: Record<number, string> = { ...prev };
        uniqueCycleNums.forEach(num => {
          if (!mapping[num] && detectedBookmarks.length >= num) {
            mapping[num] = detectedBookmarks[num - 1];
          }
        });
        return mapping;
      });
    };
    
    parseCycles();
  }, [pointsText, detectedBookmarks, inputMethod, pointsFile]);

  const handlePointsFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPointsFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setPointsText(text);
        addToast('Extracted points file parsed successfully', 'info');
      };
      reader.readAsText(file);
    }
  };

  const handleProfileChange = async (profileName: string) => {
    setSelectedProfile(profileName);
    if (!profileName) return;
    
    try {
      const profDetails = await apiClient.get(`/resume/profiles/${encodeURIComponent(profileName)}`);
      const mapping: Record<number, string> = {};
      Object.entries(profDetails.data.mapping || {}).forEach(([k, v]) => {
        mapping[parseInt(k)] = v as string;
      });
      setCustomMapping(mapping);
      addToast(`Loaded profile layout: ${profileName}`, 'success');
    } catch {
      addToast('Failed to load profile mapping', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      addToast('Please enter a profile name first', 'warning');
      return;
    }
    
    try {
      const mappingStrKeys: Record<string, string> = {};
      Object.entries(customMapping).forEach(([k, v]) => {
        mappingStrKeys[k] = v;
      });

      await apiClient.post('/resume/profiles', {
        profile_name: profileName,
        resume_name: resumeFile?.name || 'Uploaded Resume',
        bookmarks: detectedBookmarks,
        mapping: mappingStrKeys
      });
      
      addToast(`Profile layout '${profileName}' saved successfully!`, 'success');
      setProfileName('');
      fetchProfiles();
    } catch {
      addToast('Failed to save profile mapping', 'error');
    }
  };

  const handleInject = async () => {
    if (!resumeFile) {
      addToast('Please upload a resume template first', 'warning');
      return;
    }
    if (!pointsText.trim()) {
      addToast('Extracted points cannot be empty', 'warning');
      return;
    }

    setInjecting(true);
    setLastInjectedFileUrl(null);
    setInjectionsSummary(null);

    const formData = new FormData();
    formData.append('file', resumeFile);
    formData.append('processed_text', pointsText);
    formData.append('unused_handling', unusedHandling);

    // Convert custom mapping integer keys to strings for transfer
    const strMapping: Record<string, string> = {};
    Object.entries(customMapping).forEach(([k, v]) => {
      strMapping[k] = v;
    });
    formData.append('custom_mapping', JSON.stringify(strMapping));

    try {
      const response = await apiClient.post('/resume/inject', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });

      // Parse summary header from response
      const summaryHeader = response.headers['x-injections-summary'];
      if (summaryHeader) {
        setInjectionsSummary(JSON.parse(summaryHeader));
      }

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const downloadUrl = window.URL.createObjectURL(blob);
      setLastInjectedFileUrl(downloadUrl);
      addToast('Points injected successfully! Word file is ready for download.', 'success');
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      addToast(apiError.response?.data?.detail || 'Failed to inject points', 'error');
    } finally {
      setInjecting(false);
    }
  };

  const downloadUpdatedResume = () => {
    if (!lastInjectedFileUrl) return;
    const link = document.createElement('a');
    link.href = lastInjectedFileUrl;
    link.download = `Resume_Injected_${resumeFile?.name || 'Updated.docx'}`;
    link.click();
  };

  // Mismatch warnings calculations
  const hasMismatch = detectedCycles !== detectedBookmarks.length && detectedCycles > 0;
  const isCyclesMore = detectedCycles > detectedBookmarks.length;

  return (
    <div className="space-y-6">
      {/* Description header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Single Resume Injector</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inject custom bullet points into specific bookmarks of your Word resume template.
          </p>
        </div>
        {(resumeFile || pointsText || lastInjectedFileUrl) && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:hover:bg-rose-950/20 dark:text-rose-455 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Injector</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Templates Upload and Bookmark Detection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Template upload */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
              <span>Upload Resume Template</span>
            </h3>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-850 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-lg p-6 w-full cursor-pointer transition-colors text-center">
                <input 
                  type="file" 
                  accept=".docx"
                  onChange={handleResumeUpload} 
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-355 block">
                  {resumeFile ? resumeFile.name : 'Upload resume (.docx)'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">Must contain Word bookmarks</span>
              </label>

              {detectedBookmarks.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/50 rounded-lg w-full space-y-1.5 self-stretch overflow-y-auto max-h-32">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Found bookmarks ({detectedBookmarks.length})</span>
                  <div className="flex flex-wrap gap-1">
                    {detectedBookmarks.map((bm, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/30 text-[9px] font-mono text-blue-700 dark:text-blue-400">
                        {bm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile load */}
            {profiles.length > 0 && detectedBookmarks.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-semibold text-slate-400 shrink-0">Load Profile:</span>
                <select
                  value={selectedProfile}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                >
                  <option value="">-- Create Custom Mapping --</option>
                  {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Step 2: Extracted points input */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-bold">2</span>
              <span>Provide Extracted Cycle Points</span>
            </h3>

            <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs">
              <button 
                onClick={() => setInputMethod('paste')}
                className={`pb-2 pr-4 font-semibold border-b-2 ${inputMethod === 'paste' ? 'border-blue-500 text-blue-600 dark:text-blue-455' : 'border-transparent text-slate-400'}`}
              >
                Paste Cycle Text
              </button>
              <button 
                onClick={() => setInputMethod('upload')}
                className={`pb-2 pr-4 font-semibold border-b-2 ${inputMethod === 'upload' ? 'border-blue-500 text-blue-600 dark:text-blue-455' : 'border-transparent text-slate-400'}`}
              >
                Upload TXT File
              </button>
            </div>

            {inputMethod === 'paste' ? (
              <textarea
                value={pointsText}
                onChange={(e) => setPointsText(e.target.value)}
                placeholder={`Cycle 1:\n• Bullet Point 1\n• Bullet Point 2\n\nCycle 2:\n• Bullet Point 3...`}
                className="w-full h-44 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/20 focus:outline-none text-xs font-mono"
              />
            ) : (
              <label className="flex flex-col items-center justify-center border border-dashed rounded-lg p-6 cursor-pointer text-center">
                <input 
                  type="file" 
                  accept=".txt"
                  onChange={handlePointsFileSelect} 
                  className="hidden"
                />
                <FileText className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {pointsFile ? pointsFile.name : 'Select cycle txt file'}
                </span>
              </label>
            )}
          </div>

          {/* Step 3: Mapping cycles to bookmarks */}
          {detectedCycles > 0 && detectedBookmarks.length > 0 && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                <span>Map Cycles to Bookmarks ({detectedCycles} cycles detected)</span>
              </h3>

              {/* Mismatch warnings */}
              {hasMismatch && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="space-y-1 text-amber-800 dark:text-amber-400 leading-relaxed">
                    <span className="font-bold">Bookmark Mismatch Detected!</span>
                    {isCyclesMore ? (
                      <p>You have {detectedCycles} cycles but only {detectedBookmarks.length} bookmarks. The additional cycles will not be injected.</p>
                    ) : (
                      <p>You have only {detectedCycles} cycles but {detectedBookmarks.length} bookmarks. Choose how to handle remaining bookmarks in the sidebar.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Dropdown mapping selectors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: detectedCycles }).map((_, i) => {
                  const cycleNum = i + 1;
                  return (
                    <div key={cycleNum} className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cycle {cycleNum}</label>
                      <select
                        value={customMapping[cycleNum] || ''}
                        onChange={(e) => setCustomMapping(prev => ({ ...prev, [cycleNum]: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                      >
                        <option value="">-- Unmapped --</option>
                        {detectedBookmarks.map(bm => <option key={bm} value={bm}>{bm}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Save profile layout input */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Save Mapping Profile Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Java Resume mapping"
                    className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 px-4 py-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shrink-0 cursor-pointer h-[32px] dark:border-slate-800"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Layout</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Injection Operations Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Mismatch advanced settings */}
          {hasMismatch && !isCyclesMore && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Handling Unused Bookmarks</h4>
              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 cursor-pointer">
                  <input 
                    type="radio" 
                    name="mismatch" 
                    value="keep" 
                    checked={unusedHandling === 'keep'} 
                    onChange={() => setUnusedHandling('keep')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500" 
                  />
                  <div>
                    <span className="font-semibold block">Keep original content</span>
                    <span className="text-[10px] text-slate-400">Preserves original text inside document</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 cursor-pointer">
                  <input 
                    type="radio" 
                    name="mismatch" 
                    value="repeat" 
                    checked={unusedHandling === 'repeat'} 
                    onChange={() => setUnusedHandling('repeat')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500" 
                  />
                  <div>
                    <span className="font-semibold block">Repeat last cycle</span>
                    <span className="text-[10px] text-slate-400">Fills remaining bookmarks with last cycle points</span>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/20 cursor-pointer">
                  <input 
                    type="radio" 
                    name="mismatch" 
                    value="clear" 
                    checked={unusedHandling === 'clear'} 
                    onChange={() => setUnusedHandling('clear')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500" 
                  />
                  <div>
                    <span className="font-semibold block">Clear bookmarks</span>
                    <span className="text-[10px] text-slate-400">Deletes bookmarks content from Word file</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Trigger and execution log card */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <GitFork className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250">Template Injections</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Compile cycle points directly into your Word templates preserving Word styles, colors, and layouts.
              </p>
            </div>

            <button
              onClick={handleInject}
              disabled={!resumeFile || !pointsText || injecting}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10 shadow-md shadow-blue-500/10"
            >
              {injecting ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <span>Inject Points into Resume</span>
              )}
            </button>

            {lastInjectedFileUrl && (
              <button
                onClick={downloadUpdatedResume}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-850 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-all cursor-pointer border dark:border-slate-700 h-10"
              >
                <Download className="w-4 h-4" />
                <span>Download Updated Resume</span>
              </button>
            )}
          </div>

          {/* Injection stats card */}
          {injectionsSummary && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 space-y-3"
            >
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Injections Summary</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                {Object.entries(injectionsSummary).map(([bm, count]) => (
                  <div key={bm} className="flex justify-between border-b border-emerald-100 dark:border-emerald-950/20 py-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{bm}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-450 shrink-0">{count} points</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
