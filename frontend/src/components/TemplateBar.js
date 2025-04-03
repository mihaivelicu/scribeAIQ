// src/components/TemplateBar.js
import React, { useState, useEffect } from 'react';
import {
  Button,
  Select,
  MenuItem,
} from '@mui/material';

import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import StarIcon from '@mui/icons-material/Star';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import axios from 'axios';
import { toggleFavorite, deleteTemplate } from '../api';
import TemplateModal from './TemplateModal';
import '../styles/Template.css';

function TemplateBar({ sessionData, onGenerateInterpretation }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/templates');
      const sorted = sortTemplates(res.data);
      setTemplates(sorted);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  // Sort favorites at the top then by created_at descending.
  const sortTemplates = (list) => {
    return list.slice().sort((a, b) => {
      // Use a default of false if t.favorite is undefined.
      if ((a.favorite || false) && !(b.favorite || false)) return -1;
      if (!(a.favorite || false) && (b.favorite || false)) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  };

  const handleWriteNote = () => {
    if (!sessionData.transcription_text) {
      alert("No transcription available yet.");
      return;
    }
    if (!selectedTemplateId) {
      return;
    }
    onGenerateInterpretation && onGenerateInterpretation(selectedTemplateId);
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

  // Updated favorite handler: use an optimistic update then re-fetch.
  const handleFavoriteClick = async (tmpl, e) => {
    e.stopPropagation();
    e.preventDefault();
    const newFav = !(tmpl.favorite || false);
    try {
      // Optimistically update the local state.
      const updatedTemplates = templates.map(t =>
        t.template_id === tmpl.template_id ? { ...t, favorite: newFav } : t
      );
      setTemplates(sortTemplates(updatedTemplates));

      // Update the backend.
      await toggleFavorite(tmpl.template_id, newFav);

      // Re-fetch to ensure we have the latest data.
      const res = await axios.get('/api/templates');
      setTemplates(sortTemplates(res.data));
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
      if (selectedTemplateId === tmpl.template_id) {
        setSelectedTemplateId('');
      }
      const res = await axios.get('/api/templates');
      setTemplates(sortTemplates(res.data));
      setMenuOpen(true);
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  // Determine WRITE NOTE button status.
  const transcriptExists = Boolean(sessionData?.transcription_text);
  const templateSelected = Boolean(selectedTemplateId);
  
  let buttonBg;
  let buttonHoverBg = undefined;
  
  if (!transcriptExists) {
    buttonBg = "#ccc"; // Inactive gray.
  } else if (transcriptExists && !templateSelected) {
    buttonBg = "#ccc"; // Still inactive gray.
  } else if (transcriptExists && templateSelected) {
    buttonBg = "#22C197"; // Active primary green.
    buttonHoverBg = 'hsl(164, 100%, 44%)'; // More saturated on hover.
  }
  
  const isActive = transcriptExists && templateSelected;

  return (
    <div className="template-row-outer">
      <div className="template-row-inner">
        <Select
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          className="select-bar"
          displayEmpty
          open={menuOpen}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
          renderValue={(selected) => {
            if (!selected) {
              return <span style={{ color: '#aaa' }}>Select a note template</span>;
            }
            const found = templates.find((t) => t.template_id === selected);
            return found ? found.template_name : 'Select a note template';
          }}
        >
          <MenuItem
            value="create"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontStyle: 'italic',
              borderBottom: '1px solid #ccc',
              backgroundColor: '#f5f5f5',
              fontWeight: 'bold',
            }}
          >
            <AddOutlinedIcon fontSize="small" />
            Create New Template
          </MenuItem>

          {templates.map((t) => {
            const StarComp = (t.favorite || false) ? StarIcon : StarBorderOutlinedIcon;
            return (
              <MenuItem
                key={t.template_id}
                value={t.template_id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative'
                }}
              >
                {/* Left container: star icon and template name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <StarComp
                    onClick={(e) => handleFavoriteClick(t, e)}
                    style={{
                      cursor: 'pointer',
                      color: (t.favorite || false) ? 'gold' : 'inherit',
                      transition: 'color 0.2s ease-in-out',
                      fontSize: 'var(--template-icon-size, 1rem)'
                    }}
                    onMouseEnter={(e) => {
                      if (!(t.favorite || false)) e.currentTarget.style.color = 'gold';
                    }}
                    onMouseLeave={(e) => {
                      if (!(t.favorite || false)) e.currentTarget.style.color = '';
                    }}
                  />
                  <span className="template-name" style={{ fontSize: 'var(--template-font-size, 0.9rem)' }}>
                    {t.template_name}
                  </span>
                </div>

                {/* Right container: times used badge, then edit and delete icons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span className="times-used-badge">
                    {t.times_used}
                  </span>
                  <EditOutlinedIcon
                    onClick={(e) => handleEditClick(t, e)}
                    sx={{
                      cursor: 'pointer',
                      marginRight: '0.5rem',
                      color: 'inherit',
                      transition: 'color 0.2s ease-in-out',
                      fontSize: 'var(--template-icon-size, 1rem)',
                      ':hover': { color: 'blue' },
                    }}
                  />
                  <DeleteOutlineIcon
                    onClick={(e) => handleDeleteClick(t, e)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'color 0.2s ease-in-out',
                      fontSize: 'var(--template-icon-size, 1rem)',
                      ':hover': { color: 'red' },
                    }}
                  />
                </div>
              </MenuItem>
            );
          })}
        </Select>

        <Button
          variant="contained"
          onClick={handleWriteNote}
          disabled={!isActive}
          sx={{
            backgroundColor: buttonBg + ' !important',
            color: '#fff',
            fontSize: '0.8rem',
            height: '2rem',
            marginLeft: '0.5rem',
            fontWeight: 'bold',
            '&:hover': isActive && buttonHoverBg ? { backgroundColor: buttonHoverBg + ' !important' } : {},
            '&.Mui-disabled': {
              backgroundColor: buttonBg + ' !important',
              opacity: 1,
              color: '#fff',
            },
          }}
        >
          WRITE NOTE
        </Button>
      </div>

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
