import React, { useState, useEffect, useCallback } from 'react';
import { useToastStore } from '../store/toastStore';
import { apiClient } from '../api/client';
import { 
  Mail, Send, Trash2, Info, 
  CheckCircle, AlertCircle, RefreshCw, Key, Paperclip
} from 'lucide-react';

interface EmailHistory {
  recipient: string;
  resume: string;
  timestamp: string;
  status: string;
}

export const EmailCampaign: React.FC = () => {
  // Configuration
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'outlook' | 'sendgrid'>('gmail');
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  // Message details
  const [recipientsInput, setRecipientsInput] = useState('');
  const [subject, setSubject] = useState('');

  const validatedRecipients = recipientsInput
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(e);
    });
  const [body, setBody] = useState('');
  const [selectedResume, setSelectedResume] = useState('');
  const [catalogResumes, setCatalogResumes] = useState<{ name: string; source: string }[]>([]);
  
  // States
  const [fetchingCatalog, setFetchingCatalog] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<EmailHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { addToast } = useToastStore();

  const fetchCatalog = useCallback(async () => {
    setFetchingCatalog(true);
    try {
      const res = await apiClient.get('/resume/catalog');
      setCatalogResumes(res.data);
      if (res.data.length > 0) {
        setSelectedResume(prev => prev || res.data[0].name);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetchingCatalog(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get('/email/history');
      setHistory(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCatalog();
      fetchHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCatalog, fetchHistory]);

  const handleSendEmails = async () => {
    if (validatedRecipients.length === 0) {
      addToast('Please enter at least one valid recipient email', 'warning');
      return;
    }
    if (!subject.trim()) {
      addToast('Please enter an email subject line', 'warning');
      return;
    }
    if (!body.trim()) {
      addToast('Please enter an email body text', 'warning');
      return;
    }
    if (!selectedResume) {
      addToast('Please select a resume attachment from the catalog', 'warning');
      return;
    }

    // Check credentials are filled
    if (emailProvider === 'gmail' && (!senderEmail || !appPassword)) {
      addToast('Please enter your Gmail Sender Email and App Password', 'warning');
      return;
    }
    if (emailProvider === 'outlook' && (!senderEmail || !appPassword)) {
      addToast('Please enter your Outlook Sender Email and Password', 'warning');
      return;
    }
    if (emailProvider === 'sendgrid' && !apiKey) {
      addToast('Please enter your SendGrid API key', 'warning');
      return;
    }

    setSending(true);

    // Structure credentials payload
    const credentialsConfig: Record<string, string> = {};
    if (emailProvider === 'gmail') {
      credentialsConfig['sender_email'] = senderEmail;
      credentialsConfig['app_password'] = appPassword;
    } else if (emailProvider === 'outlook') {
      credentialsConfig['sender_email'] = senderEmail;
      credentialsConfig['password'] = appPassword; // service translates this
    } else if (emailProvider === 'sendgrid') {
      credentialsConfig['api_key'] = apiKey;
    }

    const payload = {
      recipients: validatedRecipients,
      subject,
      body,
      cloud_provider: 'onedrive', // Default, resolves local automatically in backend
      resume_name: selectedResume,
      email_provider: emailProvider,
      config: credentialsConfig
    };

    try {
      const response = await apiClient.post('/email/send', payload);
      addToast(response.data.message || 'Email dispatch started in background', 'success');
      
      // Auto refresh logs after brief interval
      setTimeout(() => {
        fetchHistory();
      }, 3000);
    } catch (error) {
      const apiError = error as { response?: { data?: { detail?: string } } };
      addToast(apiError.response?.data?.detail || 'Failed to dispatch emails', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear the delivery history logs?')) return;
    try {
      await apiClient.delete('/email/history');
      setHistory([]);
      addToast('Logs history cleared successfully', 'success');
    } catch {
      addToast('Failed to clear logs history', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Description header */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Email Campaign</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Set up secure email configurations, validate lists of recruiter emails, and broadcast resumes dynamically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Draft Console */}
        <div className="lg:col-span-2 space-y-6">
          {/* Settings Credentials Card */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Key className="w-4 h-4 text-slate-400" />
              <span>Email Account Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Provider</label>
                <select
                  value={emailProvider}
                  onChange={(e) => setEmailProvider(e.target.value as 'gmail' | 'outlook' | 'sendgrid')}
                  className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                >
                  <option value="gmail">Gmail SMTP</option>
                  <option value="outlook">Outlook / Office 365</option>
                  <option value="sendgrid">SendGrid API</option>
                </select>
              </div>

              {emailProvider !== 'sendgrid' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sender Email</label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="e.g. sender@gmail.com"
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {emailProvider === 'gmail' ? 'Gmail App Password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SendGrid API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="SG.••••••••••••••••"
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {emailProvider === 'gmail' && (
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 text-[10px] text-blue-600 dark:text-blue-400 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Gmail requires enabling <strong>2-Step Verification</strong> and setting up an <strong>App Password</strong> in your Google Account settings. Standard account passwords will fail due to secure authentication policies.
                </p>
              </div>
            )}
          </div>

          {/* Email Composer */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Campaign Drafting</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recipients Email List</label>
                <textarea
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  placeholder="Paste email addresses separated by commas, semicolons, or line breaks..."
                  className="w-full h-20 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-slate-700 dark:text-slate-300"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Detected {validatedRecipients.length} valid emails</span>
                  {validatedRecipients.length > 0 && (
                    <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> Valid format list
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Select Resume Attachment</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedResume}
                      onChange={(e) => setSelectedResume(e.target.value)}
                      disabled={fetchingCatalog}
                      className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none text-slate-700 dark:text-slate-300"
                    >
                      {catalogResumes.length === 0 ? (
                        <option value="">No resumes found in catalog</option>
                      ) : (
                        catalogResumes.map(r => (
                          <option key={r.name} value={r.name}>{r.name}</option>
                        ))
                      )}
                    </select>
                    <button 
                      onClick={fetchCatalog}
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 cursor-pointer"
                      title="Reload catalog"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Attachment Status</label>
                  <div className="p-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/20 flex items-center gap-2 text-xs">
                    <Paperclip className="w-4 h-4 text-slate-450 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 truncate font-mono">
                      {selectedResume || 'No attachment selected'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Senior Software Engineer - Resume - John Doe"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Message Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email body copy..."
                  className="w-full h-44 p-3 border border-slate-200 dark:border-slate-800 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Delivery Console */}
        <div className="lg:col-span-1 space-y-6">
          {/* Dispatch actions */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-center">
            <Mail className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250">Send Campaign</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Executes the dispatches in the background. Delivery status will be tracked below in the live logs stream.
              </p>
            </div>

            <button
              onClick={handleSendEmails}
              disabled={sending || validatedRecipients.length === 0}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-all cursor-pointer h-10 shadow-md shadow-blue-500/10"
            >
              {sending ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Send {validatedRecipients.length} Email(s)</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Delivery History card */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Delivery Logs</h4>
              <div className="flex gap-2">
                <button 
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="p-1 hover:text-slate-700 text-slate-400 rounded transition cursor-pointer"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
                {history.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className="p-1 hover:text-rose-500 text-slate-400 rounded transition cursor-pointer"
                    title="Clear history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-450 italic">
                  No emails sent yet in this session.
                </div>
              ) : (
                history.map((log, idx) => (
                  <div key={idx} className="flex gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 text-xs">
                    {log.status === 'Success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : log.status === 'Sending' ? (
                      <RefreshCw className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 animate-spin" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="font-semibold text-slate-850 dark:text-slate-200 block truncate">{log.recipient}</span>
                      <span className="text-[10px] text-slate-450 block truncate">Resume: {log.resume}</span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
