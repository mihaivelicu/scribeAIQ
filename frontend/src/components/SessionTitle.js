// src/components/SessionTitle.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TextField, InputAdornment, Button } from '@mui/material';
import '../styles/Title.css';

function SessionTitle({ sessionData, onSessionUpdate, fetchSessionDetails, onShowTranscript }) {
  const [title, setTitle] = useState(sessionData.session_title || "Untitled session");

  // Update local title state if sessionData changes
  useEffect(() => {
    setTitle(sessionData.session_title || "Untitled session");
  }, [sessionData]);

  const handleTitleChange = (e) => {
    const newVal = e.target.value;
    setTitle(newVal);
    if (onSessionUpdate) {
      onSessionUpdate({ ...sessionData, session_title: newVal });
    }
  };

  const handleTitleBlur = async () => {
    let newTitle = title.trim();
    if (!newTitle) {
      newTitle = "Untitled session";
      setTitle(newTitle);
    }
    try {
      const res = await axios.put(`/api/sessions/${sessionData.session_id}`, {
        session_title: newTitle
      });
      const updated = res.data;
      const mergedSession = { ...sessionData, session_title: updated.session_title };
      setTitle(mergedSession.session_title);
      if (onSessionUpdate) {
        onSessionUpdate(mergedSession);
      }
      if (fetchSessionDetails) {
        fetchSessionDetails(mergedSession.session_id);
      }
    } catch (err) {
      console.error("Error saving session title:", err);
    }
  };

  return (
    <div className="session-title-container">
      <TextField
        label="Session Title"
        variant="outlined"
        value={title}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
        }}
        fullWidth
        InputProps={{
          // Only show the SEE TRANSCRIPT button if transcription text exists
          endAdornment: (sessionData && sessionData.transcription_text) ? (
            <InputAdornment position="end">
              <Button 
                variant="text" 
                onClick={onShowTranscript}
                className="show-transcription-button"
                style={{ padding: 0, minWidth: 'auto' }}
              >
                SEE TRANSCRIPT
              </Button>
            </InputAdornment>
          ) : null,
        }}
      />
    </div>
  );
}

export default SessionTitle;
