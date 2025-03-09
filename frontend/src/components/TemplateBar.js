// src/components/TemplateBar.js
import React, { useState, useEffect } from 'react';
import { Button, Select, MenuItem } from '@mui/material';
import axios from 'axios';
import '../styles/Template.css';

function TemplateBar({ sessionData, onGenerateInterpretation, onOpenTemplateModal }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // On mount, fetch the templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await axios.get('/api/templates');
        setTemplates(res.data);
      } catch (err) {
        console.error("Error fetching templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  const handleGenerate = () => {
    if (!sessionData.transcription_text) {
      alert("No transcription available yet.");
      return;
    }
    if (!selectedTemplateId) {
      alert("Please select a template first.");
      return;
    }
    onGenerateInterpretation && onGenerateInterpretation(selectedTemplateId);
  };

  return (
    <div className="template-container">
      <div className="bar-row">
        <div className="template-bar">
          <Select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="select-bar"
            displayEmpty
          >
            <MenuItem value="">-- Select Template --</MenuItem>
            {templates.map((t) => (
              <MenuItem key={t.template_id} value={t.template_id}>
                {t.template_name}
              </MenuItem>
            ))}
          </Select>
        </div>
        <div className="create-button-container">
          <Button
            variant="outlined"
            color="primgreen"
            onClick={onOpenTemplateModal}
            style={{ whiteSpace: 'nowrap' }}  // Prevent text wrapping
          >
            <span className="label-c">Create Template</span>
          </Button>
        </div>
      </div>

      <div className="gen-button-container">
        <Button
          variant="contained"
          color="primgreen"
          onClick={handleGenerate}
          disabled={!sessionData.transcription_text || !selectedTemplateId}
        >
          <span className="label">Generate Note</span>
        </Button>
      </div>
    </div>
  );
}

export default TemplateBar;
