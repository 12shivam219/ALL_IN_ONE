import React, { useState } from 'react';
import { useToastStore } from '../store/toastStore';
import { apiClient } from '../api/client';
import { 
  Sparkles, Code, FileText, Copy, Download, Plus, X, ArrowRight
} from 'lucide-react';

export const PointsGenerator: React.FC = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [pointsPerTech, setPointsPerTech] = useState(3);
  
  const [extracting, setExtracting] = useState(false);
  const [extractedTechs, setExtractedTechs] = useState<string[]>([]);
  const [customTechInput, setCustomTechInput] = useState('');
  
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string>('');
  
  const { addToast } = useToastStore();

  const handleExtractTech = async () => {
    if (!jobDescription || jobDescription.length < 50) {
      addToast('Job description must be at least 50 characters long', 'warning');
      return;
    }
    
    setExtracting(true);
    try {
      const response = await apiClient.post('/generator/extract-tech', {
        job_description: jobDescription,
      });
      setExtractedTechs(response.data.technologies);
      addToast(`Extracted ${response.data.technologies.length} key technologies!`, 'success');
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to extract technologies', 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleAddCustomTech = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTechInput.trim()) return;
    
    if (extractedTechs.includes(customTechInput.trim())) {
      addToast('Technology already listed', 'warning');
      return;
    }

    setExtractedTechs(prev => [...prev, customTechInput.trim()]);
    setCustomTechInput('');
  };

  const handleRemoveTech = (tech: string) => {
    setExtractedTechs(prev => prev.filter(t => t !== tech));
  };

  const handleGeneratePoints = async () => {
    if (!jobTitle.trim()) {
      addToast('Please enter a target job title first', 'warning');
      return;
    }
    if (extractedTechs.length === 0) {
      addToast('Please extract or add at least one technology keyword', 'warning');
      return;
    }

    setGenerating(true);
    try {
      const response = await apiClient.post('/generator/generate-points', {
        job_description: jobDescription,
        job_title: jobTitle,
        technologies: extractedTechs,
        points_per_tech: pointsPerTech
      });
      setGeneratedResult(response.data.generated_text);
      addToast('AI Bullet points generated successfully!', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to generate points', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult);
    addToast('Copied to clipboard!', 'success');
  };

  const handleDownload = () => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${jobTitle.replace(/\s+/g, '_')}_Generated_Points.txt`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>AI Points Generator</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Parse job descriptions, extract technical keywords, and generate targeted, professional experience bullet points aligned with specific roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Form parameters */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Job Details</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Job Title</label>
                <input 
                  type="text" 
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Description</label>
                <textarea 
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here (at least 50 chars)..."
                  className="w-full h-48 p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans text-slate-700 dark:text-slate-300"
                />
              </div>

              <div className="flex items-center justify-between gap-4 py-2 border-t border-slate-100 dark:border-slate-850">
                <div className="space-y-0.5">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Experience Points Per Tech</label>
                  <span className="text-[10px] text-slate-400">Number of bullet points generated for each tag</span>
                </div>
                <input 
                  type="number" 
                  min="1" 
                  max="10"
                  value={pointsPerTech || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPointsPerTech(val > 10 ? 10 : val);
                  }}
                  onBlur={() => {
                    if (pointsPerTech < 1) {
                      setPointsPerTech(1);
                    }
                  }}
                  className="w-20 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300 text-center"
                />
              </div>
            </div>

            <button
              onClick={handleExtractTech}
              disabled={extracting || !jobDescription}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer h-9 transition"
            >
              {extracting ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Code className="w-4 h-4" />
              )}
              <span>Extract Technologies</span>
            </button>
          </div>

          {/* Keywords & Tags panel */}
          {(extractedTechs.length > 0 || jobTitle) && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Target Tech Stack</h3>
              
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850">
                {extractedTechs.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No technologies added yet. Use extraction above or add custom ones below.</span>
                ) : (
                  extractedTechs.map(tech => (
                    <span 
                      key={tech} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/30 text-xs font-medium text-blue-700 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/35"
                    >
                      <span>{tech}</span>
                      <button 
                        onClick={() => handleRemoveTech(tech)}
                        className="hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-0.5 rounded transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add custom tag */}
              <form onSubmit={handleAddCustomTech} className="flex gap-2 max-w-sm">
                <input 
                  type="text"
                  placeholder="e.g. GraphQL, Tailwind"
                  value={customTechInput}
                  onChange={(e) => setCustomTechInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                />
                <button 
                  type="submit"
                  className="inline-flex items-center justify-center p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Result view */}
          {generatedResult && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>Generated Experience Points</span>
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                    title="Download .txt"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 text-slate-200 text-xs font-mono overflow-x-auto h-96 whitespace-pre-wrap leading-relaxed">
                {generatedResult}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Operations Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <Sparkles className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250">Generate Experience</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Let Groq AI generate bullet points structured as cycles. Paste these cycles into the Resume Template Injector to build your customized CV.
              </p>
            </div>

            <button
              onClick={handleGeneratePoints}
              disabled={!jobTitle || extractedTechs.length === 0 || generating}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10 shadow-md shadow-blue-500/10"
            >
              {generating ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Generate Experience</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
