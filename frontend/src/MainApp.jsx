import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import NotFound from "./components/NotFound.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import ApiDocs from "./components/ApiDocs.jsx";

function MainApp() {
  const [error, setError] = React.useState(null);

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
        <Route path="/" element={<ApiDocs />} />
        <Route path="/app" element={<App />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default MainApp;
