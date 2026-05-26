import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiClient } from '../api/client';
import { 
  Cpu, Mail, GitFork, 
  ArrowRight, FileText, Sparkles 
} from 'lucide-react';
import { motion } from 'framer-motion';

interface CatalogSummary {
  total_resumes: number;
  local_resumes: number;
  gdrive_resumes: number;
  unique_technologies: string[];
  job_roles: string[];
}

interface EmailHistory {
  recipient: string;
  resume: string;
  timestamp: string;
  status: string;
}

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<CatalogSummary>({
    total_resumes: 0,
    local_resumes: 0,
    gdrive_resumes: 0,
    unique_technologies: [],
    job_roles: [],
  });
  const [recentEmails, setRecentEmails] = useState<EmailHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [sumRes, mailRes] = await Promise.all([
          apiClient.get('/resume/catalog/summary'),
          apiClient.get('/email/history')
        ]);
        setSummary(sumRes.data);
        setRecentEmails(mailRes.data.slice(0, 5));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = [
    { name: 'Total Resumes', value: summary.total_resumes, icon: FileText, color: 'text-blue-500 bg-blue-500/10' },
    { name: 'Tech Stacks', value: summary.unique_technologies.length, icon: Cpu, color: 'text-purple-500 bg-purple-500/10' },
    { name: 'Sent Resumes', value: recentEmails.length, icon: Mail, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  const quickActions = [
    { name: 'Run Automation', desc: 'One-click Match -> Inject -> Send', path: '/automation', icon: Sparkles, color: 'from-blue-600 to-indigo-600' },
    { name: 'Process Text', desc: 'Reorganize list points by cycles', path: '/single', icon: FileText, color: 'from-purple-600 to-pink-600' },
    { name: 'Inject Resumes', desc: 'Inject cycle text into DOCX bookmarks', path: '/injector', icon: GitFork, color: 'from-emerald-600 to-teal-600' }
  ];

  return (
    <div className="space-y-8">
      {/* Header banner */}
      <div className="relative p-6 md:p-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white overflow-hidden shadow-lg shadow-blue-500/15">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 hidden md:block">
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" preserveAspectRatio="none">
            <path d="M0 100 L50 20 L100 100 Z" fill="currentColor" />
          </svg>
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Structured Text & Resume Automations</h1>
          <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
            Extract and reorganise bullet points into clean cycle structures, adapt profiles using bookmark-injection templates, and launch recruiting campaign dispatches.
          </p>
        </div>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{stat.name}</span>
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{stat.value}</span>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Quick Action Wizard Launcher */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, idx) => (
            <motion.div
              key={action.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
            >
              <NavLink 
                to={action.path}
                className="group flex flex-col justify-between p-6 h-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-400/30 transition-all relative overflow-hidden shadow-sm"
              >
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <action.icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {action.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {action.desc}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-1 transition-transform mt-4">
                  <span>Open panel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </NavLink>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Grid: Tech list & Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tech list card */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Technologies catalog</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-6 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />)}
            </div>
          ) : summary.unique_technologies.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No resumes registered yet. Add templates in catalog manager.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {summary.unique_technologies.map(tech => (
                <span 
                  key={tech}
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recent logs card */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Recent email campaigns</h3>
            <NavLink to="/email" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">View history</NavLink>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />)}
            </div>
          ) : recentEmails.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No emails sent yet. Select cloud templates and enter recipient addresses in Campaign panel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-850 text-slate-400 font-semibold uppercase">
                    <th className="py-3">Recipient</th>
                    <th className="py-3">Campaign Subject</th>
                    <th className="py-3">Sent time</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmails.map((log, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{log.recipient}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{log.resume}</td>
                      <td className="py-3 text-slate-400">
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'Success' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' 
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
