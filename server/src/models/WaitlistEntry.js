import mongoose from 'mongoose';

const waitlistEntrySchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    profileType: {
      type: String,
      enum: ['deaf', 'mute', 'other'],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('WaitlistEntry', waitlistEntrySchema);
