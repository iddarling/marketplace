const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Импорт базы данных
const db = require('./db');

const app = express();


// Для Railway важно использовать 0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || '44ba179362efcb8dc7a778f82615cedea58909725432b37206021a0c6b3f9790b96103d6263ce6e8ccaeffbce0d07bc6662484c887ad35ab6750cf60f721bfdf',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));


// Добавьте после настройки сессии и перед другими middleware:
app.use((req, res, next) => {
  console.log('📋 Сессия:', {
    id: req.sessionID,
    userId: req.session.userId,
    originalUserId: req.session.userId
  });
  next();
});

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
};


// Middleware для проверки роли администратора
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }
        
        const user = await db.getUserById(req.session.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
        }
        
        next();
    } catch (error) {
        console.error('❌ Ошибка проверки прав администратора:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};
app.use(requestLogger);
// === API для админ-панели ===

// Получить всех пользователей (только для админа)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await db.db.all(`
            SELECT id, email, name, phone, address, role, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить статистику (только для админа)
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const stats = await db.db.get(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT SUM(total) FROM orders) as total_revenue,
                (SELECT COUNT(*) FROM orders WHERE status = 'processing') as pending_orders
        `);
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить все заказы (только для админа)
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        const orders = await db.db.all(`
            SELECT 
                o.*,
                u.email as user_email,
                u.name as user_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        
        res.json({
            success: true,
            orders: orders
        });
    } catch (error) {
        console.error('❌ Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить статус заказа (только для админа)
app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: 'Статус обязателен' });
        }
        
        const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Неверный статус' });
        }
        
        await db.db.run(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, id]
        );
        
        res.json({
            success: true,
            message: 'Статус заказа обновлен'
        });
    } catch (error) {
        console.error('❌ Ошибка обновления статуса заказа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый товар (только для админа)
// Создать новый товар (только для админа)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { 
            name, 
            price, 
            category, 
            description = '', 
            image = '', 
            rating = 0, 
            reviews = 0, 
            stock = 0,
            specifications = {}
        } = req.body;
        
        console.log('📝 Создание товара:', { name, price, category });
        
        if (!name || !price || !category) {
            return res.status(400).json({ error: 'Название, цена и категория обязательны' });
        }
        
        if (price < 0) {
            return res.status(400).json({ error: 'Цена не может быть отрицательной' });
        }
        
        if (stock < 0) {
            return res.status(400).json({ error: 'Количество на складе не может быть отрицательным' });
        }
        
        const productId = uuidv4();
        
        await db.db.run(
            `INSERT INTO products (id, name, price, category, description, image, rating, reviews, stock, specifications) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                name,
                parseInt(price),
                category,
                description,
                image,
                parseFloat(rating),
                parseInt(reviews),
                parseInt(stock),
                JSON.stringify(specifications)
            ]
        );
        
        console.log('✅ Товар создан:', productId);
        
        // Получаем созданный товар для ответа
        const newProduct = await db.db.get(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );
        
        if (newProduct && newProduct.specifications) {
            newProduct.specifications = JSON.parse(newProduct.specifications);
        }
        
        res.json({
            success: true,
            productId: productId,
            product: newProduct,
            message: 'Товар успешно создан'
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить товар (только для админа)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const validFields = ['name', 'price', 'category', 'description', 'image', 'rating', 'reviews', 'stock', 'specifications'];
        const fieldsToUpdate = {};
        
        // Проверяем и преобразуем поля
        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                if (key === 'specifications') {
                    fieldsToUpdate[key] = JSON.stringify(value);
                } else if (key === 'price' || key === 'stock' || key === 'reviews') {
                    fieldsToUpdate[key] = parseInt(value);
                } else if (key === 'rating') {
                    fieldsToUpdate[key] = parseFloat(value);
                } else {
                    fieldsToUpdate[key] = value;
                }
            }
        }
        
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ error: 'Нет полей для обновления' });
        }
        
        // Формируем SQL запрос
        const setClause = Object.keys(fieldsToUpdate)
            .map(field => `${field} = ?`)
            .join(', ');
        
        const values = Object.values(fieldsToUpdate);
        values.push(id); // Добавляем id в конец для WHERE
        
        await db.db.run(
            `UPDATE products SET ${setClause} WHERE id = ?`,
            values
        );
        
        res.json({
            success: true,
            message: 'Товар успешно обновлен'
        });
    } catch (error) {
        console.error('❌ Ошибка обновления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить товар (только для админа)
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, есть ли товар в заказах
        const inOrders = await db.db.get(
            'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
            [id]
        );
        
        if (inOrders.count > 0) {
            return res.status(400).json({ 
                error: 'Нельзя удалить товар, который есть в заказах. Сначала удалите связанные заказы.' 
            });
        }
        
        // Проверяем, есть ли товар в корзинах
        const inCarts = await db.db.get(
            'SELECT COUNT(*) as count FROM cart_items WHERE product_id = ?',
            [id]
        );
        
        if (inCarts.count > 0) {
            // Удаляем из корзин
            await db.db.run('DELETE FROM cart_items WHERE product_id = ?', [id]);
        }
        
        // Удаляем товар
        await db.db.run('DELETE FROM products WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Товар успешно удален'
        });
    } catch (error) {
        console.error('❌ Ошибка удаления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить роль пользователя (только для админа)
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }
        
        // Нельзя изменить роль самого себя
        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Нельзя изменить свою собственную роль' });
        }
        
        await db.db.run(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, id]
        );
        
        res.json({
            success: true,
            message: 'Роль пользователя обновлена'
        });
    } catch (error) {
        console.error('❌ Ошибка обновления роли пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// === API для продуктов ===
app.get('/api/products', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      search: req.query.search,
      sort: req.query.sort
    };
    
    const products = await db.getProducts(filters);
    
    // Получаем категории
    const categories = await db.db.all('SELECT DISTINCT category FROM products ORDER BY category');
    
    res.json({
      success: true,
      products: products.map(p => ({
        ...p,
        specifications: p.specifications ? JSON.parse(p.specifications) : {}
      })),
      total: products.length,
      categories: categories.map(c => c.category)
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения продуктов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Продукт не найден' });
    }
    
    // Похожие продукты
    const similarProducts = await db.db.all(
      'SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4',
      [product.category, product.id]
    );
    
    res.json({
      success: true,
      product: product,
      similarProducts: similarProducts.map(p => ({
        ...p,
        specifications: p.specifications ? JSON.parse(p.specifications) : {}
      }))
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения продукта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === API для пользователей ===
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    console.log('📝 Регистрация пользователя:', { email, name });
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    // Проверяем существующего пользователя
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    // Создаем пользователя
    const user = await db.createUser({ email, password, name, phone });
    
    // Устанавливаем сессию
    req.session.userId = user.id;
    
    // Переносим корзину из сессии в пользователя
    if (req.sessionID) {
      await db.transferCart(req.sessionID, user.id);
    }
    
    console.log('✅ Пользователь зарегистрирован:', user.email);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Попытка входа:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    const user = await db.getUserByEmail(email);
    if (!user) {
      console.log('❌ Пользователь не найден:', email);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Неверный пароль для:', email);
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    // Устанавливаем сессию
    req.session.userId = user.id;
    
    // Переносим корзину из сессии в пользователя
    if (req.sessionID) {
      await db.transferCart(req.sessionID, user.id);
    }
    
    console.log('✅ Пользователь вошел:', user.email);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// API для получения информации о пользователе - исправьте
app.get('/api/user', async (req, res) => {
  console.log('👤 Запрос данных пользователя, сессия:', req.session);
  
  try {
    if (!req.session.userId) {
      console.log('❌ Пользователь не авторизован, userId не найден в сессии');
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log('🔍 Ищем пользователя с ID:', req.session.userId);
    const user = await db.getUserById(req.session.userId);
    
    if (!user) {
      console.log('❌ Пользователь не найден в базе данных');
      req.session.destroy();
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    console.log('✅ Пользователь найден:', user.email);
    
    // Убираем пароль из ответа
    const { password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для корзины - исправьте
app.get('/api/cart', async (req, res) => {
  console.log('🛒 Запрос корзины, сессия ID:', req.sessionID, 'userId:', req.session.userId);
  
  try {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    
    console.log('🔍 Получаем корзину для userId:', userId, 'sessionId:', sessionId);
    const cart = await db.getCart(userId || null, sessionId);
    
    console.log('✅ Корзина получена, товаров:', cart.items.length);
    
    res.json({
      success: true,
      cart: cart
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения корзины:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/cart/add', async (req, res) => {
  try {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    const { productId, quantity = 1 } = req.body;
    
    console.log(`🛒 Добавление в корзину: userId=${userId}, sessionId=${sessionId}, productId=${productId}`);
    
    if (!productId) {
      return res.status(400).json({ error: 'Не указан ID продукта' });
    }
    
    const cart = await db.addToCart(userId || null, sessionId, productId, quantity);
    
    res.json({
      success: true,
      cart: cart
    });
    
  } catch (error) {
    console.error('❌ Ошибка добавления в корзину:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/cart/update/:productId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    const { productId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity && quantity !== 0) {
      return res.status(400).json({ error: 'Не указано количество' });
    }
    
    const cart = await db.updateCartItem(userId || null, sessionId, productId, quantity);
    
    res.json({
      success: true,
      cart: cart
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления корзины:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/cart/remove/:productId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    const { productId } = req.params;
    
    const cart = await db.removeFromCart(userId || null, sessionId, productId);
    
    res.json({
      success: true,
      cart: cart
    });
    
  } catch (error) {
    console.error('❌ Ошибка удаления из корзины:', error);
    res.status(400).json({ error: error.message });
  }
});

// === API для заказов ===
app.post('/api/orders/create', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, phone, address, comment } = req.body;
    
    console.log(`📦 Создание заказа для пользователя: ${userId}`);
    
    // Получаем корзину пользователя
    const cart = await db.getCart(userId, null);
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Корзина пуста' });
    }
    
    // Получаем данные пользователя
    const user = await db.getUserById(userId);
    
    // Создаем заказ
    const orderData = {
      userId,
      items: cart.items,
      total: cart.total,
      customerName: name || user.name,
      customerPhone: phone || user.phone,
      customerAddress: address || user.address,
      customerComment: comment || ''
    };
    
    const order = await db.createOrder(orderData);
    
    // Обновляем данные пользователя если изменились
    const updates = {};
    if (name && name !== user.name) updates.name = name;
    if (phone && phone !== user.phone) updates.phone = phone;
    if (address && address !== user.address) updates.address = address;
    
    if (Object.keys(updates).length > 0) {
      await db.updateUser(userId, updates);
    }
    
    console.log(`✅ Заказ создан: ${order.orderNumber}`);
    
    res.json({
      success: true,
      order: order,
      message: 'Заказ успешно создан'
    });
    
  } catch (error) {
    console.error('❌ Ошибка создания заказа:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orders = await db.getUserOrders(userId);
    
    res.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/product/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'product.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/profile', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Страница не найдена' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Ошибка сервера:', err.stack);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Инициализация базы данных и запуск сервера
db.init().then(() => {
    app.listen(PORT, HOST, () => {
        console.log(`✅ Сервер запущен на http://${HOST}:${PORT}`);
        console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
        console.log(`📦 API: http://${HOST}:${PORT}/api/products`);
        console.log(`🛒 Корзина: http://${HOST}:${PORT}/cart`);
        console.log(`🔐 Логин: http://${HOST}:${PORT}/login`);
        console.log(`👑 Админка: http://${HOST}:${PORT}/admin`);
        console.log(`📊 Мониторинг: http://${HOST}:${PORT}/ping`);
    });
}).catch(err => {
    console.error('❌ Не удалось запустить сервер:', err);
    process.exit(1);
});

