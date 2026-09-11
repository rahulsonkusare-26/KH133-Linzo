import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import Meeting from '../models/Meeting.js';
import * as chrono from 'chrono-node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const router = Router();

// Create a new meeting
router.post('/create', requireAuth, async (req, res) => {
  try {
    const roomId = uuidv4();
    const meeting = new Meeting({
      roomId,
      host: req.user._id,
      participants: [req.user.username || 'Host'],
      startTime: new Date()
    });
    await meeting.save();
    res.json({ roomId });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

import jwt from 'jsonwebtoken';

// Join a meeting (creates if not exists)
router.post('/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    let { username } = req.body;

    // Try to get authenticated user from token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
        if (decoded.name || decoded.username) {
          username = decoded.name || decoded.username;
        }
      } catch (err) {
        console.log('Token verification failed in join route, using provided username');
      }
    }

    // Atomically find or create the meeting and add the participant
    // Using findOneAndUpdate with upsert: true handles the race condition where multiple users join at once
    const update = {
      $setOnInsert: { roomId, startTime: new Date(), status: 'active' }
    };
    
    if (username) {
      update.$addToSet = { participants: username };
    }

    let meeting;
    try {
      meeting = await Meeting.findOneAndUpdate(
        { roomId, status: 'active' },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      // Handle race condition: E11000 duplicate key error
      if (error.code === 11000) {
        console.log(`[Join] Collision detected for room ${roomId}, recovering...`);
        // The meeting exists now (either created by another thread or an old one ended)
        // We find it and ensure it's active and the participant is added
        meeting = await Meeting.findOneAndUpdate(
          { roomId },
          { 
            $set: { status: 'active' },
            ...(username ? { $addToSet: { participants: username } } : {})
          },
          { new: true, setDefaultsOnInsert: true }
        );
      } else {
        throw error;
      }
    }

    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error joining/creating meeting:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit transcript segment
router.post('/:roomId/transcript', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { speaker, text } = req.body;

    if (!text || !text.trim()) return res.json({ success: true });

    const meeting = await Meeting.findOne({ roomId, status: 'active' });
    if (meeting) {
      meeting.transcript.push({
        speaker: speaker || 'Unknown',
        text: text,
        timestamp: new Date()
      });
      // Also ensure speaker is in participants list
      if (speaker && !meeting.participants.includes(speaker)) {
        meeting.participants.push(speaker);
      }
      await meeting.save();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// End meeting and generate summary
router.post('/:roomId/end', async (req, res) => {
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOne({ roomId });

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Save initial ended status
    meeting.status = 'ended';
    meeting.endTime = new Date();
    meeting.summary = "Generating AI summary... (This may take a few seconds)";
    await meeting.save();

    // Respond immediately to unblock UI
    res.json({ success: true, message: 'Meeting ended, generating summary in background...' });

    // Notify participants (optional - can also be done after summary)
    if (req.io) {
      req.io.to(roomId).emit('meeting-ended');
    }

    // Fire-and-forget: Generate Summary (AI) in background
    (async () => {
      try {
        console.log(`[Background] Starting AI Summary for ${roomId}...`);
        const transcriptText = meeting.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
        const summary = await generateAISummary(meeting.transcript, meeting.participants);

        // Extract date from summary
        let proposedDate = undefined;
        try {
          const parsedDate = chrono.parseDate(summary);
          if (parsedDate) {
            // Check if date is in the future (optional, but good practice)
            if (parsedDate > new Date()) {
              proposedDate = parsedDate.toISOString();
              console.log(`[Background] Extracted date from summary: ${proposedDate}`);
            }
          }
        } catch (dateErr) {
          console.error('Failed to parse date from summary:', dateErr);
        }

        // Re-fetch to ensure we have latest version if needed, or just update
        const updateData = { summary };
        if (proposedDate) updateData.proposedDate = proposedDate;

        await Meeting.updateOne({ _id: meeting._id }, updateData);
        console.log(`[Background] Summary generated and saved for ${roomId}`);
      } catch (err) {
        console.error(`[Background] Failed to generate summary for ${roomId}:`, err);
        try {
          // Ensure field is not left in stuck state
          await Meeting.updateOne({ _id: meeting._id }, {
            summary: "Summary generation failed or timed out. Please check transcript."
          });
        } catch (dbErr) {
          console.error("Critical: Failed to update failure state:", dbErr);
        }
      }
    })();
  } catch (error) {
    console.error('Error ending meeting:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's meeting history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { participants: req.user.username }]
    }).sort({ startTime: -1 });
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific meeting details
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOne({ roomId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Smart Rewind - Instant AI context summary (ADHD/late-join feature)
router.get('/:roomId/smart-rewind', async (req, res) => {
  console.log(`🧠 [REWIND] Request for room: ${req.params.roomId}`);
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOne({ roomId });

    if (!meeting) {
      console.log(`❌ [REWIND] Meeting not found: ${roomId}`);
      return res.status(404).json({ message: 'Meeting session not found.' });
    }

    if (!meeting.transcript || meeting.transcript.length === 0) {
      console.log(`❌ [REWIND] No transcript for room: ${roomId}`);
      return res.status(404).json({ message: 'No conversation recorded yet.' });
    }

    // Get transcripts from the last 60 seconds
    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60000);
    let recentTranscript = meeting.transcript.filter(t => t.timestamp >= sixtySecondsAgo);

    if (recentTranscript.length < 5) {
      recentTranscript = meeting.transcript.slice(-10);
    }

    const transcriptText = recentTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n');
    console.log(`📝 [REWIND] Analyzing ${recentTranscript.length} lines of text.`);

    let summaryText = "";
    let source = "Gemini AI";

    // --- TIER 1: Gemini (With Retries) ---
    try {
      console.log('🤖 [REWIND] Attempting Gemini API...');
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_MISSING");

      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const prompt = `
Analyze this short meeting segment and generate a context summary.
Transcript:
${transcriptText}

FORMAT:
SUMMARY: <1-2 sentences>
KEY POINTS:
• <point 1>
• <point 2>
• <point 3>
ACTION ITEMS:
• <item or "None">
      `.trim();

      let result;
      const maxRetries = 2;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          result = await model.generateContent(prompt);
          const response = await result.response;
          summaryText = response.text();
          break;
        } catch (err) {
          if ((err.status === 503 || err.status === 429) && i < maxRetries) {
            console.log(`⚠️ [REWIND] Gemini Busy (Retry ${i + 1})...`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            continue;
          }
          throw err;
        }
      }
    } catch (geminiError) {
      console.error('⚠️ [REWIND] Gemini Tier Failed:', geminiError.message);

      // --- TIER 2: Hugging Face Fallback ---
      try {
        console.log('🔄 [REWIND] Falling back to Hugging Face (Tier 2)...');
        if (!process.env.HF_API_KEY) throw new Error("HF_API_KEY_MISSING");

        const hfResponse = await axios.post(
          "https://api-inference.huggingface.co/models/knkarthick/MEETING_SUMMARY",
          { inputs: transcriptText },
          { headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` }, timeout: 8000 }
        );

        if (hfResponse.data && hfResponse.data[0]?.summary_text) {
          summaryText = `SUMMARY: ${hfResponse.data[0].summary_text}\n\nKEY POINTS:\n• Derived from conversation context\n• Instant recovery active\n\nACTION ITEMS: • Check transcript for details`;
          source = "Hugging Face (Fallback)";
        } else {
          throw new Error("Invalid HF response");
        }
      } catch (hfError) {
        console.error('⚠️ [REWIND] Hugging Face Tier Failed:', hfError.message);

        // --- TIER 3: Local Heuristic (Last Resort) ---
        console.log('🩹 [REWIND] Using Local Heuristic (Tier 3)...');
        const keywords = transcriptText.split(/\s+/).filter(w => w.length > 5).slice(0, 5).join(', ');
        const speakers = [...new Set(recentTranscript.map(t => t.speaker))].join(', ');

        summaryText = `SUMMARY: Brief activity overview.\n\nKEY POINTS:\n• Discussion involved: ${speakers}\n• Mentioned topics: ${keywords || 'Ongoing conversation'}\n\nACTION ITEMS: None (Heuristic)`;
        source = "Local Heuristic (Emergency)";
      }
    }

    console.log(`✅ [REWIND] Summary generated via ${source}.`);
    res.json({
      success: true,
      summary: summaryText,
      source: source,
      timestamp: new Date().toLocaleTimeString()
    });

  } catch (error) {
    console.error('❌ [REWIND] Critical Error:', error);
    res.status(500).json({ message: 'Smart Rewind unavailable.', error: error.message });
  }
});

import { Client } from '@notionhq/client';

let notion;
function getNotion() {
  if (!notion) {
    notion = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return notion;
}

// Export to Notion
router.post('/:roomId/export/notion', async (req, res) => {
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOne({ roomId });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    // 1. Find a parent page/database named "Meeting Notes"
    const notionClient = getNotion();
    const searchResponse = await notionClient.search({
      query: 'Meeting Notes',
      page_size: 1,
    });

    let parentId;
    let parentType = 'database_id'; // Default, but we will check

    if (searchResponse.results.length > 0) {
      const match = searchResponse.results[0];
      parentId = match.id;
      // If it's a page, we use page_id ? Actually for creating a page, parent can be database_id or page_id
      if (match.object === 'page') {
        parentType = 'page_id';
      } else {
        parentType = 'database_id';
      }
    } else {
      // Create a new top-level page? No, we need a parent.
      // For now, let's just return error if not found, or maybe try to create one? 
      // Better validation message:
      return res.status(404).json({ message: 'Could not find a "Meeting Notes" page or database in your Notion workspace. Please create one and share it with the integration.' });
    }


    // 2. Create the page
    const response = await notionClient.pages.create({
      parent: { [parentType]: parentId },
      properties: {
        title: {
          title: [
            {
              text: {
                content: `Meeting Summary: ${new Date(meeting.startTime).toLocaleDateString()}`,
              },
            },
          ],
        },
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Meeting Details' } }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: `Room ID: ${meeting.roomId}\n` } },
              { text: { content: `Date: ${new Date(meeting.startTime).toLocaleString()}\n` } },
              { text: { content: `Participants: ${meeting.participants.join(', ')}` } },
            ],
          },
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Summary' } }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content: meeting.summary || 'No summary available.',
                },
              },
            ],
          },
        },
      ],
    });

    res.json({ success: true, url: response.url });

  } catch (error) {
    console.error('Notion Export Error:', error);
    res.status(500).json({ message: 'Failed to export to Notion', error: error.message });
  }
});

// Helper to extract action items
function extractActionItems(transcript) {
  return transcript
    .filter(t => /^(I will|Let's|We should|Please|Can you|We are going to|The meeting will focus)/i.test(t.text))
    .map(t => `- ${t.speaker}: ${t.text}`)
    .slice(0, 5) // Limit to 5
    .join('\n');
}

// Helper function for AI summary (Hugging Face)
async function generateAISummary(transcript, participants = []) {
  if (!transcript || transcript.length === 0) return "No conversation recorded.";

  try {
    const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');

    // Truncate if too long (BART has a limit, usually 1024 tokens, approx 4000 chars safe bet)
    const truncatedTranscript = transcriptText.length > 3000
      ? transcriptText.substring(0, 3000) + "..."
      : transcriptText;

    const response = await axios.post(
      "https://router.huggingface.co/hf-inference/models/knkarthick/MEETING_SUMMARY",
      {
        inputs: truncatedTranscript,
        parameters: {
          do_sample: false, // Deterministic output to reduce hallucinations
          max_length: 150,  // concise summary
          min_length: 10
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data && response.data[0] && response.data[0].summary_text) {
      return response.data[0].summary_text;
    }

    throw new Error('Invalid response from Hugging Face API');

  } catch (error) {
    console.error("Hugging Face API Error:", error.response?.data || error.message);
    // Fallback to heuristic if AI fails
    return generateHeuristicSummary(transcript, participants);
  }
}

// Fallback Heuristic function
function generateHeuristicSummary(transcript, participants = []) {
  if (!transcript || transcript.length === 0) return "No conversation recorded.";

  // 1. Extract most frequent words (excluding stop words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'that', 'this', 'with', 'you', 'i', 'we']);
  const wordFreq = {};

  transcript.forEach(entry => {
    const words = entry.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
    .join(', ');

  // 2. Identify potential action items
  const actionItems = extractActionItems(transcript);

  // 3. Construct summary
  let summary = `**Note: AI generation failed, showing heuristic summary.**\n\nMeeting Duration: ${transcript.length} interactions.\n\n`;
  if (topKeywords) summary += `Key Topics: ${topKeywords}\n\n`;
  if (actionItems) summary += `Potential Action Items:\n${actionItems}\n\n`;

  // Use provided participants list if available, otherwise fallback to transcript speakers
  const attendees = (participants && participants.length > 0)
    ? participants.join(', ')
    : [...new Set(transcript.map(t => t.speaker))].join(', ');

  summary += `Brief Overview:\nThe meeting involved ${attendees}. They discussed various topics including ${topKeywords || 'general matters'}.`;

  return summary;
}

export default router;


