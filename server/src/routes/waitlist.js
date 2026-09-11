import { Router } from 'express';
import WaitlistEntry from '../models/WaitlistEntry.js';

const router = Router();

const BASE_TOTAL = 200;
const BASE_BREAKDOWN = { deaf: 82, mute: 64, other: 54 };

async function getBreakdownFromDb() {
  const [deaf, mute, other] = await Promise.all([
    WaitlistEntry.countDocuments({ profileType: 'deaf' }),
    WaitlistEntry.countDocuments({ profileType: 'mute' }),
    WaitlistEntry.countDocuments({ profileType: 'other' }),
  ]);
  return { deaf, mute, other };
}

router.get('/stats', async (req, res) => {
  try {
    const newSignups = await WaitlistEntry.countDocuments();
    const newBreakdown = await getBreakdownFromDb();

    res.json({
      total: BASE_TOTAL + newSignups,
      breakdown: {
        deaf: BASE_BREAKDOWN.deaf + newBreakdown.deaf,
        mute: BASE_BREAKDOWN.mute + newBreakdown.mute,
        other: BASE_BREAKDOWN.other + newBreakdown.other,
      },
      newSignups,
      baseTotal: BASE_TOTAL,
    });
  } catch (err) {
    console.error('Waitlist stats error:', err);
    res.status(500).json({ message: 'Failed to load waitlist stats' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { email, profileType } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!['deaf', 'mute', 'other'].includes(profileType)) {
      return res.status(400).json({ message: 'Please select a profile type.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await WaitlistEntry.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'This email is already on the waitlist.' });
    }

    await WaitlistEntry.create({ email: normalizedEmail, profileType });

    const newSignups = await WaitlistEntry.countDocuments();
    const newBreakdown = await getBreakdownFromDb();

    res.status(201).json({
      message: 'Welcome to the Linzo waitlist!',
      total: BASE_TOTAL + newSignups,
      breakdown: {
        deaf: BASE_BREAKDOWN.deaf + newBreakdown.deaf,
        mute: BASE_BREAKDOWN.mute + newBreakdown.mute,
        other: BASE_BREAKDOWN.other + newBreakdown.other,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This email is already on the waitlist.' });
    }
    console.error('Waitlist join error:', err);
    res.status(500).json({ message: 'Failed to join waitlist. Please try again.' });
  }
});

export default router;
