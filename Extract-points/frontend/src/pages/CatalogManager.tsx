import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/toastStore';
import { 
  FileText, Search, Plus, Trash2, Upload, 
  Tag, Compass, Calendar, BookOpen, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Resume {
  name: string;
  path?: string;
  source: string;
  file_id?: string;
  person_name?: string;
  technologies: string[];
  job_roles: string[];
  bookmarks: string[];
  added_date?: string;
}

export const CatalogManager: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTech, setSelectedTech] = useState('All');
  
  // Drag and drop / Modal upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addToast } = useToastStore();

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/resume/catalog');
      setResumes(res.data);
    } catch (error) {
      addToast('Failed to fetch resume catalog', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the catalog?`)) return;
    try {
      await apiClient.delete(`/resume/catalog/${name}`);
      addToast('Resume removed from catalog successfully', 'success');
      setResumes(prev => prev.filter(r => r.name !== name));
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'Failed to delete resume', 'error');
    }
  };

  // Upload actions
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => {
    setDragging(false);
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      addToast('Only Word Documents (.docx) are supported as templates', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await apiClient.post('/resume/catalog/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      addToast(res.data.message || 'File uploaded and registered successfully!', 'success');
      setUploadModalOpen(false);
      fetchCatalog();
    } catch (error: any) {
      addToast(error.response?.data?.detail || 'File upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  // Gather unique technologies for filters
  const allTechs = Array.from(new Set(resumes.flatMap(r => r.technologies || [])));

  // Filter logic
  const filteredResumes = resumes.filter(resume => {
    const matchesSearch = resume.name.toLowerCase().includes(search.toLowerCase()) || 
                          (resume.person_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesTech = selectedTech === 'All' || resume.technologies.includes(selectedTech);
    return matchesSearch && matchesTech;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Resume Catalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Store and manage Word (.docx) templates, identify bookmarks, and review extracted technologies.
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-blue-500/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Template</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search templates or candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 shrink-0">Filter Technology:</span>
          <select
            value={selectedTech}
            onChange={(e) => setSelectedTech(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Tech Stacks</option>
            {allTechs.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : filteredResumes.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300">No templates found</h4>
          <p className="text-xs text-slate-500 mt-1">Try uploading a new Word resume file to populate your catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResumes.map((resume) => (
            <motion.div
              layout
              key={resume.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between h-72 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Heading details */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[150px]" title={resume.name}>
                        {resume.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Registered local</span>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(resume.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-colors"
                    title="Remove Resume"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Candidate name & bookmarks metadata */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">
                    <Compass className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">Candidate:</span>
                    <span className="text-slate-500 dark:text-slate-400">{resume.person_name || 'Generic'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">Bookmarks:</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {resume.bookmarks ? resume.bookmarks.length : 0} found
                    </span>
                  </div>
                </div>

                {/* Tech stacks tags */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tech Stack</span>
                  <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto">
                    {resume.technologies.length === 0 ? (
                      <span className="text-[10px] text-slate-400 italic">None detected</span>
                    ) : (
                      resume.technologies.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{t}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bookmark dropdown toggle indicator */}
              {resume.bookmarks && resume.bookmarks.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-850">
                  <div className="text-[10px] text-slate-400 truncate">
                    📌 {resume.bookmarks.slice(0, 3).join(', ')}
                    {resume.bookmarks.length > 3 && ` +${resume.bookmarks.length - 3} more`}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Drag & Drop Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => !uploading && setUploadModalOpen(false)}
              className="fixed inset-0 bg-black"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 relative z-10 shadow-2xl space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Upload Resume Template</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add bookmarks to your resume sections in Word before uploading. Filename format should be: <code className="text-blue-600 dark:text-blue-400 font-semibold">CandidateName_Tech1_Tech2.docx</code>.
                </p>
              </div>

              {/* Drag Area */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  dragging 
                    ? 'border-blue-500 bg-blue-500/5' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileSelect}
                  accept=".docx"
                  className="hidden"
                  disabled={uploading}
                />
                
                {uploading ? (
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
                    <span className="text-xs font-semibold text-slate-500">Reading template bookmarks & uploading...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400" />
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">Drag & drop resume file here</span>
                      <span className="text-xs text-slate-400">or click to browse local files</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Only <strong>.docx</strong> extension is supported. Keep file size under 10MB.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
