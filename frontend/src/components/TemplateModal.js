// src/components/TemplateModal.js
import React, { useState } from 'react';
import { Paper, TextField, Button, Typography } from '@mui/material';

function TemplateModal({ onClose, onTemplateCreated }) {
  const [templateName, setTemplateName] = useState('');
  const [templateText, setTemplateText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name: templateName, template_text: templateText })
    })
      .then(res => res.json())
      .then(() => onTemplateCreated())
      .catch(err => console.error(err));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center'
    }}>
      <Paper style={{ padding: '1rem', width: '90%', maxWidth: '500px' }}>
        <Typography variant="h6" gutterBottom>Create Template</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Template Name"
            variant="outlined"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            fullWidth
            style={{ marginBottom: '1rem' }}
          />
          <TextField
            label="Template Text"
            variant="outlined"
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            fullWidth
            multiline
            rows={4}
            style={{ marginBottom: '1rem' }}
          />
          <div style={{ textAlign: 'right' }}>
            <Button onClick={onClose} style={{ marginRight: '1rem' }}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">Save Template</Button>
          </div>
        </form>
      </Paper>
    </div>
  );
}

export default TemplateModal;
