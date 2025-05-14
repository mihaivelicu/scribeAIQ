import React, { useState, useEffect, useRef } from 'react';
import {
  Card, CardContent, Checkbox, Typography, TextField
} from '@mui/material';
import axios from 'axios';
import '../styles/Sidebar.css';

function SessionCard({
  session,
  isSelected,
  selectionMode,
  isChecked,
  onSelect,
  onCheckboxChange,
  onSessionUpdate           // <--- NEW
}) {
  /* -------------------- UI state -------------------- */
  const [hovered, setHovered]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [title,   setTitle]       = useState(session.session_title || 'Untitled session');

 

  /* --- fade-in animation when “Untitled session” gets renamed --- */
  const [animate, setAnimate] = useState(false);
  const prevTitleRef = useRef(session.session_title);
   // Sync local title state whenever the parent passes in a new session_title
  useEffect(() => {
    if (!editing) {
      setTitle(session.session_title || 'Untitled session');
    }
  }, [session.session_title, editing]);

  useEffect(() => {
    if (
      prevTitleRef.current.trim().toLowerCase() === 'untitled session' &&
      session.session_title.trim().toLowerCase() !== 'untitled session'
    ) {
      setAnimate(true);
      const id = setTimeout(() => setAnimate(false), 500);
      return () => clearTimeout(id);
    }
    prevTitleRef.current = session.session_title;
  }, [session.session_title]);




  /* -------------------------------------------------- */
  /*  SAVE to server on blur / Enter                    */
  /* -------------------------------------------------- */
  const saveTitle = async (raw) => {
    const newTitle = raw.trim() || 'Untitled session';
    if (newTitle === session.session_title) { setEditing(false); return; }

    try {
      const res = await axios.put(`/api/sessions/${session.session_id}`, {
        session_title: newTitle
      });
      const updated = res.data;           // backend returns full row

      // pass up to parent so sidebar + detail sync
      onSessionUpdate?.(updated);

    } catch (err) {
      console.error('Error saving title:', err);
      // re-insert the old title so user can try again
      setTitle(session.session_title);
    }
    setEditing(false);
  };

  /* Build CSS class list exactly as before */
  let cardClasses = 'session-card';
  if (selectionMode) cardClasses += ' selection-mode';
  if (isSelected)    cardClasses += ' currently-open';
  if (hovered)       cardClasses += ' hovered';

  return (
    <Card
      variant="outlined"
      className={cardClasses}
      onClick={() => { if (!selectionMode && !editing) onSelect(session); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardContent className="cardcontent-sesh">
        {/* Checkbox (unchanged) */}
        <div className="session-checkbox">
          <Checkbox
            checked={isChecked}
            onChange={(e) => { e.stopPropagation(); onCheckboxChange(session.session_id); }}
          />
        </div>

        {/* Title + Date block */}
        <div className="card-content-inner">
          <div className="sesh-container">

            {/* ---------- TITLE / EDIT FIELD ---------- */}
            {editing ? (
              <TextField
                size="small"
                variant="standard" 
                fullWidth
                value={title}
                autoFocus
                onChange={e => setTitle(e.target.value)}
                onBlur={e => saveTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                sx={{
                  minWidth: '50px',
                  '& .MuiInputBase-input': { p: 0, fontSize: '16px', fontWeight: 600 },
                }}
              />
            ) : (
              <Typography
                variant="standard"
                className={`session-name ${animate ? 'fade-in' : ''}`} 
                onClick={e => {                      // start editing
                  e.stopPropagation();
                  if (!selectionMode) setEditing(true);
                }}
              >
                {title}
              </Typography>
            )}

            {/* ---------- DATE ---------- */}
            <Typography variant="body2" className="session-date">
              {[
                new Date(session.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12:false }),
                new Date(session.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit' })
              ].join(' • ')}
            </Typography>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionCard;
