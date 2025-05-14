// src/components/Sidebar.js
import React, { useState, useEffect } from 'react';
import {
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import axios from 'axios';

import '../styles/Sidebar.css';
import { deleteSession } from '../api';
import SessionCard from './SessionCard';
import AudioRecorder from './AudioRecorder';

function Sidebar({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onSessionsChange,       // reserved
  fetchAllSessions,
  onSessionUpdate,
  selectedSession,
  fetchSessionDetails,
  onCreateSession,
  isRecording,            // ← NEW
  onRecordingChange,      // ← NEW
}) {
  /* ------------------------------------------------------------ */
  /*  Local state                                                 */
  /* ------------------------------------------------------------ */
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ------------------------------------------------------------ */
  /*  Recorder replacement logic                                  */
  /* ------------------------------------------------------------ */
  const showRecorder =
    selectedSession &&
    !selectedSession.audio_file_path &&
    !selectedSession.transcription_text;

  const refreshList = async () => await fetchAllSessions();

  /* auto-exit selection mode */
  useEffect(() => {
    if (selectedIds.length === 0) setSelectionMode(false);
  }, [selectedIds]);

  /* ------------------------------------------------------------ */
  /*  Create-session handler                                      */
  /* ------------------------------------------------------------ */
  const handleCreateSession = async () => {
    if (isRecording) return; // LOCK
    try {
      const res = await axios.post('/api/sessions', {
        session_title: 'Untitled session',
      });
      const list = await refreshList();
      const found = list.find((s) => s.session_id === res.data.session_id);
      onSessionSelect(found || res.data);
    } catch (err) {
      console.error(err);
    }
  };

  /* ------------------------------------------------------------ */
  /*  Checkbox toggle                                             */
  /* ------------------------------------------------------------ */
  const handleCheckboxChange = (sid) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([sid]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
      );
    }
  };

  /* ------------------------------------------------------------ */
  /*  Select-all toggle                                           */
  /* ------------------------------------------------------------ */
  const allSelected =
    selectedIds.length === sessions.length && sessions.length > 0;
  const selectAllButtonLabel = allSelected ? 'Unselect All' : 'Select All';
  const handleSelectAllToggle = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(sessions.map((s) => s.session_id));
  };

  /* ------------------------------------------------------------ */
  /*  Delete confirmation                                         */
  /* ------------------------------------------------------------ */
  const handleConfirmDelete = async () => {
    try {
      for (const id of selectedIds) await deleteSession(id);
      setSelectedIds([]);
      await refreshList();
      setConfirmOpen(false);
    } catch (err) {
      console.error('Error deleting sessions:', err);
    }
  };

  /* ------------------------------------------------------------ */
  /*  Session select (blocked while recording)                    */
  /* ------------------------------------------------------------ */
  const handleSessionSelect = (s) => {
    if (isRecording) return;
    onSessionSelect(s);
  };

  /* ------------------------------------------------------------ */
  /*  Render                                                      */
  /* ------------------------------------------------------------ */
  return (
    <div className="sidebar">
      {/* ─── SELECTION TOOLBAR ─── */}
      <div className={`selection-toolbar ${selectionMode ? '' : 'hidden'}`}>
        <Button
          variant="text"
          className="select-button"
          onClick={handleSelectAllToggle}
        >
          {selectAllButtonLabel}
        </Button>
        <IconButton className="trash" onClick={() => setConfirmOpen(true)}>
          <DeleteIcon />
        </IconButton>
      </div>

      {/* ─── SCROLLABLE LIST ─── */}
      <div className="session-list">
        {sessions.map((s) => (
          <SessionCard
            key={s.session_id}
            session={s}
            isSelected={s.session_id === selectedSessionId}
            selectionMode={selectionMode}
            isChecked={selectedIds.includes(s.session_id)}
            onSelect={handleSessionSelect}
            onCheckboxChange={handleCheckboxChange}
            onSessionUpdate={onSessionUpdate}
            disableInteraction={isRecording}
          />
        ))}
      </div>

      {/* ─── BOTTOM BAR ─── */}
      <div className="top-action-wrapper">
        {showRecorder ? (
          <AudioRecorder
            sessionData={selectedSession}
            fetchSessionDetails={fetchSessionDetails}
            onRecordingChange={onRecordingChange}
          />
        ) : (
          <div className="create-btn-wrapper">
            <Button
              className="create-session-btn"
              variant="contained"
              sx={{ textTransform: 'none' }}
              onClick={handleCreateSession}
              disabled={isRecording}
            >
              <span className="create-button-text">Create session</span>
            </Button>
          </div>
        )}
      </div>

      {/* ─── CONFIRM DELETE ─── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          Are you sure you want to delete?
        </DialogTitle>
        <DialogContent>
          {selectedIds.length} session
          {selectedIds.length !== 1 && 's'} will be removed permanently.
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)}>
            No, cancel
          </Button>
          <Button variant="contained" onClick={handleConfirmDelete}>
            Yes, delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Sidebar;
