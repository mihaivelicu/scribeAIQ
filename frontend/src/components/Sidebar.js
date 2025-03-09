// src/components/Sidebar.js
import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import '../styles/Sidebar.css';
import axios from 'axios';
import { deleteSession } from '../api';

function Sidebar({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onSessionsChange,
  fetchAllSessions
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // If no sessions are selected, exit selection mode automatically
  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectionMode(false);
    }
  }, [selectedIds]);

  // CREATE SESSION
  const handleCreateSession = async () => {
    try {
      // 1) create
      const response = await axios.post('/api/sessions', {
        session_title: 'Untitled session'
      });
      const newSession = response.data;

      // 2) re-fetch
      const updatedList = await fetchAllSessions();

      // 3) find newly created in updated list
      const found = updatedList.find(s => s.session_id === newSession.session_id);

      // 4) select it => triggers "handleSessionSelect(found)" in App.js
      onSessionSelect(found || newSession);
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  // Toggles the checkbox for a single session
  const handleCheckboxChange = (sessionId) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([sessionId]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(sessionId)
          ? prev.filter((id) => id !== sessionId)
          : [...prev, sessionId]
      );
    }
  };

  // "Select All" or "Unselect All" in one function
  const handleSelectAllToggle = () => {
    if (selectedIds.length === sessions.length) {
      // Already all selected -> unselect all
      setSelectedIds([]);
    } else {
      // Not all selected -> select all
      const allIds = sessions.map((s) => s.session_id);
      setSelectedIds(allIds);
    }
  };

  // DELETE SELECTED
  const handleDeleteSelected = async () => {
    try {
      for (const id of selectedIds) {
        await deleteSession(id);
      }
      setSelectionMode(false);
      setSelectedIds([]);

      // re-fetch the list so the sidebar is up-to-date
      await fetchAllSessions();

      // If you want to unselect the detail if the open session was deleted,
      // you can do that here.
    } catch (err) {
      console.error('Error deleting sessions:', err);
    }
  };

  // Determine the button label based on whether all sessions are selected
  const allSelected = selectedIds.length === sessions.length && sessions.length > 0;
  const selectAllButtonLabel = allSelected ? "Unselect All" : "Select All";

  return (
    <div className="sidebar">
      <Button
        className="create-session-btn"
        variant="contained"
        color="primgreen"
        onClick={handleCreateSession}
      >
        <span className="create-button-text">
        Create Session
        </span>
      </Button>

      <div className={`selection-toolbar ${selectionMode ? '' : 'hidden'}`}>
        <Button className='select-button' variant="outlined" onClick={handleSelectAllToggle}>
          {selectAllButtonLabel}
        </Button>
        <IconButton color="seconred" onClick={handleDeleteSelected}>
          <DeleteIcon />
        </IconButton>
      </div>

      <div className="session-list">
        {sessions.map((s) => {
          const isCurrentlyOpen = s.session_id === selectedSessionId;

          return (
            <Card
              key={s.session_id}
              className={`session-card ${selectionMode ? 'selection-mode' : ''} ${
                isCurrentlyOpen ? 'currently-open' : ''
              }`}
              onClick={() => {
                if (!selectionMode) {
                  onSessionSelect(s);
                }
              }}
              onMouseEnter={(e) => e.currentTarget.classList.add('hovered')}
              onMouseLeave={(e) => e.currentTarget.classList.remove('hovered')}
            >
              <CardContent className="cardcontent-sesh">
                <div className="session-checkbox">
                  <Checkbox
                    checked={selectedIds.includes(s.session_id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleCheckboxChange(s.session_id);
                    }}
                  />
                </div>
                <div className="card-content-inner">
                  <div className="sesh-container">
                    <span className="session-name">
                      {s.session_title || `Session #${s.session_id}`}
                    </span>
                    <span className="session-date">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default Sidebar;
