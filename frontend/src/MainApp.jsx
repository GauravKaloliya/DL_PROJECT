import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";
import NotFound from "./components/NotFound.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import ApiDocs from "./components/ApiDocs.jsx";

// Allow copy/paste only in input fields
const preventCopyPaste = (e) => {
  const target = e.target;
  const isInputField = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.contentEditable === 'true' ||
                       target.closest('input') ||
                       target.closest('textarea') ||
                       target.closest('[contenteditable="true"]');
  
  // Allow copy/paste only in input fields
  if (!isInputField) {
    e.preventDefault();
    return false;
  }
};

// Initialize copy/paste prevention when component loads
document.addEventListener("copy", preventCopyPaste);
document.addEventListener("paste", preventCopyPaste);
document.addEventListener("cut", preventCopyPaste);

function MainApp() {
  const [error, setError] = React.useState(null);

  // Error boundary for the entire app
  React.useEffect(() => {
    const handleError = (event) => {
      console.error('Application error:', event.error);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      setError(event.reason);
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (error) {
    return <ErrorPage error={error} resetError={() => setError(null)} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="/api/docs" element={<ApiDocs />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default MainApp;