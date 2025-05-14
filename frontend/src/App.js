// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Sidebar from './components/Sidebar';
import SessionDetail from './components/SessionDetail';
import './styles/App.css';
import './styles/_tokens.css';
import theme from './theme';




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
      setSelectedSession(res.data);
      // Also update the sessions array so the sidebar re-renders:
      setSessions(prev =>
        prev.map(s => s.session_id === sessionId ? res.data : s)
      );
    } catch (err) {
      console.error('Error fetching single session:', err);
    }
  }

  // Create & immediately open a brand-new session  ───────────
  async function handleCreateSession() {
    try {
      const res = await axios.post('/api/sessions', {
        session_title: 'Untitled session'
      });
      const newSession = res.data;

      // refresh list, then select the brand-new one
      const updated = await fetchAllSessions();
      const found   = updated.find(s => s.session_id === newSession.session_id);
      handleSessionSelect(found || newSession);
    } catch (err) { console.error('Error creating session:', err); }
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
          onSessionUpdate={handleSessionUpdate}
          selectedSession={selectedSession}
          fetchSessionDetails={fetchSessionById}
          onCreateSession={handleCreateSession} 
        />

        <div className="container-sesh" style={{ flex: 1, overflowY: 'auto' }}>
          <SessionDetail
            sessionData        ={selectedSession}
            onSessionUpdate    ={handleSessionUpdate}
            fetchSessionDetails={fetchSessionById}
            onCreateSession    ={handleCreateSession} 
          />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
