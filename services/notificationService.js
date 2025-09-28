const Notification = require('../models/Notification');
const { emitToUser } = require('./socketService');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// SMS configuration (Twilio)
const smsClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();

    // Send real-time notification via WebSocket
    if (notification.channels.inApp) {
      emitToUser(notification.userId, 'new_notification', notification);
    }

    // Schedule or send email if enabled
    if (notification.channels.email) {
      await sendEmailNotification(notification);
    }

    // Schedule or send SMS if enabled
    if (notification.channels.sms) {
      await sendSMSNotification(notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

const sendEmailNotification = async (notification) => {
  try {
    if (!emailTransporter) {
      console.log('Email transporter not configured');
      return;
    }

    const user = await notification.populate('userId');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.userId.email,
      subject: notification.title,
      html: `
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
        ${notification.data.deepLink ? `<a href="${notification.data.deepLink}">View Details</a>` : ''}
      `
    };

    await emailTransporter.sendMail(mailOptions);

    // Update notification as sent
    notification.sentAt = new Date();
    await notification.save();

    console.log(`Email sent to ${user.userId.email}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

const sendSMSNotification = async (notification) => {
  try {
    if (!smsClient) {
      console.log('SMS client not configured');
      return;
    }

    const user = await notification.populate('userId');

    if (!user.userId.phone) {
      console.log('User phone number not available');
      return;
    }

    const message = `${notification.title}: ${notification.message}`;

    await smsClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.userId.phone
    });

    console.log(`SMS sent to ${user.userId.phone}`);
  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
};

// Order-related notification helpers
const sendOrderNotification = async (userId, type, orderData) => {
  const notificationTemplates = {
    order_placed: {
      title: 'Order Placed Successfully',
      message: `Your order #${orderData.orderNumber} has been placed and is being processed.`
    },
    order_confirmed: {
      title: 'Order Confirmed',
      message: `Your order #${orderData.orderNumber} has been confirmed by the restaurant.`
    },
    order_preparing: {
      title: 'Order Being Prepared',
      message: `The restaurant is now preparing your order #${orderData.orderNumber}.`
    },
    order_ready: {
      title: 'Order Ready for Pickup',
      message: `Your order #${orderData.orderNumber} is ready for delivery.`
    },
    order_picked_up: {
      title: 'Order Picked Up',
      message: `Your order #${orderData.orderNumber} has been picked up and is on the way.`
    },
    order_delivered: {
      title: 'Order Delivered',
      message: `Your order #${orderData.orderNumber} has been delivered. Enjoy your meal!`
    },
    order_cancelled: {
      title: 'Order Cancelled',
      message: `Your order #${orderData.orderNumber} has been cancelled.`
    }
  };

  const template = notificationTemplates[type];
  if (!template) return;

  await createNotification({
    userId,
    type,
    title: template.title,
    message: template.message,
    data: {
      orderId: orderData._id,
      orderNumber: orderData.orderNumber,
      deepLink: `/orders/${orderData._id}`
    },
    priority: ['order_cancelled', 'order_delivered'].includes(type) ? 'high' : 'normal'
  });
};

const sendPromotionNotification = async (userId, promoData) => {
  await createNotification({
    userId,
    type: 'promotion',
    title: 'Special Offer Just for You!',
    message: `${promoData.description} Use code: ${promoData.code}`,
    data: {
      promoId: promoData._id,
      code: promoData.code,
      deepLink: '/promotions'
    },
    channels: {
      push: true,
      email: true,
      sms: false,
      inApp: true
    }
  });
};

const sendLoyaltyNotification = async (userId, rewardData) => {
  await createNotification({
    userId,
    type: 'loyalty_reward',
    title: 'Loyalty Reward Earned!',
    message: `You've earned ${rewardData.points} points! Total: ${rewardData.totalPoints}`,
    data: {
      points: rewardData.points,
      totalPoints: rewardData.totalPoints,
      deepLink: '/loyalty'
    }
  });
};

// Bulk notification functions
const sendBulkNotifications = async (userIds, notificationData) => {
  const notifications = userIds.map(userId => ({
    ...notificationData,
    userId
  }));

  try {
    await Notification.insertMany(notifications);

    // Send real-time notifications
    notifications.forEach(notification => {
      if (notification.channels.inApp) {
        emitToUser(notification.userId, 'new_notification', notification);
      }
    });

    console.log(`Bulk notifications sent to ${userIds.length} users`);
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
  }
};

module.exports = {
  createNotification,
  sendOrderNotification,
  sendPromotionNotification,
  sendLoyaltyNotification,
  sendBulkNotifications
};