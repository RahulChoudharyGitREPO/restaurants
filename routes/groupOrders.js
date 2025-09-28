const express = require('express');
const router = express.Router();
const GroupOrder = require('../models/GroupOrder');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { emitToGroupOrder } = require('../services/socketService');

// @route   POST /api/group-orders
// @desc    Create group order
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      restaurantId,
      settings,
      delivery
    } = req.body;

    const groupOrder = new GroupOrder({
      name,
      organizer: req.user.userId,
      restaurantId,
      settings: {
        deadline: settings?.deadline,
        maxParticipants: settings?.maxParticipants || 20,
        allowItemChanges: settings?.allowItemChanges !== false,
        splitDeliveryFee: settings?.splitDeliveryFee !== false,
        requireApproval: settings?.requireApproval || false
      },
      delivery,
      inviteCode: uuidv4().substring(0, 8).toUpperCase()
    });

    await groupOrder.save();
    await groupOrder.populate('restaurantId', 'name image cuisine');
    await groupOrder.populate('organizer', 'name email');

    res.status(201).json({
      success: true,
      data: groupOrder
    });
  } catch (error) {
    console.error('Error creating group order:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/group-orders/:id
// @desc    Get group order details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const groupOrder = await GroupOrder.findById(req.params.id)
      .populate('restaurantId', 'name image cuisine deliveryFee minimumOrder')
      .populate('organizer', 'name email')
      .populate('participants.userId', 'name email')
      .populate('participants.items.menuItemId', 'name price image');

    if (!groupOrder) {
      return res.status(404).json({
        success: false,
        message: 'Group order not found'
      });
    }

    // Check if user is participant or organizer
    const isParticipant = groupOrder.participants.some(
      p => p.userId._id.toString() === req.user.userId
    );
    const isOrganizer = groupOrder.organizer._id.toString() === req.user.userId;

    if (!isParticipant && !isOrganizer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: groupOrder
    });
  } catch (error) {
    console.error('Error fetching group order:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/group-orders/join/:inviteCode
// @desc    Join group order by invite code
// @access  Private
router.post('/join/:inviteCode', auth, async (req, res) => {
  try {
    const groupOrder = await GroupOrder.findOne({
      inviteCode: req.params.inviteCode.toUpperCase(),
      status: 'collecting'
    });

    if (!groupOrder) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite code or group order not active'
      });
    }

    // Check if user already joined
    const alreadyJoined = groupOrder.participants.some(
      p => p.userId.toString() === req.user.userId
    );

    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this group order'
      });
    }

    // Check if group is full
    if (groupOrder.participants.length >= groupOrder.settings.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Group order is full'
      });
    }

    // Check deadline
    if (groupOrder.settings.deadline && new Date() > new Date(groupOrder.settings.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Group order deadline has passed'
      });
    }

    // Add participant
    groupOrder.participants.push({
      userId: req.user.userId,
      items: [],
      subtotal: 0
    });

    await groupOrder.save();

    // Emit update to group
    emitToGroupOrder(groupOrder._id, 'participant_joined', {
      userId: req.user.userId,
      participantCount: groupOrder.participants.length
    });

    await groupOrder.populate('participants.userId', 'name email');

    res.json({
      success: true,
      data: groupOrder,
      message: 'Successfully joined group order'
    });
  } catch (error) {
    console.error('Error joining group order:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/group-orders/:id/items
// @desc    Add items to group order
// @access  Private
router.post('/:id/items', auth, async (req, res) => {
  try {
    const { items } = req.body;

    const groupOrder = await GroupOrder.findById(req.params.id);

    if (!groupOrder) {
      return res.status(404).json({
        success: false,
        message: 'Group order not found'
      });
    }

    if (groupOrder.status !== 'collecting') {
      return res.status(400).json({
        success: false,
        message: 'Group order is no longer accepting items'
      });
    }

    // Check deadline
    if (groupOrder.settings.deadline && new Date() > new Date(groupOrder.settings.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Group order deadline has passed'
      });
    }

    // Find participant
    const participantIndex = groupOrder.participants.findIndex(
      p => p.userId.toString() === req.user.userId
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this group order'
      });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.quantity;
    }

    // Update participant items
    if (groupOrder.settings.allowItemChanges) {
      groupOrder.participants[participantIndex].items = items;
    } else {
      groupOrder.participants[participantIndex].items.push(...items);
    }

    groupOrder.participants[participantIndex].subtotal = subtotal;

    // Recalculate totals
    calculateGroupOrderTotals(groupOrder);

    await groupOrder.save();

    // Emit update to group
    emitToGroupOrder(groupOrder._id, 'items_updated', {
      userId: req.user.userId,
      items: items,
      totals: groupOrder.totals
    });

    res.json({
      success: true,
      data: groupOrder,
      message: 'Items added successfully'
    });
  } catch (error) {
    console.error('Error adding items to group order:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   POST /api/group-orders/:id/finalize
// @desc    Finalize group order (organizer only)
// @access  Private
router.post('/:id/finalize', auth, async (req, res) => {
  try {
    const groupOrder = await GroupOrder.findById(req.params.id)
      .populate('restaurantId');

    if (!groupOrder) {
      return res.status(404).json({
        success: false,
        message: 'Group order not found'
      });
    }

    if (groupOrder.organizer.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only organizer can finalize the order'
      });
    }

    if (groupOrder.status !== 'collecting') {
      return res.status(400).json({
        success: false,
        message: 'Group order is already finalized'
      });
    }

    // Check minimum order
    if (groupOrder.totals.subtotal < groupOrder.restaurantId.minimumOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is $${groupOrder.restaurantId.minimumOrder}`
      });
    }

    // Create individual order
    const orderItems = [];
    groupOrder.participants.forEach(participant => {
      participant.items.forEach(item => {
        orderItems.push({
          menuItemId: item.menuItemId,
          name: item.name || 'Group Order Item',
          price: item.price,
          quantity: item.quantity,
          customizations: item.customizations || []
        });
      });
    });

    const order = new Order({
      userId: groupOrder.organizer,
      restaurantId: groupOrder.restaurantId._id,
      items: orderItems,
      address: groupOrder.delivery.address,
      pricing: {
        subtotal: groupOrder.totals.subtotal,
        deliveryFee: groupOrder.totals.deliveryFee,
        tax: groupOrder.totals.tax,
        total: groupOrder.totals.total
      },
      specialInstructions: groupOrder.delivery.instructions,
      groupOrderId: groupOrder._id
    });

    await order.save();

    // Update group order
    groupOrder.status = 'ordered';
    groupOrder.orderId = order._id;
    await groupOrder.save();

    // Emit finalization to group
    emitToGroupOrder(groupOrder._id, 'order_finalized', {
      orderId: order._id,
      status: 'ordered'
    });

    res.json({
      success: true,
      data: {
        groupOrder,
        order
      },
      message: 'Group order finalized successfully'
    });
  } catch (error) {
    console.error('Error finalizing group order:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/group-orders/my-orders
// @desc    Get user's group orders
// @access  Private
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = {
      $or: [
        { organizer: req.user.userId },
        { 'participants.userId': req.user.userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const groupOrders = await GroupOrder.find(query)
      .populate('restaurantId', 'name image cuisine')
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await GroupOrder.countDocuments(query);

    res.json({
      success: true,
      data: groupOrders,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching user group orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// Helper function to calculate group order totals
const calculateGroupOrderTotals = (groupOrder) => {
  const subtotal = groupOrder.participants.reduce((total, participant) => {
    return total + participant.subtotal;
  }, 0);

  const tax = subtotal * 0.08; // 8% tax
  const deliveryFee = groupOrder.settings.splitDeliveryFee
    ? groupOrder.delivery.fee / groupOrder.participants.length
    : groupOrder.delivery.fee || 0;

  groupOrder.totals = {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    tips: 0,
    total: parseFloat((subtotal + tax + deliveryFee).toFixed(2))
  };
};

module.exports = router;