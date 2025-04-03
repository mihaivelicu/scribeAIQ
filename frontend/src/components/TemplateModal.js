// src/components/TemplateModal.js
import React, { useEffect, useState } from 'react';
import { Paper, TextField, Button, Typography } from '@mui/material';
import { createTemplate, updateTemplate } from '../api';

function TemplateModal({ onClose, onTemplateSaved, editingTemplate }) {
  const [templateName, setTemplateName] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [initial, setInitial] = useState({ name: '', text: '' });

  useEffect(() => {
    if (editingTemplate) {
      setTemplateName(editingTemplate.template_name);
      setTemplateText(editingTemplate.template_text);
      setInitial({
        name: editingTemplate.template_name,
        text: editingTemplate.template_text,
      });
    } else {
      setTemplateName('');
      setTemplateText('');
      setInitial({ name: '', text: '' });
    }
  }, [editingTemplate]);

  const hasChanges =
    templateName !== initial.name ||
    templateText !== initial.text;

  const isCreateMode = !editingTemplate; // true if creating

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isCreateMode) {
        await createTemplate(templateName, templateText);
      } else {
        await updateTemplate(editingTemplate.template_id, templateName, templateText);
      }
      onTemplateSaved();  // refresh parent, close modal, etc.
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Error saving template. Check console for details.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000  // ensure this modal is on top
    }}>
      <Paper style={{ padding: '1rem', width: '90%', maxWidth: '500px' }}>
        <Typography variant="h6" gutterBottom>
          {isCreateMode ? 'Create Template' : 'Edit Template'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Template Name"
            variant="outlined"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            fullWidth
            style={{ marginBottom: '1rem' }}
          />
          <TextField
            label="Template Text"
            variant="outlined"
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            fullWidth
            multiline
            rows={4}
            style={{ marginBottom: '1rem' }}
          />

          <div style={{ textAlign: 'right' }}>
            <Button onClick={onClose} style={{ marginRight: '1rem' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!hasChanges || !templateName.trim() || !templateText.trim()}
              sx={{
                backgroundColor: '#22C197',
                color: 'white',
                ':hover': {
                  backgroundColor: '#1b9f88'
                }
              }}
            >
              Save Template
            </Button>
          </div>
        </form>
      </Paper>
    </div>
  );
}

export default TemplateModal;
