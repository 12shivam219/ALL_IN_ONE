import React, { useState, useEffect, useCallback } from 'react';
import { useToastStore } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';
import { apiClient } from '../api/client';
import { 
  PlayCircle, Terminal, Download, Key, Plus, X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AutomationLog {
  success: boolean;
  selected_resume: { name: string; person_name?: string; technologies?: string[] } | string;
  match_score: number;
  email_sent: boolean;
  resume_file_path: string;
  logs: string[];
}

interface AutomationPrepare {
  selected_resume: { name: string; person_name?: string; technologies?: string[] } | string;
  match_score: number;
  tech_stacks: string[];
  logs: string[];
}

interface AutomationPointReview {
  selected_resume: { name: string; person_name?: string; technologies?: string[] } | string;
  match_score: number;
  tech_stacks: string[];
  generated_text: string;
  processed_points: string;
  logs: string[];
}

export const CompleteAutomation: React.FC = () => {
  // Input parameters
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [pointsPerTech, setPointsPerTech] = useState(3);
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [overrideResume, setOverrideResume] = useState('');
  const [catalogResumes, setCatalogResumes] = useState<{ name: string }[]>([]);
  
  // Email provider configuration
  const [emailProvider, setEmailProvider] = useState<'none' | 'gmail' | 'outlook' | 'sendgrid'>('none');
  const [apiKey, setApiKey] = useState('');

  // Execution states
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [generatingPoints, setGeneratingPoints] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState<AutomationLog | null>(null);
  const [preparedReview, setPreparedReview] = useState<AutomationPrepare | null>(null);
  const [pointReview, setPointReview] = useState<AutomationPointReview | null>(null);
  const [editableCycleText, setEditableCycleText] = useState('');
  const [techStacks, setTechStacks] = useState<string[]>([]);
  const [newTechStack, setNewTechStack] = useState('');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  const { addToast } = useToastStore();
  const { pointsPerCycle, setPointsPerCycle } = useSettingsStore();

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await apiClient.get('/resume/catalog');
      setCatalogResumes(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCatalog();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCatalog]);

  const clearPreparedReview = () => {
    setPreparedReview(null);
    setPointReview(null);
    setEditableCycleText('');
    setTechStacks([]);
    setNewTechStack('');
    setResult(null);
  };

  const clearPointReview = () => {
    setPointReview(null);
    setEditableCycleText('');
    setResult(null);
  };

  const resetWorkflow = () => {
    setJobTitle('');
    setJobDescription('');
    setPointsPerTech(3);
    setRecruiterEmail('');
    setPersonalMessage('');
    setOverrideResume('');
    setEmailProvider('none');
    setApiKey('');
    setRunning(false);
    setPreparing(false);
    setGeneratingPoints(false);
    setFinalizing(false);
    setResult(null);
    setPreparedReview(null);
    setPointReview(null);
    setEditableCycleText('');
    setTechStacks([]);
    setNewTechStack('');
    setActiveStep(0);
    setLogs([]);
  };

  const validateInputs = () => {
    if (!jobTitle.trim()) {
      addToast('Please enter a target job title', 'warning');
      return false;
    }
    if (!jobDescription || jobDescription.length < 50) {
      addToast('Please enter a complete job description (min 50 chars)', 'warning');
      return false;
    }
    if (!recruiterEmail.trim()) {
      addToast('Please enter recruiter email addresses', 'warning');
      return false;
    }
    return true;
  };

  const buildBaseFormData = () => {
    const formData = new FormData();
    formData.append('job_title', jobTitle);
    formData.append('job_description', jobDescription);
    formData.append('points_per_tech', String(pointsPerTech));
    formData.append('points_per_cycle', String(pointsPerCycle));
    formData.append('recruiter_email', recruiterEmail);
    formData.append('personal_message', personalMessage);
    if (overrideResume) {
      formData.append('override_resume', overrideResume);
    }
    return formData;
  };

  const prepareAutomation = async () => {
    if (!validateInputs()) return;

    setPreparing(true);
    setResult(null);
    setPreparedReview(null);
    setTechStacks([]);
    setActiveStep(1);
    setLogs(['Validating parameters...', 'Extracting tech stacks from job description...']);

    try {
      const response = await apiClient.post('/automation/prepare', buildBaseFormData(), {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const resData = response.data;
      setPreparedReview(resData);
      setTechStacks(resData.tech_stacks || []);
      setActiveStep(2);
      setLogs(resData.logs || []);
      addToast('Tech stacks extracted. Review them before generating points.', 'success');
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      const errDetail = apiError.response?.data?.detail;
      const msg = typeof errDetail === 'string' ? errDetail : errDetail || 'Failed to prepare automation';
      setActiveStep(0);
      addToast(msg, 'error');
    } finally {
      setPreparing(false);
    }
  };

  const generatePointsForReview = async () => {
    if (!validateInputs()) return;
    if (techStacks.length === 0) {
      addToast('Please keep at least one tech stack before generating points', 'warning');
      return;
    }

    setGeneratingPoints(true);
    setResult(null);
    setActiveStep(3);
    setLogs(['Confirmed reviewed tech stacks.', 'Generating custom experience bullet points...']);

    const formData = buildBaseFormData();
    formData.append('tech_stacks', JSON.stringify(techStacks));

    try {
      const response = await apiClient.post('/automation/generate-points', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const resData = response.data;
      setPointReview(resData);
      setEditableCycleText(resData.processed_points || '');
      setActiveStep(4);
      setLogs(resData.logs || []);
      addToast('Points generated. Review cycle text before injection.', 'success');
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      const errDetail = apiError.response?.data?.detail;
      const msg = typeof errDetail === 'string' ? errDetail : errDetail || 'Point generation encountered an error';
      setActiveStep(0);
      addToast(msg, 'error');
    } finally {
      setGeneratingPoints(false);
    }
  };

  const finalizeAutomation = async () => {
    if (!validateInputs()) return;
    if (!editableCycleText.trim()) {
      addToast('Reviewed cycle points cannot be empty', 'warning');
      return;
    }
    if (techStacks.length === 0) {
      addToast('Please keep at least one tech stack before injecting points', 'warning');
      return;
    }
    if (emailProvider === 'sendgrid' && !apiKey) {
      addToast('SendGrid API Key is required', 'warning');
      return;
    }

    setFinalizing(true);
    setRunning(true);
    setResult(null);
    setActiveStep(5);
    setLogs(['Using reviewed cycle text.', 'Injecting into DOCX template paragraphs...']);

    const credentialsConfig: Record<string, string> = {};
    if (emailProvider === 'sendgrid') {
      credentialsConfig['api_key'] = apiKey;
    }

    const formData = buildBaseFormData();
    formData.append('email_provider', emailProvider);
    formData.append('email_config', JSON.stringify(credentialsConfig));
    formData.append('tech_stacks', JSON.stringify(techStacks));
    formData.append('processed_points', editableCycleText);

    // Simulate animated stepper timeline logging while server runs
    const logInterval = setInterval(() => {
      setLogs(prev => {
        const nextLogs = [...prev];
        if (nextLogs.length === 2) {
          nextLogs.push(overrideResume ? `Selected override template: ${overrideResume}` : 'Matching catalog templates with reviewed tech stacks...');
        } else if (nextLogs.length === 3) {
          nextLogs.push('Preserving original template XML styling sheets...');
        } else if (nextLogs.length === 4 && emailProvider !== 'none') {
          setActiveStep(6);
          nextLogs.push('Dispatching attachment to recruiter emails...');
        }
        return nextLogs;
      });
    }, 1500);

    try {
      const response = await apiClient.post('/automation/finalize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      clearInterval(logInterval);
      
      const resData = response.data;
      setResult(resData);
      setActiveStep(7);
      setLogs(resData.logs || []);
      addToast('One-click Recruiter pipeline completed successfully!', 'success');
    } catch (error) {
      clearInterval(logInterval);
      const apiError = error as { response?: { data?: { detail?: string } } };
      const errDetail = apiError.response?.data?.detail;
      const msg = typeof errDetail === 'string' ? errDetail : errDetail || 'Automation execution encountered an error';
      
      setActiveStep(0);
      addToast(msg, 'error');
    } finally {
      setFinalizing(false);
      setRunning(false);
    }
  };

  const addTechStack = () => {
    const tech = newTechStack.trim();
    if (!tech) return;
    if (techStacks.some(item => item.toLowerCase() === tech.toLowerCase())) {
      addToast('That tech stack is already in the list', 'info');
      return;
    }
    clearPointReview();
    setTechStacks(prev => [...prev, tech]);
    setNewTechStack('');
  };

  const removeTechStack = (tech: string) => {
    clearPointReview();
    setTechStacks(prev => prev.filter(item => item !== tech));
  };

  const handleDownloadResultFile = () => {
    if (!result?.resume_file_path) return;
    const filepath = encodeURIComponent(result.resume_file_path);
    window.open(`${apiClient.defaults.baseURL}/automation/download?filepath=${filepath}`, '_blank');
  };

  const steps = [
    { label: 'Extract stacks', desc: 'Parse JD keywords' },
    { label: 'Review stacks', desc: 'Add or remove skills' },
    { label: 'AI generation', desc: 'Generate target cycles' },
    { label: 'Review points', desc: 'Edit cycle text' },
    { label: 'Inject DOCX', desc: 'Insert bookmarks' },
    { label: 'Email dispatcher', desc: 'Deliver package' }
  ];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Complete Automation Stepper</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Orchestrate semantic matching, bullet point generation, bookmarks injection, and email dispatch in a single workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Wizard forms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Pipeline Parameters</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Job Title</label>
                  <input 
                    type="text" 
                    value={jobTitle}
                    onChange={(e) => {
                      setJobTitle(e.target.value);
                      clearPreparedReview();
                    }}
                    placeholder="e.g. Senior Backend Architect"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Override Resume (Optional)</label>
                  <select
                    value={overrideResume}
                    onChange={(e) => {
                      setOverrideResume(e.target.value);
                      clearPreparedReview();
                    }}
                    className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none text-slate-700 dark:text-slate-300"
                  >
                    <option value="">-- Let System Match Automatically --</option>
                    {catalogResumes.map(r => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Description</label>
                <textarea 
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    clearPreparedReview();
                  }}
                  placeholder="Paste the job description (at least 50 chars)..."
                  className="w-full h-32 p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recruiter Emails (comma separated)</label>
                  <input 
                    type="text" 
                    value={recruiterEmail}
                    onChange={(e) => setRecruiterEmail(e.target.value)}
                    placeholder="recruiter1@hr.com, recruiter2@jobs.com"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Experience Points Per Tech</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={pointsPerTech || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPointsPerTech(val > 10 ? 10 : val);
                      clearPreparedReview();
                    }}
                    onBlur={() => {
                      if (pointsPerTech < 1) {
                        setPointsPerTech(1);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Extract per Cycle</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={pointsPerCycle || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPointsPerCycle(val > 10 ? 10 : val);
                      clearPreparedReview();
                    }}
                    onBlur={() => {
                      if (pointsPerCycle < 1) {
                        setPointsPerCycle(1);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Personal Message / Cover Mail Body (Optional)</label>
                <textarea 
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  placeholder="Introduce yourself or leave blank to auto-generate a professional recruiter note..."
                  className="w-full h-24 p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Tech stack review gate */}
          {preparedReview && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Extracted Tech Stacks</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Add missing skills or remove anything you do not want used for point generation.
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 sm:text-right">
                  <span className="block font-bold text-slate-700 dark:text-slate-300">
                    {typeof preparedReview.selected_resume === 'string' ? preparedReview.selected_resume : preparedReview.selected_resume?.name || 'Unknown'}
                  </span>
                  <span>Match score: {preparedReview.match_score.toFixed(0)}%</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {techStacks.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] font-semibold text-blue-700 dark:text-blue-350"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTechStack(tech)}
                      className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newTechStack}
                  onChange={(e) => setNewTechStack(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTechStack();
                    }
                  }}
                  placeholder="Add a tech stack, e.g. Kubernetes"
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
                <button
                  type="button"
                  onClick={addTechStack}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold h-9"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}

          {/* Generated points review gate */}
          {pointReview && (
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Generated Points</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Edit the cycle text below. This exact text will be injected into the resume.
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 sm:text-right">
                  <span className="block font-bold text-slate-700 dark:text-slate-300">
                    {pointReview.tech_stacks.length} tech stack{pointReview.tech_stacks.length === 1 ? '' : 's'}
                  </span>
                  <span>{(editableCycleText.match(/^Cycle\s+\d+:/gim) || []).length} cycle blocks</span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Raw Tech Stack Points</label>
                  <pre className="h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-mono">
                    {pointReview.generated_text}
                  </pre>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Editable Cycle Points</label>
                  <textarea
                    value={editableCycleText}
                    onChange={(e) => setEditableCycleText(e.target.value)}
                    className="h-72 w-full resize-y rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email dispatch configuration */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Email Delivery Method</span>
            </h3>

            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose how to send the resume to recruiters. Gmail & Outlook use your backend credentials from the server environment (.env).
              </p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-950" 
                       onClick={() => setEmailProvider('none')}>
                  <input
                    type="radio"
                    checked={emailProvider === 'none'}
                    onChange={() => setEmailProvider('none')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Compile & Download Only</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">No email sent, just download the resume</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-950"
                       onClick={() => setEmailProvider('gmail')}>
                  <input
                    type="radio"
                    checked={emailProvider === 'gmail'}
                    onChange={() => setEmailProvider('gmail')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gmail (Backend Configured)</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Uses server credentials from environment</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-950"
                       onClick={() => setEmailProvider('outlook')}>
                  <input
                    type="radio"
                    checked={emailProvider === 'outlook'}
                    onChange={() => setEmailProvider('outlook')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Outlook (Backend Configured)</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Uses server credentials from environment</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-950"
                       onClick={() => setEmailProvider('sendgrid')}>
                  <input
                    type="radio"
                    checked={emailProvider === 'sendgrid'}
                    onChange={() => setEmailProvider('sendgrid')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">SendGrid API</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Provide your own API key below</p>
                  </div>
                </label>
              </div>

              {emailProvider === 'sendgrid' && (
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SendGrid API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="SG.••••••••••••••••"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stepper tracking sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stepper timeline */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workflow Tracker</h4>
            
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isCompleted = activeStep > stepNum;
                const isActive = activeStep === stepNum;
                
                return (
                  <div key={idx} className="flex gap-3 text-xs items-start">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border transition-all ${
                        isCompleted 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/25' 
                          : isActive 
                            ? 'bg-blue-600 border-blue-600 text-white animate-pulse' 
                            : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}>
                        {isCompleted ? '✓' : stepNum}
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`w-[2px] h-8 my-1 transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
                      )}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      <span className={`font-semibold block ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-slate-700 dark:text-slate-350' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{step.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={pointReview ? finalizeAutomation : preparedReview ? generatePointsForReview : prepareAutomation}
              disabled={running || preparing || generatingPoints || finalizing || !jobTitle || !jobDescription || !recruiterEmail}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10 shadow-md shadow-blue-500/10 mt-4"
            >
              {running || preparing || generatingPoints || finalizing ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : pointReview ? (
                <>
                  <span>Inject Reviewed Cycle Points</span>
                  <PlayCircle className="w-4 h-4" />
                </>
              ) : preparedReview ? (
                <>
                  <span>Generate With Reviewed Tech Stacks</span>
                  <PlayCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Extract Tech Stacks</span>
                  <PlayCircle className="w-4 h-4" />
                </>
              )}
            </button>

            {(preparedReview || pointReview || result || logs.length > 0) && (
              <button
                type="button"
                onClick={resetWorkflow}
                disabled={running || preparing || generatingPoints || finalizing}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs transition-all cursor-pointer h-10"
              >
                <X className="w-4 h-4" />
                <span>Start New Automation</span>
              </button>
            )}
          </div>

          {/* Live Terminal logs output */}
          {logs.length > 0 && (
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-850 shadow-sm space-y-3 font-mono">
              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
                <Terminal className="w-3.5 h-3.5" />
                <span>Workflow Logs Stream</span>
              </h4>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-[10px] text-slate-300 leading-relaxed scrollbar-thin">
                {logs.map((log, index) => (
                  <div key={index} className="flex gap-1.5">
                    <span className="text-blue-550 select-none">▶</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome summaries */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 space-y-3 text-xs"
            >
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-450 uppercase tracking-wider">Compilation Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-emerald-100/50 dark:border-emerald-950/10">
                  <span className="text-slate-500 dark:text-slate-400">Template Selected</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px] font-mono">
                    {typeof result.selected_resume === 'string' ? result.selected_resume : result.selected_resume?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100/50 dark:border-emerald-950/10">
                  <span className="text-slate-500 dark:text-slate-400">Keyword Tech Overlap</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{result.match_score.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100/50 dark:border-emerald-950/10">
                  <span className="text-slate-500 dark:text-slate-400">Email Delivered</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{result.email_sent ? 'Yes' : 'No (Download Only)'}</span>
                </div>
              </div>

              {result.resume_file_path && (
                <button
                  onClick={handleDownloadResultFile}
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition h-9 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Transferred DOCX</span>
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
