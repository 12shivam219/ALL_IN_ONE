import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './layouts/AppLayout';
import { ToastContainer } from './components/ui/ToastContainer';

// Page imports
import { Dashboard } from './pages/Dashboard';
import { CatalogManager } from './pages/CatalogManager';
import { SingleProcessor } from './pages/SingleProcessor';
import { BatchProcessor } from './pages/BatchProcessor';
import { ResumeInjector } from './pages/ResumeInjector';
import { BatchResumeInjector } from './pages/BatchResumeInjector';
import { PointsGenerator } from './pages/PointsGenerator';
import { EmailCampaign } from './pages/EmailCampaign';
import { CompleteAutomation } from './pages/CompleteAutomation';
import { Login } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Application Views wrapped with Sidebar and Headers Layout */}
          <Route
            path="/*"
            element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/catalog" element={<CatalogManager />} />
                  <Route path="/single" element={<SingleProcessor />} />
                  <Route path="/batch" element={<BatchProcessor />} />
                  <Route path="/injector" element={<ResumeInjector />} />
                  <Route path="/batch-injector" element={<BatchResumeInjector />} />
                  <Route path="/generator" element={<PointsGenerator />} />
                  <Route path="/email" element={<EmailCampaign />} />
                  <Route path="/automation" element={<CompleteAutomation />} />
                  
                  {/* Catch-all Redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            }
          />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
