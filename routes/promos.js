const express = require('express');
const Promo = require('../models/Promo');

const router = express.Router();

// Validate promo code
router.get('/validate', async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promo = await Promo.findOne({
      code: code.toUpperCase(),
      active: true,
      validUntil: { $gte: new Date() }
    });

    if (!promo) {
      return res.status(404).json({ message: 'Invalid or expired promo code' });
    }

    res.json({
      valid: true,
      promo: {
        code: promo.code,
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        minOrderValue: promo.minOrderValue,
        maxDiscount: promo.maxDiscount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;