module.exports = app;
// Добавьте CORS для Railway
const cors = require('cors');
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-app-name.railway.app'] // Замените на ваш домен
        : 'http://localhost:3000',
    credentials: true
}));

// В server.js добавьте:
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await db.db.all('SELECT id, email, name FROM users');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Простой кэш для защиты от быстрых кликов
const requestCache = new Map();

app.post('/api/cart/add', async (req, res) => {
  try {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    const { productId, quantity = 1 } = req.body;
    
    // Создаем уникальный ключ для этого запроса
    const cacheKey = `${userId || sessionId}_${productId}`;
    
    // Проверяем, не был ли уже такой запрос недавно
    const lastRequest = requestCache.get(cacheKey);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < 1000) { // 1 секунда
      console.log('⏳ Запрос слишком частый, игнорируем:', cacheKey);
      return res.status(429).json({ error: 'Слишком частые запросы' });
    }
    
    // Сохраняем время запроса
    requestCache.set(cacheKey, now);
    
    console.log(`🛒 Добавление в корзину: userId=${userId}, sessionId=${sessionId}, productId=${productId}`);
    
    if (!productId) {
      return res.status(400).json({ error: 'Не указан ID продукта' });
    }
    
    const cart = await db.addToCart(userId || null, sessionId, productId, quantity);
    
    // Очищаем старые записи из кэша
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, 1000);
    
    res.json({
      success: true,
      cart: cart
    });
    
  } catch (error) {
    console.error('❌ Ошибка добавления в корзину:', error);
    res.status(400).json({ error: error.message });
  }
});


