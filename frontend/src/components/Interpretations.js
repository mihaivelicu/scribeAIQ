// ─── src/components/Interpretations.js ─────────────────────────
import React, { useState } from 'react';
import {
  Tabs, Tab, Box, Card, CardContent,
  Typography, Button, Fade
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import '../styles/Interpretations.css';
import FeedbackPrompt from './FeedbackPrompt';

function Interpretations({ interpretations, templates = [] }) {
  const [selectedTab,  setSelectedTab]  = useState(0);
  const [copied, setCopied] = useState(false);

  /* sort newest → oldest */
  const sortedInterps = interpretations.slice().sort(
    (a,b) => new Date(b.created_at) - new Date(a.created_at)
  );

  /* helper */
  const getTemplateName = (id) =>
    templates.find(t => t.template_id === id)?.template_name || 'Template Name';

  /* tab change */
  const handleTabChange = (_, val) => setSelectedTab(val);

  /* copy to clipboard */
  const handleCopy = () => {
    const text = sortedInterps[selectedTab]?.generated_text || '';
    navigator.clipboard.writeText(text)
      .then(()=>{
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err)=>console.error(err));
  };

  return (
    <Box className="interpretations-container">
      {/* ---- PILLED TABS ---- */}
      <Tabs
        value={selectedTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        className='pill-tabs'
        TabIndicatorProps={{ sx:{ display:'none' } }}    /* hide blue bar */
      >
        {sortedInterps.map((interp, idx) => (
          <Tab
            key={interp.interpretation_id}
            label={getTemplateName(interp.template_id)}
            className="pill-tab"
          />
        ))}
      </Tabs>

      {/* ---- SELECTED INTERPRETATION ---- */}
      {sortedInterps.length > 0 && (
        /* The Fragment keeps the Card and the prompt one-after-another
          in normal document flow.                                   */
        <>
          <Card className="interpretation-card">
            <CardContent className="interpretation-content">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {/* ↖ the green badge */}
                {copied && (
                  <Fade in={copied} timeout={{ enter: 300, exit: 900 }}>
                    <Box
                      sx={{
                        bgcolor: 'success.main',
                        color: 'common.white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem'
                      }}
                    >
                      Copied to clipboard
                    </Box>
                  </Fade>
                )}

                <Button
                  onClick={handleCopy}
                  startIcon={<ContentCopyIcon sx={{ fontSize: '14px' }} />}
                  className="interpretation-copy-button"
                >
                  Copy
                </Button>
              </Box>

              <Typography
                className="interp-text"
                variant="body2"
                sx={{ whiteSpace: 'pre-line', mt: 1 }}
              >
                {sortedInterps[selectedTab].generated_text}
              </Typography>
            </CardContent>
          </Card>

          {/* ➜ prompt now sits right underneath the card */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <FeedbackPrompt
              interpretationId={sortedInterps[selectedTab].interpretation_id}
            />
          </Box>
        </>
      )}
    </Box>
  );
}

export default Interpretations;
