// src/components/SessionTitle.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TextField } from '@mui/material';

function SessionTitle({ sessionData, onSessionUpdate, fetchSessionDetails }) {
  // Initialize local title
  const [title, setTitle] = useState(sessionData.session_title || "Untitled session");

  // Update local title when sessionData changes
  useEffect(() => {
    setTitle(sessionData.session_title || "Untitled session");
  }, [sessionData]);

  // Letter-by-letter sync
  const handleTitleChange = (e) => {
    const newVal = e.target.value;
    setTitle(newVal);

    // Immediately notify parent so the sidebar sees the updated title
    if (onSessionUpdate) {
      onSessionUpdate({ ...sessionData, session_title: newVal });
    }
  };

  // On blur, finalize the title in the DB and merge the updated title with the existing sessionData
  const handleTitleBlur = async () => {
    let newTitle = title.trim();
    if (!newTitle) {
      newTitle = "Untitled session";
      setTitle(newTitle);
    }
    try {
      // Update the title on the server
      const res = await axios.put(`/api/sessions/${sessionData.session_id}`, {
        session_title: newTitle
      });
      const updated = res.data;
      // Merge the returned updated title with the existing sessionData to preserve other fields
      const mergedSession = { ...sessionData, session_title: updated.session_title };
      setTitle(mergedSession.session_title);

      // Notify parent (and thus the sidebar) of the final change
      if (onSessionUpdate) {
        onSessionUpdate(mergedSession);
      }
      // Optionally re-fetch full session details if needed
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
          style: {
            fontFamily: 'Lora, serif',
            fontSize: '1.3rem',
            textAlign: 'center'
          }
        }}
      />
    </div>
  );
}

export default SessionTitle;