// Маршрут для админ-панели
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});


// === API для админ-панели (управление товарами) ===

// Получить все товары (только для админа)
// Получить все товары для админа
app.get('/api/admin/products/all', requireAdmin, async (req, res) => {
    try {
        console.log('📦 Получение всех товаров для админа');
        const products = await db.db.all(`
            SELECT * FROM products 
            ORDER BY name ASC
        `);
        
        // Парсим спецификации
        const productsWithParsedSpecs = products.map(product => ({
            ...product,
            specifications: product.specifications ? JSON.parse(product.specifications) : {}
        }));
        
        res.json({
            success: true,
            products: productsWithParsedSpecs
        });
    } catch (error) {
        console.error('❌ Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить товар по ID (только для админа)
app.get('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const product = await db.db.get(
            'SELECT * FROM products WHERE id = ?',
            [req.params.id]
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Парсим спецификации
        if (product.specifications) {
            product.specifications = JSON.parse(product.specifications);
        }
        
        res.json({
            success: true,
            product: product
        });
    } catch (error) {
        console.error('❌ Ошибка получения товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый товар (только для админа)
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { 
            name, 
            price, 
            category, 
            description = '', 
            image = '', 
            rating = 0, 
            reviews = 0, 
            stock = 0,
            specifications = {}
        } = req.body;
        
        console.log('📝 Создание товара:', { name, price, category });
        
        if (!name || !price || !category) {
            return res.status(400).json({ error: 'Название, цена и категория обязательны' });
        }
        
        // Проверяем, не существует ли уже такой товар
        const existingProduct = await db.db.get(
            'SELECT * FROM products WHERE name = ? AND category = ?',
            [name, category]
        );
        
        if (existingProduct) {
            console.log('⚠️ Товар с таким названием уже существует в этой категории');
            return res.status(400).json({ 
                error: 'Товар с таким названием уже существует в этой категории' 
            });
        }
        
        const productId = uuidv4();
        
        await db.db.run(
            `INSERT INTO products (id, name, price, category, description, image, rating, reviews, stock, specifications) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                name,
                parseInt(price),
                category,
                description,
                image,
                parseFloat(rating),
                parseInt(reviews),
                parseInt(stock),
                JSON.stringify(specifications)
            ]
        );
        
        console.log('✅ Товар создан:', productId);
        
        res.json({
            success: true,
            productId: productId,
            message: 'Товар успешно создан'
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить товар (только для админа)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        console.log('✏️ Обновление товара:', id, updates);
        
        // Проверяем существование товара
        const existingProduct = await db.db.get(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );
        
        if (!existingProduct) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        const validFields = ['name', 'price', 'category', 'description', 'image', 'rating', 'reviews', 'stock', 'specifications'];
        const fieldsToUpdate = {};
        
        // Проверяем и преобразуем поля
        for (const [key, value] of Object.entries(updates)) {
            if (validFields.includes(key)) {
                if (key === 'specifications') {
                    fieldsToUpdate[key] = JSON.stringify(value);
                } else if (key === 'price' || key === 'stock' || key === 'reviews') {
                    fieldsToUpdate[key] = parseInt(value);
                } else if (key === 'rating') {
                    fieldsToUpdate[key] = parseFloat(value);
                } else {
                    fieldsToUpdate[key] = value;
                }
            }
        }
        
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ error: 'Нет полей для обновления' });
        }
        
        // Формируем SQL запрос
        const setClause = Object.keys(fieldsToUpdate)
            .map(field => `${field} = ?`)
            .join(', ');
        
        const values = Object.values(fieldsToUpdate);
        values.push(id); // Добавляем id в конец для WHERE
        
        await db.db.run(
            `UPDATE products SET ${setClause} WHERE id = ?`,
            values
        );
        
        console.log('✅ Товар обновлен:', id);
        
        res.json({
            success: true,
            message: 'Товар успешно обновлен'
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить товар (только для админа)
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🗑️ Удаление товара:', id);
        
        // Проверяем существование товара
        const existingProduct = await db.db.get(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );
        
        if (!existingProduct) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Проверяем, есть ли товар в заказах
        const inOrders = await db.db.get(
            'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
            [id]
        );
        
        if (inOrders.count > 0) {
            return res.status(400).json({ 
                error: 'Нельзя удалить товар, который есть в заказах. Сначала удалите связанные заказы.' 
            });
        }
        
        // Удаляем товар из корзин
        await db.db.run('DELETE FROM cart_items WHERE product_id = ?', [id]);
        
        // Удаляем товар
        await db.db.run('DELETE FROM products WHERE id = ?', [id]);
        
        console.log('✅ Товар удален:', id);
        
        res.json({
            success: true,
            message: 'Товар успешно удален'
        });
        
    } catch (error) {
        console.error('❌ Ошибка удаления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// Получаем порт из переменных окружения Railway
// Получаем порт из переменных окружения Railway


app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Доступен по: http://0.0.0.0:${PORT}`);
});

const logger = require('./logger');

// Замените все console.log на logger.log
console.log('Сервер запущен...'); // ❌ Старое
logger.log('Сервер запущен...'); // ✅ Новое

// Примеры использования:
logger.log('Запрос на /api/products', { query: req.query });
logger.error('Ошибка базы данных', error);
logger.success('Пользователь зарегистрирован', { userId: user.id });
logger.warn('Мало товара на складе', { productId, stock });


const fs = require('fs');
const path = require('path');

// Эндпоинт для просмотра логов (только для админа)
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logFile = path.join(__dirname, 'logs', 'app.log');
    if (!fs.existsSync(logFile)) {
      return res.json({
        success: false,
        message: 'Файл логов не найден',
        logs: []
      });
    }
    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .reverse() // Последние логи первыми
      .slice(0, 100); // Последние 100 строк
    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    logger.error('Ошибка чтения логов', error);
    res.status(500).json({ error: 'Ошибка чтения логов' });
  }
});

// Эндпоинт для очистки логов (только для админа)
app.delete('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const logFile = path.join(__dirname, 'logs', 'app.log');
    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '');
      logger.log('Логи очищены администратором');
    }
    res.json({
      success: true,
      message: 'Логи очищены'
    });
  } catch (error) {
    logger.error('Ошибка очистки логов', error);
    res.status(500).json({ error: 'Ошибка очистки логов' });
  }
});


