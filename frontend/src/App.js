// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Sidebar from './components/Sidebar';
import SessionDetail from './components/SessionDetail';
import './styles/App.css';

const theme = createTheme({
  palette: {
    primary: { main: '#22C197' },
    primgreen: { main: '#22C197' },
    secondary: { main: '#FFC55F' },
    seconred: { main: '#FF6AA8' }
  },
  typography: {
    fontFamily: ['Roboto', 'sans-serif'].join(',')
  }
});

function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    fetchAllSessions();
  }, []);

  const fetchAllSessions = async () => {
    try {
      const res = await axios.get('/api/sessions');
      setSessions(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching sessions:', err);
      return [];
    }
  };

  // This function fetches a single session from the server and updates selectedSession.
  async function fetchSessionById(sessionId) {
    try {
      const res = await axios.get(`/api/sessions/${sessionId}`);
      console.log("PARENT: Updated session data:", res.data);
      setSelectedSession(res.data);
      // Also update the sessions array so the sidebar re-renders:
      setSessions(prev =>
        prev.map(s => s.session_id === sessionId ? res.data : s)
      );
    } catch (err) {
      console.error('Error fetching single session:', err);
    }
  }

  // When a session is selected in the Sidebar.
  const handleSessionSelect = async (session) => {
    setSelectedSessionId(session.session_id);
    await fetchSessionById(session.session_id);
  };

  // When a session is updated (e.g. title edit), update the sessions array and selectedSession.
  const handleSessionUpdate = (updatedSession) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.session_id === updatedSession.session_id ? updatedSession : s
      )
    );
    if (selectedSession && selectedSession.session_id === updatedSession.session_id) {
      setSelectedSession(updatedSession);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: 'flex', height: '100vh' }}>
        <Sidebar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSessionSelect={handleSessionSelect}
          onSessionsChange={setSessions}
          fetchAllSessions={fetchAllSessions}
        />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedSession ? (
            <SessionDetail
              sessionData={selectedSession}
              onSessionUpdate={handleSessionUpdate}
              fetchSessionDetails={fetchSessionById}
            />
          ) : (
            <p style={{ flex: 1, textAlign: 'center', marginTop: '4rem' }}>
              Select a session from the sidebar.
            </p>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
