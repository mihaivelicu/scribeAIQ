// src/components/TemplateBar.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Select,
  MenuItem,
} from '@mui/material';

import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import StarIcon               from '@mui/icons-material/Star';
import EditOutlinedIcon       from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon      from '@mui/icons-material/DeleteOutline';

import axios from 'axios';
import { toggleFavorite, deleteTemplate } from '../api';
import TemplateModal from './TemplateModal';
import '../styles/Template.css';

function TemplateBar({
  sessionData,
  transcriptReady = false,      // Boolean: transcript exists right now
  interpretationsCount = 0,     // # of notes currently in DB
  writing = false,              // true while note is being generated
  onGenerateInterpretation,
}) {
  /* ---------------------------------------------------------------- */
  /*  State / refs                                                    */
  /* ---------------------------------------------------------------- */
  const [templates,          setTemplates]          = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [menuOpen,           setMenuOpen]           = useState(false);
  const [showModal,          setShowModal]          = useState(false);
  const [editingTemplate,    setEditingTemplate]    = useState(null);

  /* one-shot per session */
  const autoWroteRef               = useRef(false);
  /* remember whether the session ALREADY had a transcript on load */
  const startedWithTranscriptRef   = useRef(false);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                         */
  /* ---------------------------------------------------------------- */
  /** Sort: favourites first, then newest → oldest */
  const sortTemplates = (list) => {
    return list.slice().sort((a, b) => {
      if ((a.favorite || false) && !(b.favorite || false)) return -1;
      if (!(a.favorite || false) && (b.favorite || false)) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  };

  /** Fetch list & pre-select most-used template */
  const fetchTemplates = async () => {
    try {
      const res    = await axios.get('/api/templates');
      const sorted = sortTemplates(res.data);
      setTemplates(sorted);

      /* pick most-used only once, if nothing is chosen yet */
      if (!selectedTemplateId && sorted.length) {
        const mostUsed = sorted.reduce(
          (max, t) => (t.times_used > (max?.times_used ?? -1) ? t : max),
          null
        );
        setSelectedTemplateId(mostUsed?.template_id || '');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Event handlers                                                  */
  /* ---------------------------------------------------------------- */
  const handleWriteNote = () => {
    if (!sessionData?.transcription_text) return;
    if (!selectedTemplateId) return;
    onGenerateInterpretation?.(selectedTemplateId);
  };

  const handleTemplateChange = (e) => {
    const value = e.target.value;
    if (value === 'create') {
      setMenuOpen(false);
      setEditingTemplate(null);
      setShowModal(true);
      return;
    }
    setSelectedTemplateId(value);
  };

  const handleFavoriteClick = async (tmpl, e) => {
    e.stopPropagation();
    e.preventDefault();
    const newFav = !(tmpl.favorite || false);
    try {
      const optimistic = templates.map(t =>
        t.template_id === tmpl.template_id ? { ...t, favorite: newFav } : t
      );
      setTemplates(sortTemplates(optimistic));

      await toggleFavorite(tmpl.template_id, newFav);
      await fetchTemplates();
      setMenuOpen(true);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleEditClick = (tmpl, e) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen(false);
    setEditingTemplate(tmpl);
    setShowModal(true);
  };

  const handleDeleteClick = async (tmpl, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm(`Delete template "${tmpl.template_name}"?`)) return;
    try {
      await deleteTemplate(tmpl.template_id);
      if (selectedTemplateId === tmpl.template_id) setSelectedTemplateId('');
      await fetchTemplates();
      setMenuOpen(true);
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Effects                                                         */
  /* ---------------------------------------------------------------- */
  /* 1️⃣  initial fetch */
  useEffect(() => { fetchTemplates(); }, []);        // eslint-disable-line

  /* 2️⃣  on session change: reset flags & remember starting state */
  useEffect(() => {
    autoWroteRef.current            = false;
    startedWithTranscriptRef.current = Boolean(sessionData?.transcription_text);
  }, [sessionData?.session_id]);

  /* 3️⃣  auto-generate exactly ONE note when transcript first appears */
  useEffect(() => {
    const shouldWrite =
      !autoWroteRef.current &&                // not yet in this session
      !startedWithTranscriptRef.current &&    // session began WITHOUT transcript
      transcriptReady &&                      // transcript now present
      interpretationsCount === 0 &&           // still zero notes
      selectedTemplateId &&                   // a template is chosen
      !writing;                               // not already writing

    if (shouldWrite) {
      onGenerateInterpretation?.(selectedTemplateId);
      autoWroteRef.current = true;            // lock it
    }
  }, [
    transcriptReady,
    interpretationsCount,
    selectedTemplateId,
    writing,
    onGenerateInterpretation,
  ]);

  /* ---------------------------------------------------------------- */
  /*  Derived flags for button enable                                 */
  /* ---------------------------------------------------------------- */
  const transcriptExists = transcriptReady;
  const templateSelected = Boolean(selectedTemplateId);
  const writeNoteActive  = transcriptExists && templateSelected && !writing;

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="template-row-outer">
      <div className="template-row-inner">
        {/* Select box ------------------------------------------------ */}
        <Select
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          className="select-bar"
          displayEmpty
          open={menuOpen}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
          MenuProps={{
            anchorOrigin:    { vertical: 'bottom', horizontal: 'right' },
            transformOrigin: { vertical: 'top',    horizontal: 'right' },
          }}
          renderValue={(selected) => {
            if (!selected) return <span>Select a template</span>;
            const found = templates.find(t => t.template_id === selected);
            return found ? found.template_name : 'Select a template';
          }}
        >
          <MenuItem className="create-new-template" value="create">
            Create New Template
          </MenuItem>

          {templates.map((t) => {
            const StarComp = (t.favorite || false) ? StarIcon : StarBorderOutlinedIcon;
            return (
              <MenuItem
                key={t.template_id}
                value={t.template_id}
                sx={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  gap:            '2rem',
                }}
              >
                {/* left: star + name */}
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <StarComp
                    onClick={(e) => handleFavoriteClick(t, e)}
                    sx={{
                      cursor:'pointer',
                      color: (t.favorite || false) ? 'gold' : 'inherit',
                      transition:'color 0.2s ease-in-out',
                      fontSize:'var(--template-icon-size, 1rem)',
                      '&:hover': { color:'gold' },
                    }}
                  />
                  <span className="template-name" style={{ fontSize:'var(--template-font-size, 0.9rem)' }}>
                    {t.template_name}
                  </span>
                </div>

                {/* right: usage badge + edit + delete */}
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <span className="times-used-badge">{t.times_used}</span>
                  <EditOutlinedIcon
                    onClick={(e) => handleEditClick(t, e)}
                    sx={{
                      cursor:'pointer', mr:'0.5rem',
                      fontSize:'var(--template-icon-size, 1rem)',
                      transition:'color 0.2s ease-in-out',
                      '&:hover': { color:'blue' },
                    }}
                  />
                  <DeleteOutlineIcon
                    onClick={(e) => handleDeleteClick(t, e)}
                    sx={{
                      cursor:'pointer',
                      fontSize:'var(--template-icon-size, 1rem)',
                      transition:'color 0.2s ease-in-out',
                      '&:hover': { color:'red' },
                    }}
                  />
                </div>
              </MenuItem>
            );
          })}
        </Select>

        {/* Write note button ----------------------------------------- */}
        <Button
          variant="outlined"
          onClick={handleWriteNote}
          disabled={!writeNoteActive}
          className="write-note-btn"
        >
          {writing ? 'Writing…' : 'Write note'}
        </Button>
      </div>

      {/* Modal ------------------------------------------------------- */}
      {showModal && (
        <TemplateModal
          onClose={() => setShowModal(false)}
          editingTemplate={editingTemplate}
          onTemplateSaved={() => {
            fetchTemplates();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

export default TemplateBar;
