// src/components/ExpandInterpretationModal.js
import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function ExpandInterpretationModal({ open, onClose, interpretation, templateName }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(interpretation.generated_text);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{templateName}</Typography>
        <IconButton onClick={handleCopy}>
          <ContentCopyIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <Typography variant="body1">{interpretation.generated_text}</Typography>
      </DialogContent>
    </Dialog>
  );
}

export default ExpandInterpretationModal;
