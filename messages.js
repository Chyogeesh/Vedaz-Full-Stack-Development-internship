const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

router.get('/:userId/messages', async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.find({
    $or: [
      { from: req.user.id, to: userId },
      { from: userId, to: req.user.id }
    ]
  }).sort({ createdAt: 1 }).populate('from to', 'name');
  res.json(messages);
});

module.exports = router;
