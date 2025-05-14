// src/components/SessionCard.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  Typography,
  TextField,
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
  onSessionUpdate,
  disableInteraction = false, // ← NEW
}) {
  /* -------------------------------------------------- */
  /*  Local UI state                                    */
  /* -------------------------------------------------- */
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(
    session.session_title || 'Untitled session'
  );

  const [animate, setAnimate] = useState(false);
  const prevTitleRef = useRef(session.session_title);

  useEffect(() => {
    if (!editing) setTitle(session.session_title || 'Untitled session');
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
  /*  24-hour expiry countdown                          */
  /* -------------------------------------------------- */
  const [expiresDisplay, setExpiresDisplay] = useState(null);

  useEffect(() => {
    if (!session.transcription_expires_at) {
      setExpiresDisplay(null);
      return;
    }

    const iso =
      session.transcription_expires_at.endsWith('Z')
        ? session.transcription_expires_at
        : session.transcription_expires_at + 'Z';

    const target = new Date(iso).getTime();

    const update = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setExpiresDisplay('expired');
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setExpiresDisplay(`${h}h ${m}m`);
    };

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [session.transcription_expires_at]);

  /* -------------------------------------------------- */
  /*  Save title                                        */
  /* -------------------------------------------------- */
  const saveTitle = async (raw) => {
    const newTitle = raw.trim() || 'Untitled session';
    if (newTitle === session.session_title) {
      setEditing(false);
      return;
    }

    try {
      const res = await axios.put(`/api/sessions/${session.session_id}`, {
        session_title: newTitle,
      });
      onSessionUpdate?.(res.data);
    } catch (err) {
      console.error('Error saving title:', err);
      setTitle(session.session_title);
    }
    setEditing(false);
  };

  /* -------------------------------------------------- */
  /*  Card classes                                      */
  /* -------------------------------------------------- */
  let cardClasses = 'session-card';
  if (selectionMode) cardClasses += ' selection-mode';
  if (isSelected) cardClasses += ' currently-open';
  if (hovered) cardClasses += ' hovered';

  /* -------------------------------------------------- */
  /*  Render                                            */
  /* -------------------------------------------------- */
  return (
    <Card
      variant="outlined"
      className={cardClasses}
      onClick={() => {
        if (disableInteraction) return;
        if (!selectionMode && !editing) onSelect(session);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardContent className="cardcontent-sesh">
        {/* Checkbox */}
        <div className="session-checkbox">
          <Checkbox
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCheckboxChange(session.session_id);
            }}
          />
        </div>

        {/* Inner content */}
        <div className="card-content-inner">
          <div className="sesh-container">
            {/* Row 1: expiry */}
            {expiresDisplay && (
              <Typography variant="body2" className="session-expiry">
                {expiresDisplay === 'expired'
                  ? 'Expired'
                  : `Expires in: ${expiresDisplay}`}
              </Typography>
            )}

            {/* Row 2: title or editor */}
            {editing ? (
              <TextField
                size="small"
                variant="standard"
                fullWidth
                value={title}
                disabled={disableInteraction}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => saveTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                }}
                sx={{
                  minWidth: '50px',
                  '& .MuiInputBase-input': {
                    p: 0,
                    fontSize: '16px',
                    fontWeight: 600,
                  },
                }}
              />
            ) : (
              <Typography
                variant="standard"
                className={`session-name ${animate ? 'fade-in' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (disableInteraction || selectionMode) return;
                  onSelect(session);
                  setEditing(true);
                }}
              >
                {title}
              </Typography>
            )}

            {/* Row 3: created-at */}
            <Typography variant="body2" className="session-date">
              {[
                new Date(session.created_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }),
                new Date(session.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                }),
              ].join(' • ')}
            </Typography>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionCard;