// request-logger.js
const logger = require('./logger');
const requestLogger = require('./request-logger');

// Добавьте после других middleware

function requestLogger(req, res, next) {
  const start = Date.now();
  // Логируем входящий запрос
  logger.log(`📥 ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  // Перехватываем ответ
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    // Логируем ответ
    logger.log(`📤 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      status: res.statusCode,
      duration: duration + 'ms',
      responseSize: body?.length || 0
    });
    return originalSend.call(this, body);
  };
  next();
}

module.exports = requestLogger;


// ОБЯЗАТЕЛЬНО: Health check для Railway
app.get('/health', (req, res) => {
    const healthcheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Marketplace API',
        version: '1.0.0',
        checks: {
            database: 'checking',
            api: 'ok'
        }
    };
    try {
        // Проверяем подключение к базе данных
        if (db.db) {
            healthcheck.checks.database = 'connected';
        }

        res.status(200).json(healthcheck);
        console.log('✅ Health check пройден:', new Date().toISOString());
    } catch (error) {
        healthcheck.status = 'unhealthy';
        healthcheck.checks.database = 'error';
        res.status(503).json(healthcheck);
        console.error('❌ Health check не пройден:', error);
    }
});

// Простой ping для проверки
app.get('/ping', (req, res) => {
    res.json({status: 'pong',timestamp: new Date().toISOString(),server: 'Marketplace API'});});
// Корневой маршрут
app.get('/', (req, res) => {
    res.json({
        message: 'Marketplace API',
        version: '1.0.0',
        endpoints: {
            products: '/api/products',
            cart: '/api/cart',
            orders: '/api/orders',
            admin: '/api/admin/',
            health: '/health',
            ping: '/ping'
        },
        documentation: 'Добавьте сюда ссылку на документацию'
    });
});