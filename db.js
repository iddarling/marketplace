const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DATABASE_URL || path.join(__dirname, 'database.db');
  }

  async init() {
    console.log('🔧 Инициализация базы данных...');
    console.log(`📁 Путь к БД: ${this.dbPath}`);

    
    // Открываем (или создаем) базу данных
    // Открываем базу данных
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Включаем foreign keys
    await this.db.run('PRAGMA foreign_keys = ON');
    
    // Создаем таблицы
    await this.createTables();
    
    // Добавляем тестовые данные
    await this.seedData();
    
    console.log('✅ База данных готова');
    return this.db;
  }

  async createTables() {
    console.log('📋 Создание таблиц...');
    
    // Таблица пользователей
    await this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Таблица продуктов
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        image TEXT,
        rating REAL,
        reviews INTEGER,
        stock INTEGER,
        specifications TEXT
      );
    `);

    // Таблица заказов
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        total INTEGER NOT NULL,
        status TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        customer_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    // Таблица элементов заказа
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL,
        name TEXT NOT NULL,
        image TEXT,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      );
    `);

    // Таблица элементов корзины
    // Замените создание таблицы cart_items на:
   await this.db.exec(`
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    session_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id),
    UNIQUE(session_id, product_id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  );
`);
  }

  async seedData() {
    console.log('🌱 Заполнение тестовыми данными...');
    
    // Проверяем, есть ли уже пользователи
    const userCount = await this.db.get('SELECT COUNT(*) as count FROM users');
    
    if (userCount.count === 0) {
        console.log('👤 Добавляем тестовых пользователей...');
        
        const hashedPassword1 = await bcrypt.hash('password123', 10);
        const hashedPassword2 = await bcrypt.hash('test123', 10);
        const hashedAdminPassword = await bcrypt.hash('admin123', 10); // Пароль для админа
        
        // Обычный пользователь
        await this.db.run(
            'INSERT INTO users (id, email, password, name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), 'user@example.com', hashedPassword1, 'Иван Петров', '+7 (999) 123-45-67', 'Москва, ул. Примерная, д. 1', 'user']
        );
        
        // Тестовый пользователь
        await this.db.run(
            'INSERT INTO users (id, email, password, name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), 'test@test.com', hashedPassword2, 'Тест Тестов', '+7 (999) 987-65-43', 'Санкт-Петербург, Невский пр., д. 10', 'user']
        );
        
        // Администратор
        await this.db.run(
            'INSERT INTO users (id, email, password, name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), 'admin@admin.kz', hashedAdminPassword, 'Администратор', '+7 (777) 777-77-77', 'Админский адрес', 'admin']
        );
    }

    // Проверяем, есть ли уже продукты
    const productCount = await this.db.get('SELECT COUNT(*) as count FROM products');
    
    if (productCount.count === 0) {
      console.log('📦 Добавляем тестовые продукты...');
      
      const products = [
        {
          id: uuidv4(),
          name: 'Ноутбук Apple MacBook Air M2',
          price: 129999,
          category: 'Электроника',
          description: '13.6-дюймовый дисплей Liquid Retina, чип Apple M2, 8 ГБ объединенной памяти, 256 ГБ SSD. Идеальный ноутбук для работы и творчества.',
          image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
          rating: 4.8,
          reviews: 156,
          stock: 15,
          specifications: JSON.stringify({
            'Процессор': 'Apple M2',
            'Память': '8 ГБ',
            'SSD': '256 ГБ',
            'Экран': '13.6\'\' Liquid Retina',
            'Вес': '1.24 кг'
          })
        },
        {
          id: uuidv4(),
          name: 'Смартфон Samsung Galaxy S23',
          price: 89999,
          category: 'Электроника',
          description: '6.1-дюймовый Dynamic AMOLED 2X, процессор Snapdragon 8 Gen 2, 8 ГБ ОЗУ, 256 ГБ памяти. Отличная камера и производительность.',
          image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop',
          rating: 4.6,
          reviews: 89,
          stock: 32,
          specifications: JSON.stringify({
            'Экран': '6.1\'\' Dynamic AMOLED',
            'Процессор': 'Snapdragon 8 Gen 2',
            'ОЗУ': '8 ГБ',
            'Память': '256 ГБ',
            'Батарея': '3900 мАч'
          })
        },
        {
          id: uuidv4(),
          name: 'Наушники Sony WH-1000XM5',
          price: 34999,
          category: 'Электроника',
          description: 'Беспроводные наушники с продвинутым шумоподавлением, до 30 часов работы от аккумулятора. Премиальное качество звука.',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop',
          rating: 4.9,
          reviews: 214,
          stock: 47,
          specifications: JSON.stringify({
            'Тип': 'Накладные',
            'Шумоподавление': 'Активное',
            'Время работы': '30 часов',
            'Вес': '250 г',
            'Bluetooth': '5.2'
          })
        },
        {
          id: uuidv4(),
          name: 'Кроссовки Nike Air Max 270',
          price: 12999,
          category: 'Одежда и обувь',
          description: 'Мужские кроссовки с воздушной подушкой Max Air 270 для максимального комфорта при ходьбе и беге.',
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
          rating: 4.4,
          reviews: 312,
          stock: 0,
          specifications: JSON.stringify({
            'Материал верха': 'Сетка и искусственная кожа',
            'Подошва': 'Резиновая',
            'Цвет': 'Черный/Белый',
            'Размеры': '38-47'
          })
        },
        {
          id: uuidv4(),
          name: 'Книга "Чистый код" Роберт Мартин',
          price: 2499,
          category: 'Книги',
          description: 'Руководство по гибкой разработке программного обеспечения. Обязательна к прочтению каждому программисту.',
          image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop',
          rating: 4.7,
          reviews: 89,
          stock: 23,
          specifications: JSON.stringify({
            'Автор': 'Роберт Мартин',
            'Страниц': '464',
            'Издательство': 'Питер',
            'Язык': 'Русский',
            'Год': '2022'
          })
        }
      ];

      for (const product of products) {
        await this.db.run(
          `INSERT INTO products (id, name, price, category, description, image, rating, reviews, stock, specifications) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.id, product.name, product.price, product.category, 
            product.description, product.image, product.rating, 
            product.reviews, product.stock, product.specifications
          ]
        );
      }
    }
  }

  // === Методы для пользователей ===
async getUserById(id) {
    console.log('🔍 Ищем пользователя по ID:', id);
    
    const user = await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    
    if (user) {
        console.log('✅ Пользователь найден:', user.email, 'роль:', user.role);
    } else {
        console.log('❌ Пользователь не найден с ID:', id);
    }
    
    return user;
}

  async getUserByEmail(email) {
    return await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async createUser(userData) {
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    await this.db.run(
      'INSERT INTO users (id, email, password, name, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userData.email, hashedPassword, userData.name, userData.phone || '', userData.address || '']
    );
    
    return { id, ...userData, password: hashedPassword };
  }

  async updateUser(id, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await this.db.run(query, values);
    }
    
    return await this.getUserById(id);
  }

  // === Методы для продуктов ===
  async getProducts(filters = {}) {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    
    if (filters.category && filters.category !== 'all') {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    
    if (filters.search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    if (filters.sort) {
      switch(filters.sort) {
        case 'price_asc':
          query += ' ORDER BY price ASC';
          break;
        case 'price_desc':
          query += ' ORDER BY price DESC';
          break;
        case 'rating':
          query += ' ORDER BY rating DESC';
          break;
        default:
          query += ' ORDER BY name ASC';
      }
    } else {
      query += ' ORDER BY name ASC';
    }
    
    return await this.db.all(query, params);
  }

  async getProductById(id) {
    const product = await this.db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (product && product.specifications) {
      product.specifications = JSON.parse(product.specifications);
    }
    return product;
  }

  async updateProductStock(id, quantityChange) {
    await this.db.run(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [quantityChange, id]
    );
  }

  // === Методы для корзины ===
async getCart(userId, sessionId = null) {
  let query = `
    SELECT ci.*, p.name, p.price, p.image, p.stock 
    FROM cart_items ci 
    JOIN products p ON ci.product_id = p.id 
    WHERE 
  `;
  const params = [];
  
  if (userId) {
    // Для авторизованного пользователя
    query += 'ci.user_id = ?';
    params.push(userId);
  } else if (sessionId) {
    // Для гостя
    query += 'ci.session_id = ? AND ci.user_id IS NULL';
    params.push(sessionId);
  } else {
    return { items: [], total: 0 };
  }
  
  const items = await this.db.all(query, params);
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return {
    items: items.map(item => ({
      productId: item.product_id,
      quantity: item.quantity,
      price: item.price,
      name: item.name,
      image: item.image,
      stock: item.stock
    })),
    total
  };
}

async addToCart(userId, sessionId, productId, quantity = 1) {
  // Получаем продукт
  const product = await this.getProductById(productId);
  if (!product) {
    throw new Error('Продукт не найден');
  }
  
  if (product.stock < quantity) {
    throw new Error('Недостаточно товара в наличии');
  }
  
  // Для гостей используем sessionId, для авторизованных - userId
  const identifier = userId || sessionId;
  if (!identifier) {
    throw new Error('Не указан идентификатор пользователя или сессии');
  }
  
  // Проверяем, есть ли уже товар в корзине
  let existingItem;
  
  if (userId) {
    // Для авторизованного пользователя ищем по user_id
    existingItem = await this.db.get(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
  } else {
    // Для гостя ищем по session_id
    existingItem = await this.db.get(
      'SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND user_id IS NULL',
      [sessionId, productId]
    );
  }
  
  if (existingItem) {
    // Обновляем количество
    await this.db.run(
      'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
      [quantity, existingItem.id]
    );
  } else {
    // Добавляем новый товар
    await this.db.run(
      'INSERT INTO cart_items (user_id, session_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [userId || null, sessionId, productId, quantity]
    );
  }
  
  return await this.getCart(userId, sessionId);
}

  async updateCartItem(userId, sessionId, productId, quantity) {
  let query;
  let params;
  
  if (userId) {
    // Для авторизованного пользователя
    query = 'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?';
    params = [quantity, userId, productId];
  } else if (sessionId) {
    // Для гостя
    query = 'UPDATE cart_items SET quantity = ? WHERE session_id = ? AND product_id = ? AND user_id IS NULL';
    params = [quantity, sessionId, productId];
  } else {
    throw new Error('Не указан пользователь или сессия');
  }
  
  await this.db.run(query, params);
  
  if (quantity <= 0) {
    await this.removeFromCart(userId, sessionId, productId);
  }
  
  return await this.getCart(userId, sessionId);
}

  async removeFromCart(userId, sessionId, productId) {
  let query;
  let params;
  
  if (userId) {
    // Для авторизованного пользователя
    query = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
    params = [userId, productId];
  } else if (sessionId) {
    // Для гостя
    query = 'DELETE FROM cart_items WHERE session_id = ? AND product_id = ? AND user_id IS NULL';
    params = [sessionId, productId];
  } else {
    throw new Error('Не указан пользователь или сессия');
  }
  
  await this.db.run(query, params);
  return await this.getCart(userId, sessionId);
}

  async clearCart(userId, sessionId) {
  let query;
  let params;
  
  if (userId) {
    query = 'DELETE FROM cart_items WHERE user_id = ?';
    params = [userId];
  } else if (sessionId) {
    query = 'DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL';
    params = [sessionId];
  } else {
    throw new Error('Не указан пользователь или сессия');
  }
  
  await this.db.run(query, params);
}

  async transferCart(sessionId, userId) {
  // Переносим корзину из сессии в пользователя
  await this.db.run(
    'UPDATE cart_items SET user_id = ?, session_id = NULL WHERE session_id = ? AND user_id IS NULL',
    [userId, sessionId]
  );
}

  // === Методы для заказов ===
  async createOrder(orderData) {
    const orderId = uuidv4();
    const orderNumber = 'ORD-' + Date.now();
    
    // Начинаем транзакцию
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Создаем заказ
      await this.db.run(
        `INSERT INTO orders (id, user_id, order_number, total, status, customer_name, customer_phone, customer_address, customer_comment) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          orderData.userId,
          orderNumber,
          orderData.total,
          'processing',
          orderData.customerName,
          orderData.customerPhone,
          orderData.customerAddress,
          orderData.customerComment || ''
        ]
      );
      
      // Добавляем товары заказа
      for (const item of orderData.items) {
        await this.db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, price, name, image) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, item.productId, item.quantity, item.price, item.name, item.image]
        );
        
        // Обновляем остатки товаров
        await this.updateProductStock(item.productId, -item.quantity);
      }
      
      // Очищаем корзину
      await this.clearCart(orderData.userId, null);
      
      await this.db.run('COMMIT');
      
      return {
        id: orderId,
        orderNumber,
        ...orderData
      };
      
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getUserOrders(userId) {
    const orders = await this.db.all(
      `SELECT o.*, 
        (SELECT GROUP_CONCAT(oi.name || ' (x' || oi.quantity || ')', ', ') 
         FROM order_items oi 
         WHERE oi.order_id = o.id) as items_summary
       FROM orders o 
       WHERE o.user_id = ? 
       ORDER BY o.created_at DESC`,
      [userId]
    );
    
    return orders;
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// Создаем и экспортируем экземпляр базы данных
const database = new Database();
module.exports = database;