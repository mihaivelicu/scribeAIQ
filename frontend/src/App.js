// src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Sidebar from './components/Sidebar';
import SessionDetail from './components/SessionDetail';

import './styles/App.css';
import './styles/_tokens.css';
import theme from './theme';

function App() {
  /* ------------------------------------------------------------ */
  /*  State                                                       */
  /* ------------------------------------------------------------ */
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isRecording, setIsRecording] = useState(false);          // ← NEW

  /* ------------------------------------------------------------ */
  /*  Initial fetch                                               */
  /* ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------ */
  /*  Fetch single session                                        */
  /* ------------------------------------------------------------ */
  const fetchSessionById = async (sessionId) => {
    try {
      const res = await axios.get(`/api/sessions/${sessionId}`);
      setSelectedSession(res.data);
      setSessions((prev) =>
        prev.map((s) => (s.session_id === sessionId ? res.data : s))
      );
    } catch (err) {
      console.error('Error fetching single session:', err);
    }
  };

  /* ------------------------------------------------------------ */
  /*  Create session                                              */
  /* ------------------------------------------------------------ */
  const handleCreateSession = async () => {
    try {
      const res = await axios.post('/api/sessions', {
        session_title: 'Untitled session',
      });
      const newSession = res.data;

      const updated = await fetchAllSessions();
      const found = updated.find((s) => s.session_id === newSession.session_id);
      handleSessionSelect(found || newSession);
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  /* ------------------------------------------------------------ */
  /*  Select session                                              */
  /* ------------------------------------------------------------ */
  const handleSessionSelect = async (session) => {
    setSelectedSessionId(session.session_id);
    await fetchSessionById(session.session_id);
  };

  /* ------------------------------------------------------------ */
  /*  Update session (title etc.)                                 */
  /* ------------------------------------------------------------ */
  const handleSessionUpdate = (updatedSession) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.session_id === updatedSession.session_id ? updatedSession : s
      )
    );
    if (
      selectedSession &&
      selectedSession.session_id === updatedSession.session_id
    ) {
      setSelectedSession(updatedSession);
    }
  };

  /* ------------------------------------------------------------ */
  /*  Render                                                      */
  /* ------------------------------------------------------------ */
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
          /* Sticky-recorder props */
          isRecording={isRecording}
          onRecordingChange={setIsRecording}
        />

        <div className="container-sesh" style={{ flex: 1, overflowY: 'auto' }}>
          <SessionDetail
            sessionData={selectedSession}
            onSessionUpdate={handleSessionUpdate}
            fetchSessionDetails={fetchSessionById}
            onCreateSession={handleCreateSession}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
