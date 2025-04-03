// src/components/SessionCard.js
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, Checkbox } from '@mui/material';
import '../styles/Sidebar.css';

function SessionCard({
  session,
  isSelected,
  selectionMode,
  isChecked,
  onSelect,
  onCheckboxChange
}) {
  // State to track whether the card is hovered (for visual effect)
  const [hovered, setHovered] = useState(false);

  // State to trigger a fade-in animation when the title updates from default
  const [animate, setAnimate] = useState(false);
  // Ref to store the previous title for comparison
  const prevTitleRef = useRef(session.session_title);

  useEffect(() => {
    // If the previous title was the default ("Untitled session")
    // and now it's changed, then trigger the animation.
    if (
      prevTitleRef.current.trim().toLowerCase() === "untitled session" &&
      session.session_title.trim().toLowerCase() !== "untitled session"
    ) {
      setAnimate(true);
      // Remove the animation after 500ms (duration of animation)
      const timeoutId = setTimeout(() => setAnimate(false), 500);
      return () => clearTimeout(timeoutId);
    }
    // Update the previous title reference
    prevTitleRef.current = session.session_title;
  }, [session.session_title]);

  // Build the CSS classes for the Card component.
  let cardClasses = `session-card`;
  if (selectionMode) cardClasses += ' selection-mode';
  if (isSelected) cardClasses += ' currently-open';
  if (hovered) cardClasses += ' hovered';

  return (
    <Card
      className={cardClasses}
      // Only select the session when not in selection mode.
      onClick={() => {
        if (!selectionMode) {
          onSelect(session);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardContent className="cardcontent-sesh">
        <div className="session-checkbox">
          <Checkbox
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCheckboxChange(session.session_id);
            }}
          />
        </div>
        <div className="card-content-inner">
          <div className="sesh-container">
            <span className={`session-name ${animate ? 'fade-in' : ''}`}>
              {session.session_title || `Session #${session.session_id}`}
            </span>
            <span className="session-date">
              {new Date(session.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionCard;
