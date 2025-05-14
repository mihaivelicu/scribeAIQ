import React, { useState, useEffect } from 'react';
import {
  Box, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, Typography
} from '@mui/material';
import ThumbUpAltOutlinedIcon  from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import CloseIcon from '@mui/icons-material/Close';
import '../styles/Feedback.css';

function FeedbackPrompt({ interpretationId, onSubmit }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [thumb, setThumb]           = useState(null);   // 'up' | 'down'
  const [text,  setText]            = useState('');

  /* 👉 NEW: track if the user dismissed the pill */
  const [dismissed, setDismissed]   = useState(false);

   // whenever we show a different interpretation, bring the pill back
 useEffect(() => {
   setDismissed(false);
   setThumb(null);
   setText('');
 }, [interpretationId]);

  /* stop rendering once it’s dismissed */
  if (dismissed) return null;

  /* ------------------------------------------------ handlers */
  const handleThumbClick = (dir) => {
    setThumb(dir);
    setOpenDialog(true);
  };

  const handleSend = () => {
    onSubmit?.({ interpretationId, thumb, text });
    setOpenDialog(false);
    setText('');
  };

  /* ------------------------------------------------ render */
  return (
    <>
      {/* pill */}
      <Box className="fb-prompt">
        <Typography sx={{ mr: 1, fontSize: '0.9rem' }}>
          Was this output useful?
        </Typography>

        <IconButton size="small" onClick={() => handleThumbClick('up')}>
          <ThumbUpAltOutlinedIcon
            fontSize="small"
            sx={{ color: thumb === 'up' ? '#22C197' : 'inherit' }}
          />
        </IconButton>

        <IconButton size="small" onClick={() => handleThumbClick('down')}>
          <ThumbDownAltOutlinedIcon
            fontSize="small"
            sx={{ color: thumb === 'down' ? '#fe6167' : 'inherit' }}
          />
        </IconButton>

        {/* 👇 THIS was the missing bit */}
        <IconButton
          size="small"
          onClick={() => setDismissed(true)}  
          sx={{ ml: 0.5 }}
        >
          <CloseIcon className="x-icon" />
        </IconButton>
      </Box>

      {/* dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        className="feedback-modal"
      >
        <DialogTitle className="title-feedback">
          We value your feedback
        </DialogTitle>

        <DialogContent className="submsgfeedback">
          <Typography variant="body2" sx={{ mb: 1 }}>
            {thumb === 'up'
              ? 'Great! What made this answer helpful?'
              : 'Sorry to hear that. How could we improve?'}
          </Typography>

          <TextField
            fullWidth
            className="feedback-text"
            multiline
            minRows={4}
            placeholder="Type your feedback here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setOpenDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            className="send-feedback-btn"
            onClick={handleSend}
            disabled={!text.trim()}
          >
            Send Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default FeedbackPrompt;
