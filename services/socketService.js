const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id;
      socket.userRole = decoded.role || 'customer';
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with role: ${socket.userRole}`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Join restaurant owners to restaurant rooms
    if (socket.userRole === 'restaurant_owner') {
      socket.on('join_restaurant', (restaurantId) => {
        socket.join(`restaurant_${restaurantId}`);
        console.log(`Restaurant owner joined room: restaurant_${restaurantId}`);
      });
    }

    // Join drivers to driver room
    // if (socket.userRole === 'driver') {
    //   socket.join('drivers');
    //   socket.on('update_location', (locationData) => {
    //     // Broadcast driver location to relevant orders
    //     socket.broadcast.emit('driver_location_update', {
    //       driverId: socket.userId,
    //       location: locationData
    //     });
    //   });
    // }
    if (socket.userRole === 'driver') {
  socket.join('drivers');
   socket.on('update_location', ({ orderId, latitude, longitude, speed }) => {
     if (!orderId || latitude == null || longitude == null) return;
     const payload = {
       driverId: socket.userId,
       location: { latitude, longitude },
       speed: speed ?? 0,
       ts: Date.now()
     };
     io.to(`order_${orderId}`).emit('driver_location_update', payload);
   });
 }

    // Handle order-related events
    socket.on('track_order', (orderId) => {
      socket.join(`order_${orderId}`);
    });

    socket.on('stop_tracking_order', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Group order events
    socket.on('join_group_order', (groupOrderId) => {
      socket.join(`group_order_${groupOrderId}`);
    });

    socket.on('leave_group_order', (groupOrderId) => {
      socket.leave(`group_order_${groupOrderId}`);
    });

    socket.on('group_order_message', (data) => {
      socket.to(`group_order_${data.groupOrderId}`).emit('new_group_message', {
        userId: socket.userId,
        message: data.message,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
};

// Emit order status updates
const emitOrderUpdate = (orderId, updateData) => {
  if (io) {
    io.to(`order_${orderId}`).emit('order_status_update', updateData);
  }
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// Emit to restaurant
const emitToRestaurant = (restaurantId, event, data) => {
  if (io) {
    io.to(`restaurant_${restaurantId}`).emit(event, data);
  }
};

// Emit to all drivers
const emitToDrivers = (event, data) => {
  if (io) {
    io.to('drivers').emit(event, data);
  }
};

// Emit to group order participants
const emitToGroupOrder = (groupOrderId, event, data) => {
  if (io) {
    io.to(`group_order_${groupOrderId}`).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  emitOrderUpdate,
  emitToUser,
  emitToRestaurant,
  emitToDrivers,
  emitToGroupOrder
};