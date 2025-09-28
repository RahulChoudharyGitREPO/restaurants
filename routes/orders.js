const express = require('express');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const Promo = require('../models/Promo');

const router = express.Router();

// Create new order
router.post('/', auth, async (req, res, next) => {
  try {
    const {
      restaurantId,
      items = [],
      address,
      fees = {},
      tip = 0,
      distanceKm = 0,
      promoCode
    } = req.body;

    // Validate promo code if provided
    let promo = null;
    if (promoCode) {
      promo = await Promo.findOne({
        code: promoCode,
        active: true,
        validUntil: { $gte: new Date() }
      });

      if (!promo) {
        return res.status(400).json({ message: 'Invalid or expired promo code' });
      }
    }

    // --- compute pricing inline safely ---
    const toNum = (v, d = 0) => Number.isFinite(+v) ? +v : d;

    const cleanItems = (items || []).map(it => ({
      ...it,
      price: toNum(it.price, 0),
      quantity: toNum(it.quantity, 1),
      customizations: (it.customizations || []).map(c => ({
        ...c,
        price: toNum(c.price, 0)
      }))
    }));

    const cleanFees = {
      deliveryFee: toNum((fees || {}).deliveryFee, 0),
      serviceFee: toNum((fees || {}).serviceFee, 0),
      packaging: toNum((fees || {}).packaging, 0),
      taxPct: toNum((fees || {}).taxPct, 0)
    };

    const cleanTip = toNum(tip, 0);

    const subtotal = cleanItems.reduce(
      (s, it) =>
        s +
        ((it.price +
          it.customizations.reduce((m, c) => m + c.price, 0)) *
          it.quantity),
      0
    );

    let preTax =
      subtotal +
      cleanFees.deliveryFee +
      cleanFees.serviceFee +
      cleanFees.packaging;
    let tax = +(preTax * (cleanFees.taxPct / 100)).toFixed(2);

    // promo discount (optional)
    let discount = 0;
    if (promo) {
      if (promo.type === 'percent') {
        discount = +(subtotal * (promo.value / 100)).toFixed(2);
        if (promo.maxValue) discount = Math.min(discount, promo.maxValue);
      } else if (promo.type === 'flat') {
        discount = toNum(promo.value, 0);
      }
    }

    const total = +(preTax + tax + cleanTip - discount).toFixed(2);

    if ([subtotal, tax, total].some(n => Number.isNaN(n))) {
      return res.status(400).json({
        message: 'Validation Error',
        errors: ['Pricing calculation failed. Check numeric fields.']
      });
    }

    const pricing = {
      subtotal,
      deliveryFee: cleanFees.deliveryFee,
      serviceFee: cleanFees.serviceFee,
      tax,
      tip: cleanTip,
      discount,
      total
    };

    // Save order
    const order = new Order({
      userId: req.user._id,
      restaurantId,
      items: cleanItems,
      address,
      pricing,
      promoCode: promo?.code || null,
      status: 'confirmed',
      estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000) // 30 mins
    });

    await order.save();
    await order.populate('restaurantId', 'name image');

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

// Get user orders
router.get('/', auth, async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let query = { userId: req.user._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('restaurantId', 'name image')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});
router.put('/:id/status', auth, async (req, res, next) => {
  try {
    const { status, estimatedDeliveryTime, notes } = req.body;

    // find and update the order
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status || order.status;
    if (estimatedDeliveryTime) order.estimatedDeliveryTime = estimatedDeliveryTime;

    // optionally add a tracking history entry
    if (notes) {
      order.delivery.trackingHistory.push({
        status,
        location: order.address?.coordinates || {},
        notes
      });
    }

    await order.save();
    await order.populate('restaurantId', 'name image');

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// Get single order
router.get('/:id', auth, async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('restaurantId', 'name image address phone');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.json(order);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
