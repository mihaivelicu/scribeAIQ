// ─── src/components/TemplateModal.js ───────────────────────────
import React, { useEffect, useState } from 'react';
import {
  Paper, TextField, Button, Typography
} from '@mui/material';
import { createTemplate, updateTemplate } from '../api';

function TemplateModal({ onClose, onTemplateSaved, editingTemplate }) {
  const [templateName, setTemplateName] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [initial,      setInitial]      = useState({ name:'', text:'' });

  /* preload when editing */
  useEffect(() => {
    if (editingTemplate) {
      setTemplateName(editingTemplate.template_name);
      setTemplateText(editingTemplate.template_text);
      setInitial({
        name: editingTemplate.template_name,
        text: editingTemplate.template_text
      });
    } else {
      setTemplateName(''); setTemplateText('');
      setInitial({ name:'', text:'' });
    }
  }, [editingTemplate]);

  const hasChanges   = templateName!==initial.name || templateText!==initial.text;
  const isCreateMode = !editingTemplate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isCreateMode)
        await createTemplate(templateName, templateText);
      else
        await updateTemplate(editingTemplate.template_id, templateName, templateText);
      onTemplateSaved();
    } catch (err) {
      console.error(err);
      alert('Error saving template.');
    }
  };

  /* Common styling snippet for both TextFields */
  const fieldSX = {
    '& .MuiOutlinedInput-root': { borderRadius: 4 },
    '& .MuiInputLabel-root':    { fontSize: 14 },
    '& .MuiInputBase-input':    { fontSize: 14 }
  };

  return (
    <div style={{
      position:'fixed', inset:0,
      background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:10000
    }}>
      <Paper className="tpl-modal-paper" sx={{ p:'0 24px', width:'90%', maxWidth:500 }}>
        <Typography className="tpl-mod-head">
          {isCreateMode ? 'Create Template' : 'Edit Template'}
        </Typography>

        <form onSubmit={handleSubmit}>

          {/* Template Name */}
          <TextField
            label="Template Name"
            className='tpl-label'
            value={templateName}
            onChange={e=>setTemplateName(e.target.value)}
            fullWidth
            variant="outlined"
            sx={{ mt:3, ...fieldSX }}
          />

          {/* Template Text – auto-grows up to 12 rows */}
          <TextField
            label="Template Text"
            className='tpl-label'
            value={templateText}
            onChange={e=>setTemplateText(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            variant="outlined"
            sx={{ mt:3, ...fieldSX }}
          />

          {/* Buttons */}
          <div className="tpl-mod-btns" style={{ textAlign:'right' }}>
            <Button className="tpl-mod-btn" onClick={onClose} sx={{ mr:2 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              className="tpl-mod-btn tpl-save"
              disabled={!hasChanges || !templateName.trim() || !templateText.trim()}
              sx={{
                background:'#22C197',
                ':hover':{ background:'#1b9f88' }
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
